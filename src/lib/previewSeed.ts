// Local-only deterministic dataset used strictly when ?autostart=1 is passed in automated preview/testing.
// Normal users never enter this mode and always authenticate via real Firebase Google Sign-In.

import { getMonthKey, getWeekKey, shiftWeekKey } from './calendar';
import { ALL_STANDARD_CARD_IDS, buildAttendanceDocId, buildDmChatId, buildMonthlyBalanceDocId } from './kamRules';
import { buildAttendanceDiffV3Text, buildAttendanceV3Text, buildVisitationV1Text } from './reportFormats';
import type {
  AttendanceRecord,
  CardEvent,
  ChildNote,
  Group,
  GroupInvitation,
  GroupMemberProfile,
  MonthlyBalance,
  ServantBlock,
  Student,
  UserProfile,
} from '../types/kam';
import type { ChatMessage, DmRoom, GroupChatMeta } from '../types/chat';

export interface LocalPreviewDataset {
  userProfile: UserProfile;
  group: Group;
  joinedGroups: Group[];
  blocks: ServantBlock[];
  students: Student[];
  cardEvents: CardEvent[];
  monthlyBalances: MonthlyBalance[];
  attendance: AttendanceRecord[];
  childNotes: ChildNote[];
  members: GroupMemberProfile[];
  invitations: GroupInvitation[];
  chatMeta: GroupChatMeta;
  groupMessages: ChatMessage[];
  dmRooms: DmRoom[];
  dmMessagesByRoom: Record<string, ChatMessage[]>;
}

export function isPreviewAutostartEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('autostart') === '1';
}

export function createLocalPreviewDataset(): LocalPreviewDataset {
  const now = Date.now();
  const weekKey = getWeekKey(new Date());
  const prevWeekKey = shiftWeekKey(weekKey, -1).weekKey;
  const monthKey = getMonthKey(new Date());

  const adminUid = 'uid_admin_mina';
  const servant2Uid = 'uid_servant_mariam';
  const servant3Uid = 'uid_servant_youssef';
  const groupId = 'KAM7N4Q2';

  const userProfile: UserProfile = {
    userId: adminUid,
    displayName: 'أ. مينا عماد',
    email: 'mina.emad@example.com',
    groupId,
    joinedGroupIds: [groupId],
    enabledCards: [...ALL_STANDARD_CARD_IDS],
    collapsedBlockIds: [],
    hiddenBlockIds: [],
    compactViewMode: false,
    themeId: 'DARK',
    uiScaleMode: 'AUTO',
    uiScaleFactor: 1.0,
    showFloatingAddButton: true,
    servantAliases: {
      [servant2Uid]: 'تاسوني مريم',
    },
    createdAt: now - 86400000 * 30,
    updatedAt: now,
  };

  const group: Group = {
    id: groupId,
    inviteCode: groupId,
    name: 'فصل الأنبا كاراس — خامسة ابتدائي',
    adminId: adminUid,
    adminName: 'أ. مينا عماد',
    assistantAdminIds: [servant2Uid],
    memberUids: [adminUid, servant2Uid, servant3Uid],
    allowServantUndo: true,
    enforceWeeklyCardLimit: false,
    maxMonthlyPoints: 200,
    attendanceIsCardOnly: false,
    showLeaderboard: true,
    autoStudentNumber: true,
    bannedUids: [],
    bannedServantEntries: [],
    dailyInviteToken: 'X9K4',
    inviteCodeUpdatedAtMillis: now - 3600000,
    customCardEnabled: true,
    customCardName: 'كارت القمداء',
    customCardPoints: 15,
    customCardIcon: '🏅',
    customCardColorKey: 'GOLD',
    customCardFrequency: 'WEEKLY',
    createdAt: now - 86400000 * 30,
    updatedAt: now,
  };

  const blocks: ServantBlock[] = [
    {
      id: 'blk_1',
      groupId,
      servantId: adminUid,
      servantName: 'مجموعة أ. مينا',
      colorHex: '#3B82F6',
      sortOrder: 1,
      memberUids: group.memberUids,
    },
    {
      id: 'blk_2',
      groupId,
      servantId: servant2Uid,
      servantName: 'مجموعة تاسوني مريم',
      colorHex: '#10B981',
      sortOrder: 2,
      memberUids: group.memberUids,
    },
    {
      id: 'blk_3',
      groupId,
      servantId: servant3Uid,
      servantName: 'مجموعة أ. يوسف',
      colorHex: '#8B5CF6',
      sortOrder: 3,
      memberUids: group.memberUids,
    },
  ];

  const students: Student[] = [
    {
      id: 'st_1',
      groupId,
      name: 'أحمد سامح',
      studentNumber: 1,
      blockId: 'blk_1',
      sortOrder: 1,
      position: 1000,
      avatarInitials: 'أس',
      createdByUid: adminUid,
      lastMemorizedText: 'مزمور 23 كامل + آية الأسبوع',
      lastMemorizedBy: 'أ. مينا عماد',
      lastMemorizedAtMillis: now - 86400000 * 2,
    },
    {
      id: 'st_2',
      groupId,
      name: 'كيرلس هاني',
      studentNumber: 2,
      blockId: 'blk_1',
      sortOrder: 2,
      position: 2000,
      avatarInitials: 'كه',
      createdByUid: adminUid,
      lastMemorizedText: 'لحن إبؤرو',
      lastMemorizedBy: 'أ. مينا عماد',
      lastMemorizedAtMillis: now - 86400000 * 5,
    },
    {
      id: 'st_3',
      groupId,
      name: 'بيشوي مجدي',
      studentNumber: 3,
      blockId: 'blk_1',
      sortOrder: 3,
      position: 3000,
      avatarInitials: 'بم',
      createdByUid: adminUid,
    },
    {
      id: 'st_4',
      groupId,
      name: 'مارينا جورج',
      studentNumber: 4,
      blockId: 'blk_2',
      sortOrder: 1,
      position: 1000,
      avatarInitials: 'مج',
      createdByUid: servant2Uid,
      lastMemorizedText: 'قانون الإيمان',
      lastMemorizedBy: 'مريم نبيل',
      lastMemorizedAtMillis: now - 86400000 * 1,
    },
    {
      id: 'st_5',
      groupId,
      name: 'دميانة رامي',
      studentNumber: 5,
      blockId: 'blk_2',
      sortOrder: 2,
      position: 2000,
      avatarInitials: 'در',
      createdByUid: servant2Uid,
    },
    {
      id: 'st_6',
      groupId,
      name: 'فيلوباتير أشرف',
      studentNumber: 6,
      blockId: 'blk_3',
      sortOrder: 1,
      position: 1000,
      avatarInitials: 'فأ',
      createdByUid: servant3Uid,
    },
    {
      id: 'st_7',
      groupId,
      name: 'إبرام عادل',
      studentNumber: 7,
      blockId: '',
      sortOrder: 1,
      position: 1000,
      avatarInitials: 'إع',
      createdByUid: adminUid,
    },
  ];

  const cardEvents: CardEvent[] = [
    {
      id: 'ev_1',
      groupId,
      studentId: 'st_1',
      studentName: 'أحمد سامح',
      cardType: 'ATTENDANCE',
      points: 3,
      servantId: adminUid,
      servantName: 'أ. مينا عماد',
      monthKey,
      weekKey,
      createdAt: now - 7200000,
    },
    {
      id: 'ev_2',
      groupId,
      studentId: 'st_1',
      studentName: 'أحمد سامح',
      cardType: 'GOLD',
      points: 20,
      servantId: adminUid,
      servantName: 'أ. مينا عماد',
      monthKey,
      weekKey,
      createdAt: now - 7100000,
    },
    {
      id: 'ev_3',
      groupId,
      studentId: 'st_1',
      studentName: 'أحمد سامح',
      cardType: 'QUIET',
      points: 5,
      servantId: adminUid,
      servantName: 'أ. مينا عماد',
      monthKey,
      weekKey,
      createdAt: now - 7000000,
    },
    // Duplicate alert demo: QUIET awarded by two servants in same week
    {
      id: 'ev_4',
      groupId,
      studentId: 'st_1',
      studentName: 'أحمد سامح',
      cardType: 'QUIET',
      points: 5,
      servantId: servant2Uid,
      servantName: 'مريم نبيل',
      monthKey,
      weekKey,
      createdAt: now - 6900000,
    },
    {
      id: 'ev_5',
      groupId,
      studentId: 'st_2',
      studentName: 'كيرلس هاني',
      cardType: 'PRAISE',
      points: 10,
      servantId: adminUid,
      servantName: 'أ. مينا عماد',
      monthKey,
      weekKey,
      createdAt: now - 6800000,
    },
    {
      id: 'ev_6',
      groupId,
      studentId: 'st_4',
      studentName: 'مارينا جورج',
      cardType: 'CUSTOM_ELDER',
      points: 15,
      servantId: servant2Uid,
      servantName: 'مريم نبيل',
      monthKey,
      weekKey,
      createdAt: now - 6500000,
    },
    {
      id: 'ev_7',
      groupId,
      studentId: 'st_4',
      studentName: 'مارينا جورج',
      cardType: 'MEMORIZATION',
      points: 6,
      servantId: servant2Uid,
      servantName: 'مريم نبيل',
      monthKey,
      weekKey: prevWeekKey,
      createdAt: now - 86400000 * 7,
    },
    {
      id: 'ev_8',
      groupId,
      studentId: 'st_6',
      studentName: 'فيلوباتير أشرف',
      cardType: 'PARTICIPATION',
      points: 2,
      servantId: servant3Uid,
      servantName: 'أ. يوسف جرجس',
      monthKey,
      weekKey,
      createdAt: now - 6000000,
    },
  ];

  const monthlyBalances: MonthlyBalance[] = [
    {
      id: buildMonthlyBalanceDocId(monthKey, 'st_1'),
      groupId,
      studentId: 'st_1',
      studentName: 'أحمد سامح',
      monthKey,
      totalPoints: 33,
      eventsCount: 4,
      lastUpdatedByUid: servant2Uid,
    },
    {
      id: buildMonthlyBalanceDocId(monthKey, 'st_2'),
      groupId,
      studentId: 'st_2',
      studentName: 'كيرلس هاني',
      monthKey,
      totalPoints: 10,
      eventsCount: 1,
      lastUpdatedByUid: adminUid,
    },
    {
      id: buildMonthlyBalanceDocId(monthKey, 'st_4'),
      groupId,
      studentId: 'st_4',
      studentName: 'مارينا جورج',
      monthKey,
      totalPoints: 21,
      eventsCount: 2,
      lastUpdatedByUid: servant2Uid,
    },
    {
      id: buildMonthlyBalanceDocId(monthKey, 'st_6'),
      groupId,
      studentId: 'st_6',
      studentName: 'فيلوباتير أشرف',
      monthKey,
      totalPoints: 2,
      eventsCount: 1,
      lastUpdatedByUid: servant3Uid,
    },
  ];

  const attendance: AttendanceRecord[] = [
    {
      id: buildAttendanceDocId(weekKey, 'st_1'),
      groupId,
      studentId: 'st_1',
      studentName: 'أحمد سامح',
      status: 'PRESENT',
      weekKey,
      servantId: adminUid,
      servantName: 'أ. مينا عماد',
      note: '',
      memberUids: group.memberUids,
      createdAt: now - 5400000,
    },
    {
      id: buildAttendanceDocId(weekKey, 'st_2'),
      groupId,
      studentId: 'st_2',
      studentName: 'كيرلس هاني',
      status: 'PRESENT',
      weekKey,
      servantId: adminUid,
      servantName: 'أ. مينا عماد',
      note: '',
      memberUids: group.memberUids,
      createdAt: now - 5400000,
    },
    {
      id: buildAttendanceDocId(weekKey, 'st_3'),
      groupId,
      studentId: 'st_3',
      studentName: 'بيشوي مجدي',
      status: 'ABSENT',
      weekKey,
      servantId: adminUid,
      servantName: 'أ. مينا عماد',
      note: '',
      memberUids: group.memberUids,
      createdAt: now - 5400000,
    },
    {
      id: buildAttendanceDocId(weekKey, 'st_4'),
      groupId,
      studentId: 'st_4',
      studentName: 'مارينا جورج',
      status: 'PRESENT',
      weekKey,
      servantId: servant2Uid,
      servantName: 'مريم نبيل',
      note: '',
      memberUids: group.memberUids,
      createdAt: now - 5200000,
    },
    {
      id: buildAttendanceDocId(weekKey, 'st_5'),
      groupId,
      studentId: 'st_5',
      studentName: 'دميانة رامي',
      status: 'ISSUE',
      weekKey,
      servantId: servant2Uid,
      servantName: 'مريم نبيل',
      note: 'حديث متكرر أثناء الدرس',
      memberUids: group.memberUids,
      createdAt: now - 5100000,
    },
  ];

  const childNotes: ChildNote[] = [
    {
      id: 'note_1',
      groupId,
      studentId: 'st_1',
      studentName: 'أحمد سامح',
      type: 'MEMORIZATION',
      text: 'حفظ مزمور 23 كامل + آية الأسبوع بتفوق',
      authorUid: adminUid,
      authorName: 'أ. مينا عماد',
      clientCreatedAtMillis: now - 86400000 * 2,
      createdAt: now - 86400000 * 2,
    },
    {
      id: 'note_2',
      groupId,
      studentId: 'st_3',
      studentName: 'بيشوي مجدي',
      type: 'VISITATION',
      text: 'محتاج اتصال تليفوني بسبب ظروف الامتحانات',
      status: 'FOLLOWUP',
      authorUid: adminUid,
      authorName: 'أ. مينا عماد',
      clientCreatedAtMillis: now - 86400000,
      createdAt: now - 86400000,
    },
    {
      id: 'note_3',
      groupId,
      studentId: 'st_5',
      studentName: 'دميانة رامي',
      type: 'COMMENT',
      text: 'ممتازة في الألحان وتحب المشاركة في المسابقات',
      authorUid: servant2Uid,
      authorName: 'مريم نبيل',
      clientCreatedAtMillis: now - 43200000,
      createdAt: now - 43200000,
    },
  ];

  const members: GroupMemberProfile[] = [
    {
      uid: adminUid,
      groupId,
      displayName: 'أ. مينا عماد',
      email: 'mina.emad@example.com',
      phone: '01223456789',
      primaryPhone: '01223456789',
      phoneVerified: false,
      showPhone: true,
      phoneHidden: false,
      lastSeenAt: now - 20000,
    },
    {
      uid: servant2Uid,
      groupId,
      displayName: 'مريم نبيل',
      email: 'mariam.nabil@example.com',
      phone: '01098765432',
      primaryPhone: '01098765432',
      phoneVerified: false,
      showPhone: true,
      phoneHidden: false,
      lastSeenAt: now - 60000,
    },
    {
      uid: servant3Uid,
      groupId,
      displayName: 'أ. يوسف جرجس',
      email: 'youssef.gerges@example.com',
      phone: '01112223344',
      primaryPhone: '01112223344',
      phoneVerified: false,
      showPhone: false,
      phoneHidden: true,
      lastSeenAt: now - 3600000 * 5,
    },
  ];

  const invitations: GroupInvitation[] = [
    {
      id: 'inv_1',
      groupId,
      groupName: group.name,
      adminId: adminUid,
      inviteeName: 'أ. بولا فادي',
      inviteCode: groupId,
      status: 'PENDING',
      acceptedByUid: '',
      createdAt: now - 3600000 * 4,
    },
  ];

  const attendanceV3Text = buildAttendanceV3Text({
    servantName: 'أ. مينا عماد',
    reportTypeKey: 'ATTENDANCE_ONLY',
    entries: [
      { student: students[0], status: 'PRESENT' },
      { student: students[1], status: 'PRESENT' },
      { student: students[3], status: 'PRESENT' },
      { student: students[2], status: 'ABSENT' },
      { student: students[4], status: 'ISSUE', note: 'حديث متكرر أثناء الدرس' },
    ],
    group,
  });

  const diffV3Text = buildAttendanceDiffV3Text({
    servantName: 'مريم نبيل',
    firstServantName: 'أ. مينا عماد',
    reportTypeKey: 'ATTENDANCE_ONLY',
    diffs: [
      {
        studentId: 'st_3',
        studentNumber: 3,
        studentName: 'بيشوي مجدي',
        firstStatus: 'غائب',
        secondStatus: 'حاضر',
      },
    ],
    group,
  });

  const visitationV1Text = buildVisitationV1Text({
    servantName: 'أ. مينا عماد',
    scopeLabel: 'مجموعة أ. مينا',
    entries: [
      { student: students[0], status: 'VISITED' },
      { student: students[1], status: 'VISITED' },
      { student: students[2], status: 'FOLLOWUP', note: 'محتاج اتصال بسبب الامتحانات' },
    ],
  });

  const groupMessages: ChatMessage[] = [
    {
      id: 'msg_4',
      chatId: groupId,
      groupId,
      senderUid: servant2Uid,
      senderName: 'مريم نبيل',
      type: 'TEXT',
      text: 'ربنا يبارك خدمتكم يا خدام، جهزت كروت الأسبوع الجاي.',
      isDeleted: false,
      memberUids: group.memberUids,
      createdAt: now - 1200000,
    },
    {
      id: 'msg_3',
      chatId: groupId,
      groupId,
      senderUid: adminUid,
      senderName: 'أ. مينا عماد',
      type: 'SYSTEM',
      text: visitationV1Text,
      notificationCategory: 'VISITATION',
      isDeleted: false,
      memberUids: group.memberUids,
      createdAt: now - 2400000,
    },
    {
      id: 'msg_2',
      chatId: groupId,
      groupId,
      senderUid: servant2Uid,
      senderName: 'مريم نبيل',
      type: 'SYSTEM',
      text: diffV3Text,
      notificationCategory: 'CONFLICT',
      isDeleted: false,
      memberUids: group.memberUids,
      createdAt: now - 3600000,
    },
    {
      id: 'msg_1',
      chatId: groupId,
      groupId,
      senderUid: adminUid,
      senderName: 'أ. مينا عماد',
      type: 'SYSTEM',
      text: attendanceV3Text,
      notificationCategory: 'SYSTEM',
      isDeleted: false,
      memberUids: group.memberUids,
      createdAt: now - 5400000,
    },
  ];

  const dmChatId = buildDmChatId(adminUid, servant2Uid);
  const dmRooms: DmRoom[] = [
    {
      id: dmChatId,
      chatId: dmChatId,
      groupId,
      participants: [adminUid, servant2Uid].sort(),
      participantNames: {
        [adminUid]: 'أ. مينا عماد',
        [servant2Uid]: 'مريم نبيل',
      },
      lastMessageText: 'تمام هكلم أسرة بيشوي النهاردة بالليل.',
      lastMessageType: 'TEXT',
      lastMessageSenderUid: servant2Uid,
      lastMessageSenderName: 'مريم نبيل',
      lastMessageAt: now - 900000,
      totalMessagesCount: 1,
      updatedAt: now - 900000,
    },
  ];

  const dmMessagesByRoom: Record<string, ChatMessage[]> = {
    [dmChatId]: [
      {
        id: 'dm_msg_1',
        chatId: dmChatId,
        groupId,
        senderUid: servant2Uid,
        senderName: 'مريم نبيل',
        type: 'TEXT',
        text: 'تمام هكلم أسرة بيشوي النهاردة بالليل.',
        isDeleted: false,
        participants: [adminUid, servant2Uid].sort(),
        createdAt: now - 900000,
      },
    ],
  };

  return {
    userProfile,
    group,
    joinedGroups: [group],
    blocks,
    students,
    cardEvents,
    monthlyBalances,
    attendance,
    childNotes,
    members,
    invitations,
    chatMeta: {
      groupId,
      memberUids: group.memberUids,
      lastMessageId: 'msg_4',
      lastMessageText: groupMessages[0].text,
      lastMessageType: 'TEXT',
      lastMessageSenderUid: servant2Uid,
      lastMessageSenderName: 'مريم نبيل',
      lastMessageAt: now - 1200000,
      totalMessagesCount: groupMessages.length,
      updatedAt: now - 1200000,
    },
    groupMessages,
    dmRooms,
    dmMessagesByRoom,
  };
}
