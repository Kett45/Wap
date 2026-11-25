import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getWeekInfoForDate, parseWeekKey } from '../lib/calendar';
import {
  buildAttendanceDocId,
  buildMonthlyBalanceDocId,
  getCardDefinition,
  validateCardAward,
} from '../lib/kamRules';
import {
  buildAttendanceDiffV3Text,
  buildAttendanceV3Text,
  computeCrossServantDiff,
  parseAttendanceReport,
  type AttendanceSessionEntry,
} from '../lib/reportFormats';
import { sendGroupSystemMessage } from './chatService';
import type {
  AttendanceStatus,
  CardEvent,
  CardTypeId,
  Group,
  MonthlyBalance,
  Student,
} from '../types/kam';
import type { ChatMessage } from '../types/chat';
import { toMillis } from '../lib/arabic';

export async function awardCardToStudent(params: {
  group: Group;
  student: Student;
  cardType: CardTypeId;
  servantId: string;
  servantName: string;
  weekKey: string;
  monthKey: string;
  existingEvents: CardEvent[];
  currentMonthPoints: number;
}): Promise<string> {
  const cardDef = getCardDefinition(params.cardType, params.group);
  const validation = validateCardAward({
    group: params.group,
    studentId: params.student.id,
    cardType: params.cardType,
    points: cardDef.points,
    weekKey: params.weekKey,
    monthKey: params.monthKey,
    existingEvents: params.existingEvents,
    currentMonthPoints: params.currentMonthPoints,
  });

  if (!validation.allowed) {
    throw new Error(validation.reasonAr || 'لا يمكن منح هذا الكارت حالياً.');
  }

  const eventRef = doc(collection(db, 'groups', params.group.id, 'cardEvents'));
  const balanceId = buildMonthlyBalanceDocId(params.monthKey, params.student.id);
  const balanceRef = doc(db, 'groups', params.group.id, 'monthlyBalances', balanceId);

  await runTransaction(db, async (tx) => {
    const balanceSnap = await tx.get(balanceRef);
    const existingBal = balanceSnap.exists() ? (balanceSnap.data() as MonthlyBalance) : null;

    tx.set(eventRef, {
      groupId: params.group.id,
      studentId: params.student.id,
      studentName: params.student.name.slice(0, 100),
      cardType: params.cardType,
      points: cardDef.points,
      servantId: params.servantId,
      servantName: params.servantName.trim().slice(0, 80) || 'خادم',
      monthKey: params.monthKey,
      weekKey: params.weekKey,
      memberUids: params.group.memberUids,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const newTotal = Math.min(100000, Math.max(0, (existingBal?.totalPoints ?? 0) + cardDef.points));
    const newCount = Math.min(10000, Math.max(0, (existingBal?.eventsCount ?? 0) + 1));

    if (balanceSnap.exists()) {
      tx.update(balanceRef, {
        studentName: params.student.name.slice(0, 100),
        totalPoints: newTotal,
        eventsCount: newCount,
        lastUpdatedByUid: params.servantId,
        memberUids: params.group.memberUids,
        updatedAt: serverTimestamp(),
      });
    } else {
      tx.set(balanceRef, {
        groupId: params.group.id,
        studentId: params.student.id,
        studentName: params.student.name.slice(0, 100),
        monthKey: params.monthKey,
        totalPoints: newTotal,
        eventsCount: newCount,
        lastUpdatedByUid: params.servantId,
        memberUids: params.group.memberUids,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  });

  return eventRef.id;
}

export async function undoCardEvent(params: {
  group: Group;
  event: CardEvent;
  actorUid: string;
}): Promise<void> {
  const eventRef = doc(db, 'groups', params.group.id, 'cardEvents', params.event.id);
  const balanceId = buildMonthlyBalanceDocId(params.event.monthKey, params.event.studentId);
  const balanceRef = doc(db, 'groups', params.group.id, 'monthlyBalances', balanceId);

  await runTransaction(db, async (tx) => {
    const balanceSnap = await tx.get(balanceRef);
    tx.delete(eventRef);

    if (balanceSnap.exists()) {
      const bal = balanceSnap.data() as MonthlyBalance;
      const newTotal = Math.max(0, (bal.totalPoints ?? 0) - params.event.points);
      const newCount = Math.max(0, (bal.eventsCount ?? 0) - 1);
      tx.update(balanceRef, {
        totalPoints: newTotal,
        eventsCount: newCount,
        lastUpdatedByUid: params.actorUid,
        memberUids: params.group.memberUids,
        updatedAt: serverTimestamp(),
      });
    }
  });
}

export async function saveWeeklyAttendanceRecord(params: {
  group: Group;
  student: Student;
  status: AttendanceStatus;
  weekKey: string;
  servantId: string;
  servantName: string;
  note?: string;
}): Promise<void> {
  const attendanceId = buildAttendanceDocId(params.weekKey, params.student.id);
  const ref = doc(db, 'groups', params.group.id, 'attendance', attendanceId);
  const existing = await getDoc(ref);

  const payload = {
    groupId: params.group.id,
    studentId: params.student.id,
    studentName: params.student.name.slice(0, 100),
    status: params.status,
    weekKey: params.weekKey.slice(0, 20),
    servantId: params.servantId,
    servantName: params.servantName.trim().slice(0, 80) || 'خادم',
    note: (params.note || '').trim().slice(0, 200),
    memberUids: params.group.memberUids,
    createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, payload);
}

export async function deleteWeeklyAttendanceRecord(
  groupId: string,
  weekKey: string,
  studentId: string
): Promise<void> {
  const attendanceId = buildAttendanceDocId(weekKey, studentId);
  await deleteDoc(doc(db, 'groups', groupId, 'attendance', attendanceId));
}

export async function sendSmartAttendanceReportWithDiff(params: {
  group: Group;
  servantUid: string;
  servantName: string;
  weekKey: string;
  reportTypeKey: 'ATTENDANCE_ONLY' | CardTypeId;
  entries: AttendanceSessionEntry[];
}): Promise<{ outcome: 'FULL_SENT' | 'DIFF_SENT' | 'IDENTICAL_SKIPPED'; messageId?: string }> {
  const { group, servantUid, servantName, weekKey, reportTypeKey, entries } = params;

  // Fetch recent group messages to find earliest non-diff baseline report from another servant in the same weekKey & reportTypeKey
  const msgsSnap = await getDocs(
    query(
      collection(db, 'groups', group.id, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(60)
    )
  );

  const recentMsgs: ChatMessage[] = msgsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as ChatMessage
  );

  // Determine messages created in the same Saturday weekKey
  const matchingBaselines: Array<{ msg: ChatMessage; parsed: NonNullable<ReturnType<typeof parseAttendanceReport>> }> = [];

  for (const msg of recentMsgs) {
    if (msg.type !== 'SYSTEM' || msg.isDeleted) continue;
    if (msg.senderUid === servantUid) continue;
    const parsed = parseAttendanceReport(msg.text);
    if (!parsed) continue;
    if (parsed.diffAgainstServant) continue; // Ignore diff reports as baseline
    if (parsed.reportTypeKey !== reportTypeKey) continue;

    const msgMillis = toMillis(msg.createdAt);
    const msgWeekKey = msgMillis ? getWeekInfoForDate(new Date(msgMillis)).weekKey : weekKey;
    if (msgWeekKey !== weekKey) continue;

    matchingBaselines.push({ msg, parsed });
  }

  // Earliest baseline from another servant
  matchingBaselines.sort((a, b) => toMillis(a.msg.createdAt) - toMillis(b.msg.createdAt));
  const baseline = matchingBaselines[0];

  if (baseline) {
    const diffs = computeCrossServantDiff({
      baselineReport: baseline.parsed,
      secondEntries: entries,
    });

    if (diffs.length === 0) {
      return { outcome: 'IDENTICAL_SKIPPED' };
    }

    const diffText = buildAttendanceDiffV3Text({
      servantName,
      firstServantName: baseline.parsed.servantName || baseline.msg.senderName,
      reportTypeKey,
      diffs,
      group,
    });

    const messageId = await sendGroupSystemMessage({
      group,
      senderUid: servantUid,
      senderName: servantName,
      text: diffText,
      notificationCategory: 'CONFLICT',
    });
    return { outcome: 'DIFF_SENT', messageId };
  }

  // No baseline found -> send full [ATTENDANCE_V3]
  const fullText = buildAttendanceV3Text({
    servantName,
    reportTypeKey,
    entries,
    group,
  });

  const messageId = await sendGroupSystemMessage({
    group,
    senderUid: servantUid,
    senderName: servantName,
    text: fullText,
    notificationCategory: reportTypeKey === 'ATTENDANCE_ONLY' ? 'SYSTEM' : 'CARD',
  });
  return { outcome: 'FULL_SENT', messageId };
}

export function getMonthKeyFromWeekKey(weekKey: string): string {
  return parseWeekKey(weekKey).monthKey;
}
