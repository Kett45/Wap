import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { extractInitials, normalizeArabicName } from '../lib/arabic';
import { computeFractionalPosition, getEffectiveStudentPosition, buildAttendanceDocId, buildMonthlyBalanceDocId } from '../lib/kamRules';
import { packAvatars, sha256Hex } from '../lib/media';
import type { AttendanceRecord, CardEvent, ChildNote, ChildNoteType, Group, MonthlyBalance, Student, VisitationStatus } from '../types/kam';

export function getNextStudentNumber(students: Student[]): number {
  let maxNum = 0;
  for (const s of students) {
    if (s.studentNumber > maxNum) maxNum = s.studentNumber;
  }
  return Math.min(2000, maxNum + 1);
}

export async function createStudent(params: {
  group: Group;
  name: string;
  studentNumber: number;
  blockId: string;
  createdByUid: string;
  existingStudents: Student[];
}): Promise<string> {
  const cleanName = params.name.trim().slice(0, 100);
  if (!cleanName) throw new Error('يرجى إدخال اسم الطفل.');

  const num = Math.max(1, Math.min(2000, Math.round(params.studentNumber)));
  const blockStudents = params.existingStudents.filter((s) => s.blockId === params.blockId);
  const maxSortOrder = blockStudents.reduce((acc, s) => Math.max(acc, s.sortOrder), 0);
  const maxPos = blockStudents.reduce((acc, s) => Math.max(acc, getEffectiveStudentPosition(s)), 0);

  const ref = await addDoc(collection(db, 'groups', params.group.id, 'students'), {
    groupId: params.group.id,
    name: cleanName,
    studentNumber: num,
    blockId: params.blockId.slice(0, 80),
    sortOrder: Math.min(5000, maxSortOrder + 1),
    position: maxPos > 0 ? maxPos + 1000 : num * 1000,
    avatarInitials: extractInitials(cleanName).slice(0, 10),
    hasAvatar: false,
    createdByUid: params.createdByUid,
    memberUids: params.group.memberUids,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateStudent(params: {
  groupId: string;
  studentId: string;
  patch: Partial<Pick<Student, 'name' | 'studentNumber' | 'blockId' | 'sortOrder' | 'position'>>;
}): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (params.patch.name !== undefined) {
    const cleanName = params.patch.name.trim().slice(0, 100);
    if (!cleanName) throw new Error('الاسم لا يمكن أن يكون فارغاً.');
    payload.name = cleanName;
    payload.avatarInitials = extractInitials(cleanName).slice(0, 10);
  }
  if (params.patch.studentNumber !== undefined) {
    payload.studentNumber = Math.max(1, Math.min(2000, Math.round(params.patch.studentNumber)));
  }
  if (params.patch.blockId !== undefined) {
    payload.blockId = params.patch.blockId.slice(0, 80);
  }
  if (params.patch.sortOrder !== undefined) {
    payload.sortOrder = Math.max(0, Math.min(5000, Math.round(params.patch.sortOrder)));
  }
  if (params.patch.position !== undefined) {
    payload.position = params.patch.position;
  }

  await updateDoc(doc(db, 'groups', params.groupId, 'students', params.studentId), payload);
}

export async function reorderStudentFractionally(params: {
  groupId: string;
  studentId: string;
  prevStudent?: Student | null;
  nextStudent?: Student | null;
  targetBlockId?: string;
}): Promise<number> {
  const prevPos = params.prevStudent ? getEffectiveStudentPosition(params.prevStudent) : null;
  const nextPos = params.nextStudent ? getEffectiveStudentPosition(params.nextStudent) : null;
  const newPosition = computeFractionalPosition(prevPos, nextPos);
  const payload: Record<string, unknown> = {
    position: newPosition,
    updatedAt: serverTimestamp(),
  };
  if (params.targetBlockId !== undefined) {
    payload.blockId = params.targetBlockId.slice(0, 80);
  }
  await updateDoc(doc(db, 'groups', params.groupId, 'students', params.studentId), payload);
  return newPosition;
}

export async function deleteStudent(groupId: string, studentId: string): Promise<void> {
  await deleteDoc(doc(db, 'groups', groupId, 'students', studentId));
  try {
    await deleteDoc(doc(db, 'groups', groupId, 'avatars', studentId));
  } catch {
    // Avatar document may not exist
  }
}

export interface BulkImportParsedRow {
  rawLine: string;
  name: string;
  explicitNumber?: number;
  duplicateOf?: Student;
}

export function parseBulkImportNames(rawText: string, existingStudents: Student[]): BulkImportParsedRow[] {
  const existingMap = new Map<string, Student>();
  for (const s of existingStudents) {
    existingMap.set(normalizeArabicName(s.name), s);
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const seenInBatch = new Set<string>();
  const rows: BulkImportParsedRow[] = [];

  for (const line of lines) {
    // Support optional prefix like "12 - أحمد" or "#12 أحمد" or "12. أحمد"
    const match = /^#?(\d{1,4})\s*[-.):\s]+\s*(.+)$/.exec(line);
    const explicitNumber = match ? Number.parseInt(match[1], 10) : undefined;
    const name = (match ? match[2] : line).trim().slice(0, 100);
    if (!name) continue;

    const norm = normalizeArabicName(name);
    const duplicateOf = existingMap.get(norm);
    if (seenInBatch.has(norm) && !duplicateOf) {
      continue;
    }
    seenInBatch.add(norm);
    rows.push({ rawLine: line, name, explicitNumber, duplicateOf });
  }

  return rows;
}

export async function executeBulkImport(params: {
  group: Group;
  rows: BulkImportParsedRow[];
  blockId: string;
  createdByUid: string;
  existingStudents: Student[];
  duplicateStrategy: 'SKIP' | 'UPDATE_BLOCK' | 'KEEP_BOTH';
}): Promise<{ added: number; updated: number; skipped: number }> {
  let nextNum = getNextStudentNumber(params.existingStudents);
  let nextSort = params.existingStudents.reduce((acc, s) => Math.max(acc, s.sortOrder), 0) + 1;
  let added = 0;
  let updated = 0;
  let skipped = 0;

  const batch = writeBatch(db);

  for (const row of params.rows) {
    if (row.duplicateOf) {
      if (params.duplicateStrategy === 'SKIP') {
        skipped += 1;
        continue;
      }
      if (params.duplicateStrategy === 'UPDATE_BLOCK') {
        batch.update(doc(db, 'groups', params.group.id, 'students', row.duplicateOf.id), {
          blockId: params.blockId.slice(0, 80),
          updatedAt: serverTimestamp(),
        });
        updated += 1;
        continue;
      }
    }

    const num = row.explicitNumber
      ? Math.max(1, Math.min(2000, row.explicitNumber))
      : Math.min(2000, nextNum++);
    const sortOrder = Math.min(5000, nextSort++);
    const newRef = doc(collection(db, 'groups', params.group.id, 'students'));
    batch.set(newRef, {
      groupId: params.group.id,
      name: row.name.slice(0, 100),
      studentNumber: num,
      blockId: params.blockId.slice(0, 80),
      sortOrder,
      position: sortOrder * 1000 + num,
      avatarInitials: extractInitials(row.name).slice(0, 10),
      hasAvatar: false,
      createdByUid: params.createdByUid,
      memberUids: params.group.memberUids,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    added += 1;
  }

  if (added > 0 || updated > 0) {
    await batch.commit();
  }

  return { added, updated, skipped };
}

export async function fetchStudentAvatarPacked(
  groupId: string,
  studentId: string
): Promise<string | null> {
  const snap = await getDoc(doc(db, 'groups', groupId, 'avatars', studentId));
  if (!snap.exists()) return null;
  const data = snap.data() as { avatarBase64?: string };
  return data.avatarBase64 || null;
}

export async function saveStudentAvatars(params: {
  group: Group;
  studentId: string;
  rawBase64List: string[];
  updatedByUid: string;
}): Promise<{ packed: string; hash: string }> {
  const packed = packAvatars(params.rawBase64List);
  const hash = packed ? (await sha256Hex(packed.slice(0, 4096))).slice(0, 32) : '';

  const avatarRef = doc(db, 'groups', params.group.id, 'avatars', params.studentId);
  const studentRef = doc(db, 'groups', params.group.id, 'students', params.studentId);

  if (!packed) {
    try {
      await deleteDoc(avatarRef);
    } catch {
      // ignore if missing
    }
    await updateDoc(studentRef, {
      hasAvatar: false,
      avatarHash: '',
      updatedAt: serverTimestamp(),
    });
    return { packed: '', hash: '' };
  }

  const existing = await getDoc(avatarRef);
  if (existing.exists()) {
    await updateDoc(avatarRef, {
      avatarBase64: packed,
      avatarHash: hash,
      updatedByUid: params.updatedByUid,
      memberUids: params.group.memberUids,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(avatarRef, {
      groupId: params.group.id,
      studentId: params.studentId,
      avatarBase64: packed,
      avatarHash: hash,
      updatedByUid: params.updatedByUid,
      memberUids: params.group.memberUids,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await updateDoc(studentRef, {
    hasAvatar: true,
    avatarHash: hash,
    updatedAt: serverTimestamp(),
  });

  return { packed, hash };
}

export async function addChildNote(params: {
  group: Group;
  student: Student;
  type: ChildNoteType;
  text: string;
  status?: VisitationStatus | string;
  authorUid: string;
  authorName: string;
}): Promise<string> {
  const cleanText = params.text.trim().slice(0, 500);
  if (!cleanText) throw new Error('يرجى كتابة نص الملاحظة.');
  const nowMillis = Date.now();

  const notePayload: Record<string, unknown> = {
    groupId: params.group.id,
    studentId: params.student.id,
    studentName: params.student.name.slice(0, 100),
    type: params.type,
    text: cleanText,
    authorUid: params.authorUid,
    authorName: params.authorName.trim().slice(0, 80) || 'خادم',
    clientCreatedAtMillis: nowMillis,
    memberUids: params.group.memberUids,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (params.status) {
    notePayload.status = params.status.slice(0, 30);
  }

  const ref = await addDoc(collection(db, 'groups', params.group.id, 'childNotes'), notePayload);

  if (params.type === 'MEMORIZATION') {
    await updateDoc(doc(db, 'groups', params.group.id, 'students', params.student.id), {
      lastMemorizedText: cleanText,
      lastMemorizedBy: params.authorName.trim().slice(0, 80) || 'خادم',
      lastMemorizedAtMillis: nowMillis,
      updatedAt: serverTimestamp(),
    });
  }

  return ref.id;
}

export async function deleteChildNote(groupId: string, noteId: string): Promise<void> {
  await deleteDoc(doc(db, 'groups', groupId, 'childNotes', noteId));
}

export async function mergeDuplicateStudentsInFirestore(params: {
  group: Group;
  primary: Student;
  duplicate: Student;
  cardEvents: CardEvent[];
  childNotes: ChildNote[];
  attendance: AttendanceRecord[];
  monthlyBalances: MonthlyBalance[];
  actorUid: string;
}): Promise<void> {
  const { group, primary, duplicate, cardEvents, childNotes, attendance, monthlyBalances, actorUid } = params;
  const batch = writeBatch(db);

  // 1. Re-assign duplicate's cardEvents to primary
  const dupEvents = cardEvents.filter((e) => e.studentId === duplicate.id);
  const pointsAddedByMonth = new Map<string, { points: number; count: number }>();

  for (const ev of dupEvents) {
    batch.update(doc(db, 'groups', group.id, 'cardEvents', ev.id), {
      studentId: primary.id,
      studentName: primary.name,
    });
    const cur = pointsAddedByMonth.get(ev.monthKey) ?? { points: 0, count: 0 };
    pointsAddedByMonth.set(ev.monthKey, {
      points: cur.points + ev.points,
      count: cur.count + 1,
    });
  }

  // 2. Recompute / merge monthlyBalances
  const dupBalances = monthlyBalances.filter((b) => b.studentId === duplicate.id);
  for (const dbBal of dupBalances) {
    batch.delete(doc(db, 'groups', group.id, 'monthlyBalances', dbBal.id));
  }
  for (const [monthKey, delta] of pointsAddedByMonth.entries()) {
    const primaryBalId = buildMonthlyBalanceDocId(monthKey, primary.id);
    const existingPrimaryBal = monthlyBalances.find((b) => b.id === primaryBalId);
    const newTotal = (existingPrimaryBal?.totalPoints ?? 0) + delta.points;
    const newCount = (existingPrimaryBal?.eventsCount ?? 0) + delta.count;
    batch.set(
      doc(db, 'groups', group.id, 'monthlyBalances', primaryBalId),
      {
        groupId: group.id,
        studentId: primary.id,
        studentName: primary.name,
        monthKey,
        totalPoints: newTotal,
        eventsCount: newCount,
        lastUpdatedByUid: actorUid,
        memberUids: group.memberUids,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // 3. Re-assign duplicate's childNotes to primary
  const dupNotes = childNotes.filter((n) => n.studentId === duplicate.id);
  for (const note of dupNotes) {
    batch.update(doc(db, 'groups', group.id, 'childNotes', note.id), {
      studentId: primary.id,
      studentName: primary.name,
    });
  }

  // 4. Re-assign duplicate's attendance records to primary if primary has no record for that week
  const dupAtt = attendance.filter((a) => a.studentId === duplicate.id);
  for (const att of dupAtt) {
    batch.delete(doc(db, 'groups', group.id, 'attendance', att.id));
    const primaryAttId = buildAttendanceDocId(att.weekKey, primary.id);
    const primaryHasAtt = attendance.some((a) => a.id === primaryAttId);
    if (!primaryHasAtt) {
      batch.set(doc(db, 'groups', group.id, 'attendance', primaryAttId), {
        ...att,
        id: primaryAttId,
        studentId: primary.id,
        studentName: primary.name,
      });
    }
  }

  // 5. Delete duplicate student document
  batch.delete(doc(db, 'groups', group.id, 'students', duplicate.id));

  await batch.commit();
}

