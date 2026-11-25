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
import {
  generateDailyToken,
  generateInviteCode,
  parseInviteCodeInput,
} from '../lib/arabic';
import { BLOCK_COLOR_PRESETS, isInviteTokenValid } from '../lib/kamRules';
import type {
  CustomCardColorKey,
  CustomCardFrequency,
  Group,
  GroupMemberProfile,
  ServantBlock,
  Student,
  UserProfile,
} from '../types/kam';

export async function createGroup(params: {
  name: string;
  user: UserProfile;
}): Promise<Group> {
  const cleanName = params.name.trim().slice(0, 100);
  if (!cleanName) throw new Error('يرجى إدخال اسم الفصل.');

  let inviteCode = generateInviteCode();
  for (let tries = 0; tries < 5; tries++) {
    const existingSnap = await getDoc(doc(db, 'groups', inviteCode));
    if (!existingSnap.exists()) break;
    inviteCode = generateInviteCode();
  }

  const dailyInviteToken = generateDailyToken();
  const nowMillis = Date.now();
  const adminName = params.user.displayName.trim().slice(0, 100) || 'أمين الفصل';

  const groupPayload = {
    inviteCode,
    name: cleanName,
    adminId: params.user.userId,
    adminName,
    assistantAdminIds: [] as string[],
    memberUids: [params.user.userId],
    allowServantUndo: true,
    enforceWeeklyCardLimit: false,
    maxMonthlyPoints: 0,
    attendanceIsCardOnly: false,
    showLeaderboard: true,
    autoStudentNumber: true,
    bannedUids: [] as string[],
    bannedServantEntries: [] as string[],
    dailyInviteToken,
    inviteCodeUpdatedAtMillis: nowMillis,
    customCardEnabled: false,
    customCardName: 'كارت القمداء',
    customCardPoints: 15,
    customCardIcon: '🏅',
    customCardColorKey: 'GOLD',
    customCardFrequency: 'WEEKLY' as CustomCardFrequency,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'groups', inviteCode), groupPayload);

  // Create member profile with phoneVerified: false (mandatory per rules)
  await setDoc(doc(db, 'groups', inviteCode, 'members', params.user.userId), {
    uid: params.user.userId,
    groupId: inviteCode,
    displayName: adminName,
    email: (params.user.email || '').slice(0, 150),
    phone: '',
    primaryPhone: '',
    secondaryPhone: '',
    phoneVerified: false,
    showPhone: false,
    phoneHidden: true,
    hasAvatar: false,
    memberUids: [params.user.userId],
    lastSeenAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Initialize chatMeta/main
  await setDoc(doc(db, 'groups', inviteCode, 'chatMeta', 'main'), {
    groupId: inviteCode,
    memberUids: [params.user.userId],
    totalMessagesCount: 0,
    updatedAt: serverTimestamp(),
  });

  // Update user active groupId & joinedGroupIds
  const joined = Array.from(new Set([...(params.user.joinedGroupIds ?? []), inviteCode])).slice(0, 25);
  await updateDoc(doc(db, 'users', params.user.userId), {
    groupId: inviteCode,
    joinedGroupIds: joined,
    updatedAt: serverTimestamp(),
  });

  return { id: inviteCode, ...groupPayload } as unknown as Group;
}

export async function joinGroupByInviteCode(params: {
  rawCodeInput: string;
  user: UserProfile;
}): Promise<Group> {
  const { inviteCode, dailyToken } = parseInviteCodeInput(params.rawCodeInput);
  if (!inviteCode) throw new Error('يرجى إدخال كود الدعوة بشكل صحيح.');

  const groupRef = doc(db, 'groups', inviteCode);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) {
    throw new Error('لم يتم العثور على فصل بهذا الكود. تأكد من صحة الكود.');
  }

  const group = { id: snap.id, ...snap.data() } as Group;

  if (group.bannedUids?.includes(params.user.userId)) {
    throw new Error('لا يمكنك الانضمام لهذا الفصل (تم حظر حسابك بواسطة أمين الفصل).');
  }

  const alreadyMember =
    group.memberUids.includes(params.user.userId) || group.adminId === params.user.userId;

  if (!alreadyMember) {
    const tokenCheck = isInviteTokenValid(group, dailyToken);
    if (!tokenCheck.valid) {
      throw new Error(tokenCheck.reasonAr || 'كود الدعوة غير صالح.');
    }

    const updatedMembers = [...group.memberUids, params.user.userId];
    // Regular joining user MUST ONLY touch memberUids and updatedAt!
    await updateDoc(groupRef, {
      memberUids: updatedMembers,
      updatedAt: serverTimestamp(),
    });
  }

  // Ensure member doc exists with phoneVerified: false
  const memberRef = doc(db, 'groups', inviteCode, 'members', params.user.userId);
  const memberSnap = await getDoc(memberRef);
  const safeName = params.user.displayName.trim().slice(0, 100) || 'خادم';
  if (!memberSnap.exists()) {
    await setDoc(memberRef, {
      uid: params.user.userId,
      groupId: inviteCode,
      displayName: safeName,
      email: (params.user.email || '').slice(0, 150),
      phone: '',
      primaryPhone: '',
      secondaryPhone: '',
      phoneVerified: false,
      showPhone: false,
      phoneHidden: true,
      hasAvatar: false,
      memberUids: Array.from(new Set([...group.memberUids, params.user.userId])),
      lastSeenAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const joined = Array.from(new Set([...(params.user.joinedGroupIds ?? []), inviteCode])).slice(0, 25);
  await updateDoc(doc(db, 'users', params.user.userId), {
    groupId: inviteCode,
    joinedGroupIds: joined,
    updatedAt: serverTimestamp(),
  });

  return {
    ...group,
    memberUids: Array.from(new Set([...group.memberUids, params.user.userId])),
  };
}

export async function regenerateDailyInviteToken(groupId: string): Promise<string> {
  const newToken = generateDailyToken();
  await updateDoc(doc(db, 'groups', groupId), {
    dailyInviteToken: newToken,
    inviteCodeUpdatedAtMillis: Date.now(),
    updatedAt: serverTimestamp(),
  });
  return newToken;
}

export async function updateGroupPolicies(
  groupId: string,
  patch: Partial<{
    name: string;
    allowServantUndo: boolean;
    enforceWeeklyCardLimit: boolean;
    maxMonthlyPoints: number;
    attendanceIsCardOnly: boolean;
    showLeaderboard: boolean;
    autoStudentNumber: boolean;
    avatarBase64: string;
    avatarHash: string;
    customCardEnabled: boolean;
    customCardName: string;
    customCardPoints: number;
    customCardIcon: string;
    customCardColorKey: CustomCardColorKey;
    customCardFrequency: CustomCardFrequency;
  }>
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.name !== undefined) payload.name = patch.name.trim().slice(0, 100);
  if (patch.allowServantUndo !== undefined) payload.allowServantUndo = patch.allowServantUndo;
  if (patch.enforceWeeklyCardLimit !== undefined)
    payload.enforceWeeklyCardLimit = patch.enforceWeeklyCardLimit;
  if (patch.maxMonthlyPoints !== undefined) {
    payload.maxMonthlyPoints = Math.max(0, Math.min(10000, Math.round(patch.maxMonthlyPoints)));
  }
  if (patch.attendanceIsCardOnly !== undefined)
    payload.attendanceIsCardOnly = patch.attendanceIsCardOnly;
  if (patch.showLeaderboard !== undefined) payload.showLeaderboard = patch.showLeaderboard;
  if (patch.autoStudentNumber !== undefined) payload.autoStudentNumber = patch.autoStudentNumber;
  if (patch.avatarBase64 !== undefined) payload.avatarBase64 = patch.avatarBase64.slice(0, 360000);
  if (patch.avatarHash !== undefined) payload.avatarHash = patch.avatarHash.slice(0, 64);
  if (patch.customCardEnabled !== undefined) payload.customCardEnabled = patch.customCardEnabled;
  if (patch.customCardName !== undefined)
    payload.customCardName = patch.customCardName.trim().slice(0, 40) || 'كارت القمداء';
  if (patch.customCardPoints !== undefined) {
    payload.customCardPoints = Math.max(0, Math.min(100, Math.round(patch.customCardPoints)));
  }
  if (patch.customCardIcon !== undefined)
    payload.customCardIcon = patch.customCardIcon.trim().slice(0, 12) || '🏅';
  if (patch.customCardColorKey !== undefined)
    payload.customCardColorKey = patch.customCardColorKey;
  if (patch.customCardFrequency !== undefined)
    payload.customCardFrequency = patch.customCardFrequency;

  await updateDoc(doc(db, 'groups', groupId), payload);
}

export async function toggleAssistantAdmin(
  group: Group,
  targetUid: string,
  makeAssistant: boolean
): Promise<void> {
  const current = new Set(group.assistantAdminIds ?? []);
  if (makeAssistant) {
    current.add(targetUid);
  } else {
    current.delete(targetUid);
  }
  await updateDoc(doc(db, 'groups', group.id), {
    assistantAdminIds: Array.from(current).slice(0, 20),
    updatedAt: serverTimestamp(),
  });
}

export async function banServantFromGroup(
  group: Group,
  targetUid: string,
  targetName: string
): Promise<void> {
  if (targetUid === group.adminId) {
    throw new Error('لا يمكن حظر أمين الفصل الأساسي.');
  }
  const memberUids = group.memberUids.filter((u) => u !== targetUid);
  const assistantAdminIds = (group.assistantAdminIds ?? []).filter((u) => u !== targetUid);
  const bannedUids = Array.from(new Set([...(group.bannedUids ?? []), targetUid])).slice(0, 50);
  const cleanEntry = `${targetUid}|${targetName.replace(/\|/g, ' ').trim()}`;
  const bannedServantEntries = [
    ...(group.bannedServantEntries ?? []).filter((e) => !e.startsWith(`${targetUid}|`)),
    cleanEntry,
  ].slice(0, 50);

  const patch: Record<string, unknown> = {
    memberUids,
    bannedUids,
    bannedServantEntries,
    updatedAt: serverTimestamp(),
  };
  if (group.assistantAdminIds?.includes(targetUid)) {
    patch.assistantAdminIds = assistantAdminIds;
  }

  await updateDoc(doc(db, 'groups', group.id), patch);
}

export async function unbanServantFromGroup(group: Group, targetUid: string): Promise<void> {
  const bannedUids = (group.bannedUids ?? []).filter((u) => u !== targetUid);
  const bannedServantEntries = (group.bannedServantEntries ?? []).filter(
    (e) => !e.startsWith(`${targetUid}|`)
  );
  await updateDoc(doc(db, 'groups', group.id), {
    bannedUids,
    bannedServantEntries,
    updatedAt: serverTimestamp(),
  });
}

export async function leaveGroup(group: Group, user: UserProfile): Promise<void> {
  if (group.adminId === user.userId) {
    throw new Error('أمين الفصل الأساسي لا يمكنه مغادرة الفصل دون حذفه.');
  }
  const updatedMembers = group.memberUids.filter((u) => u !== user.userId);
  await updateDoc(doc(db, 'groups', group.id), {
    memberUids: updatedMembers,
    updatedAt: serverTimestamp(),
  });

  const remainingJoined = (user.joinedGroupIds ?? []).filter((g) => g !== group.id);
  await updateDoc(doc(db, 'users', user.userId), {
    groupId: remainingJoined[0] ?? '',
    joinedGroupIds: remainingJoined,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteGroupCompletely(groupId: string, user: UserProfile): Promise<void> {
  await deleteDoc(doc(db, 'groups', groupId));
  const remainingJoined = (user.joinedGroupIds ?? []).filter((g) => g !== groupId);
  await updateDoc(doc(db, 'users', user.userId), {
    groupId: remainingJoined[0] ?? '',
    joinedGroupIds: remainingJoined,
    updatedAt: serverTimestamp(),
  });
}

export async function createInvitation(params: {
  group: Group;
  inviteeName: string;
}): Promise<void> {
  const cleanName = params.inviteeName.trim().slice(0, 80);
  if (!cleanName) throw new Error('أدخل اسم الخادم المدعو.');
  await addDoc(collection(db, 'groups', params.group.id, 'invitations'), {
    groupId: params.group.id,
    groupName: params.group.name.slice(0, 80),
    adminId: params.group.adminId,
    inviteeName: cleanName,
    inviteCode: params.group.id,
    status: 'PENDING',
    acceptedByUid: '',
    memberUids: params.group.memberUids,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteInvitation(groupId: string, invitationId: string): Promise<void> {
  await deleteDoc(doc(db, 'groups', groupId, 'invitations', invitationId));
}

export async function createServantBlock(params: {
  group: Group;
  servantId: string;
  servantName: string;
  colorHex: string;
  sortOrder: number;
}): Promise<void> {
  const cleanName = params.servantName.trim().slice(0, 80);
  if (!cleanName) throw new Error('يرجى إدخال اسم البلوك أو الخادم.');
  await addDoc(collection(db, 'groups', params.group.id, 'blocks'), {
    groupId: params.group.id,
    servantId: params.servantId.slice(0, 64),
    servantName: cleanName,
    colorHex: (params.colorHex || BLOCK_COLOR_PRESETS[0].hex).slice(0, 24),
    sortOrder: Math.max(0, Math.min(500, Math.round(params.sortOrder))),
    memberUids: params.group.memberUids,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateServantBlock(params: {
  groupId: string;
  blockId: string;
  isAdmin: boolean;
  patch: Partial<Pick<ServantBlock, 'servantId' | 'servantName' | 'colorHex' | 'sortOrder'>>;
}): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (params.patch.servantName !== undefined) {
    payload.servantName = params.patch.servantName.trim().slice(0, 80);
  }
  if (params.isAdmin) {
    if (params.patch.servantId !== undefined) payload.servantId = params.patch.servantId.slice(0, 64);
    if (params.patch.colorHex !== undefined) payload.colorHex = params.patch.colorHex.slice(0, 24);
    if (params.patch.sortOrder !== undefined) {
      payload.sortOrder = Math.max(0, Math.min(500, Math.round(params.patch.sortOrder)));
    }
  }
  await updateDoc(doc(db, 'groups', params.groupId, 'blocks', params.blockId), payload);
}

export async function deleteServantBlock(params: {
  groupId: string;
  blockId: string;
  studentsInBlock: Student[];
  deleteChildren: boolean;
}): Promise<void> {
  const batch = writeBatch(db);
  for (const s of params.studentsInBlock) {
    const sRef = doc(db, 'groups', params.groupId, 'students', s.id);
    if (params.deleteChildren) {
      batch.delete(sRef);
    } else {
      batch.update(sRef, {
        blockId: '',
        updatedAt: serverTimestamp(),
      });
    }
  }
  batch.delete(doc(db, 'groups', params.groupId, 'blocks', params.blockId));
  await batch.commit();
}

export async function upsertOwnMemberProfile(params: {
  group: Group;
  uid: string;
  existing?: GroupMemberProfile;
  patch: Partial<
    Pick<
      GroupMemberProfile,
      | 'displayName'
      | 'email'
      | 'phone'
      | 'primaryPhone'
      | 'secondaryPhone'
      | 'showPhone'
      | 'phoneHidden'
      | 'avatarBase64'
      | 'avatarHash'
      | 'hasAvatar'
    >
  >;
}): Promise<void> {
  const ref = doc(db, 'groups', params.group.id, 'members', params.uid);
  const existing = params.existing;
  const displayName = (params.patch.displayName ?? existing?.displayName ?? 'خادم')
    .trim()
    .slice(0, 100);
  const primaryPhone = (params.patch.primaryPhone ?? params.patch.phone ?? existing?.primaryPhone ?? existing?.phone ?? '')
    .trim()
    .slice(0, 24);
  const secondaryPhone = (params.patch.secondaryPhone ?? existing?.secondaryPhone ?? '')
    .trim()
    .slice(0, 24);
  const showPhone = params.patch.showPhone ?? existing?.showPhone ?? false;
  const phoneHidden = params.patch.phoneHidden ?? !showPhone;

  if (!existing) {
    await setDoc(ref, {
      uid: params.uid,
      groupId: params.group.id,
      displayName,
      email: (params.patch.email ?? '').slice(0, 150),
      phone: primaryPhone,
      primaryPhone,
      secondaryPhone,
      phoneVerified: false, // Mandatory in Security Rules
      showPhone,
      phoneHidden,
      hasAvatar: params.patch.hasAvatar ?? Boolean(params.patch.avatarBase64),
      avatarBase64: (params.patch.avatarBase64 ?? '').slice(0, 360000),
      avatarHash: (params.patch.avatarHash ?? '').slice(0, 64),
      memberUids: params.group.memberUids,
      lastSeenAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const updatePayload: Record<string, unknown> = {
    displayName,
    phone: primaryPhone,
    primaryPhone,
    secondaryPhone,
    phoneVerified: false, // Always keep false per Rules
    showPhone,
    phoneHidden,
    updatedAt: serverTimestamp(),
  };

  if (params.patch.email !== undefined) updatePayload.email = params.patch.email.slice(0, 150);
  if (params.patch.avatarBase64 !== undefined) {
    updatePayload.avatarBase64 = params.patch.avatarBase64.slice(0, 360000);
    updatePayload.hasAvatar = Boolean(params.patch.avatarBase64);
  }
  if (params.patch.avatarHash !== undefined) {
    updatePayload.avatarHash = params.patch.avatarHash.slice(0, 64);
  }

  await updateDoc(ref, updatePayload);
}

export async function updateMemberHeartbeat(
  group: Group,
  uid: string,
  displayName: string,
  email: string,
  memberExists: boolean
): Promise<void> {
  const ref = doc(db, 'groups', group.id, 'members', uid);
  if (!memberExists) {
    await setDoc(ref, {
      uid,
      groupId: group.id,
      displayName: displayName.trim().slice(0, 100) || 'خادم',
      email: (email || '').slice(0, 150),
      phone: '',
      primaryPhone: '',
      secondaryPhone: '',
      phoneVerified: false,
      showPhone: false,
      phoneHidden: true,
      hasAvatar: false,
      memberUids: group.memberUids,
      lastSeenAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }
  await updateDoc(ref, {
    phoneVerified: false,
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function fetchJoinedGroups(groupIds: string[]): Promise<Group[]> {
  const results: Group[] = [];
  for (const gid of groupIds) {
    if (!gid) continue;
    try {
      const snap = await getDoc(doc(db, 'groups', gid));
      if (snap.exists()) {
        results.push({ id: snap.id, ...snap.data() } as Group);
      }
    } catch {
      // Skip groups user no longer has access to
    }
  }
  return results;
}
