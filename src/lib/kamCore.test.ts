import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMonthKey,
  getSaturdayWeeksInMonth,
  getWeekInfoForDate,
  gregorianToCoptic,
  shiftWeekKey,
} from './calendar';
import { extractInitials, normalizeArabicName, parseInviteCodeInput } from './arabic';
import {
  buildAttendanceDiffV3Text,
  buildAttendanceV3Text,
  buildVisitationV1Text,
  computeCrossServantDiff,
  groupItemsByBlock,
  parseAttendanceReport,
  parseVisitationReport,
} from './reportFormats';
import {
  buildAttendanceDocId,
  buildDmChatId,
  buildMonthlyBalanceDocId,
  computeFractionalPosition,
  detectDuplicateCardAlerts,
  isInviteTokenValid,
  isValidCardPointsPair,
  validateCardAward,
} from './kamRules';
import { packAvatars, unpackAvatars } from './media';
import type { Group, ServantBlock, Student } from '../types/kam';

test('Coptic calendar converts 11 September 2026 accurately to 1 Tout 1743 AM', () => {
  const coptic = gregorianToCoptic(new Date(2026, 8, 11)); // Sep 11, 2026
  assert.equal(coptic.month, 1);
  assert.equal(coptic.monthName, 'توت');
  assert.equal(coptic.day, 1);
  assert.equal(coptic.year, 1743);
});

test('Saturday calendar starts Week 1 on day 1 and increments on every Saturday', () => {
  // November 2026: Nov 1 is Sunday; Saturdays are Nov 7, 14, 21, 28
  const weeks = getSaturdayWeeksInMonth(2026, 11);
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0].weekKey, '2026-11-W1');
  assert.equal(weeks[0].startDate.getDate(), 1);
  assert.equal(weeks[0].endDate.getDate(), 6);
  assert.equal(weeks[1].weekKey, '2026-11-W2');
  assert.equal(weeks[1].startDate.getDate(), 7);
  assert.equal(weeks[1].endDate.getDate(), 13);

  const nov21 = getWeekInfoForDate(new Date(2026, 10, 21));
  assert.equal(nov21.weekKey, '2026-11-W4');
  assert.equal(formatMonthKey(2026, 11), '2026-11');

  const prev = shiftWeekKey('2026-11-W1', -1);
  assert.equal(prev.monthKey, '2026-10');
});

test('Arabic normalization unifies alef, taa marbouta, alef maqsura, tashkeel and tatweel', () => {
  assert.equal(normalizeArabicName('أَحمـد إِبْرَاهيم آية سلمى'), 'احمد ابراهيم ايه سلمي');
  assert.equal(extractInitials('أحمد سامح'), 'أس');
  assert.equal(extractInitials('كيرلس'), 'كي');
});

test('parseInviteCodeInput handles dashed and compact KAM codes', () => {
  assert.deepEqual(parseInviteCodeInput(' kam4x9p2 - abcd '), {
    inviteCode: 'KAM4X9P2',
    dailyToken: 'ABCD',
  });
  assert.deepEqual(parseInviteCodeInput('KAM4X9P2ABCD'), {
    inviteCode: 'KAM4X9P2',
    dailyToken: 'ABCD',
  });
});

test('Deterministic IDs and card point pairs strictly match Firestore Security Rules', () => {
  assert.equal(buildAttendanceDocId('2026-11-W3', 'st_1'), '2026-11-W3_st_1');
  assert.equal(buildMonthlyBalanceDocId('2026-11', 'st_1'), '2026-11_st_1');
  assert.equal(buildDmChatId('uid_z', 'uid_a'), 'dm_uid_a_uid_z');

  assert.equal(isValidCardPointsPair('ATTENDANCE', 3), true);
  assert.equal(isValidCardPointsPair('ATTENDANCE', 5), false);
  assert.equal(isValidCardPointsPair('GOLD', 20), true);
  assert.equal(isValidCardPointsPair('CUSTOM_ELDER', 45), true);
  assert.equal(isValidCardPointsPair('CUSTOM_ELDER', 150), false);
});

test('Card award validation enforces weekly limit, monthly max, and CUSTOM_ELDER frequency', () => {
  const baseGroup: Group = {
    id: 'KAM12345',
    inviteCode: 'KAM12345',
    name: 'Test',
    adminId: 'u1',
    adminName: 'Admin',
    memberUids: ['u1'],
    allowServantUndo: true,
    enforceWeeklyCardLimit: true,
    maxMonthlyPoints: 25,
    attendanceIsCardOnly: false,
    showLeaderboard: true,
    autoStudentNumber: true,
    customCardEnabled: true,
    customCardPoints: 10,
    customCardFrequency: 'ONCE_EVER',
  };

  // Exceeds monthly max
  const overMax = validateCardAward({
    group: baseGroup,
    studentId: 's1',
    cardType: 'GOLD',
    points: 20,
    weekKey: '2026-11-W1',
    monthKey: '2026-11',
    existingEvents: [],
    currentMonthPoints: 10,
  });
  assert.equal(overMax.allowed, false);

  // Duplicate in same week when enforceWeeklyCardLimit=true
  const dupWeek = validateCardAward({
    group: baseGroup,
    studentId: 's1',
    cardType: 'QUIET',
    points: 5,
    weekKey: '2026-11-W1',
    monthKey: '2026-11',
    existingEvents: [
      {
        id: 'e1',
        groupId: 'KAM12345',
        studentId: 's1',
        studentName: 'Child',
        cardType: 'QUIET',
        points: 5,
        servantId: 'u1',
        servantName: 'Admin',
        monthKey: '2026-11',
        weekKey: '2026-11-W1',
      },
    ],
    currentMonthPoints: 5,
  });
  assert.equal(dupWeek.allowed, false);

  // CUSTOM_ELDER ONCE_EVER blocks second award in another month
  const onceEver = validateCardAward({
    group: baseGroup,
    studentId: 's1',
    cardType: 'CUSTOM_ELDER',
    points: 10,
    weekKey: '2026-12-W1',
    monthKey: '2026-12',
    existingEvents: [
      {
        id: 'e2',
        groupId: 'KAM12345',
        studentId: 's1',
        studentName: 'Child',
        cardType: 'CUSTOM_ELDER',
        points: 10,
        servantId: 'u1',
        servantName: 'Admin',
        monthKey: '2026-11',
        weekKey: '2026-11-W1',
      },
    ],
    currentMonthPoints: 0,
  });
  assert.equal(onceEver.allowed, false);

  // Duplicate alert detector
  const alerts = detectDuplicateCardAlerts(
    [
      {
        id: 'a',
        groupId: 'KAM12345',
        studentId: 's1',
        studentName: 'Child',
        cardType: 'QUIET',
        points: 5,
        servantId: 'u1',
        servantName: 'S1',
        monthKey: '2026-11',
        weekKey: '2026-11-W1',
      },
      {
        id: 'b',
        groupId: 'KAM12345',
        studentId: 's1',
        studentName: 'Child',
        cardType: 'QUIET',
        points: 5,
        servantId: 'u2',
        servantName: 'S2',
        monthKey: '2026-11',
        weekKey: '2026-11-W1',
      },
    ],
    '2026-11-W1'
  );
  assert.equal(alerts.length, 1);
});

test('ATTENDANCE_V3 and cross-servant DIFF| round-trip accurately', () => {
  const s1 = { id: 'st_1', name: 'أحمد سامح', studentNumber: 1 };
  const s2 = { id: 'st_2', name: 'بيشوي مجدي', studentNumber: 2 };
  const s3 = { id: 'st_3', name: 'كيرلس هاني', studentNumber: 3 };

  const wire = buildAttendanceV3Text({
    servantName: 'أ. مينا',
    reportTypeKey: 'ATTENDANCE_ONLY',
    entries: [
      { student: s1, status: 'PRESENT' },
      { student: s2, status: 'ABSENT' },
      { student: s3, status: 'ISSUE', note: 'شغب' },
    ],
  });

  const parsed = parseAttendanceReport(wire);
  assert.ok(parsed);
  assert.equal(parsed.servantName, 'أ. مينا');
  assert.deepEqual(parsed.presentNames, ['أحمد سامح']);
  assert.equal(parsed.absentItems.length, 1);
  assert.equal(parsed.issueItems.length, 1);
  assert.equal(parsed.issueItems[0].extra, 'شغب');

  // Identical second servant produces zero diffs
  const noDiffs = computeCrossServantDiff({
    baselineReport: parsed,
    secondEntries: [
      { student: s1, status: 'PRESENT' },
      { student: s2, status: 'ABSENT' },
      { student: s3, status: 'ISSUE', note: 'شغب' },
    ],
  });
  assert.equal(noDiffs.length, 0);

  // Changed status produces exact diff
  const diffs = computeCrossServantDiff({
    baselineReport: parsed,
    secondEntries: [
      { student: s1, status: 'PRESENT' },
      { student: s2, status: 'PRESENT' },
      { student: s3, status: 'ISSUE', note: 'شغب' },
    ],
  });
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].studentId, 'st_2');
  assert.equal(diffs[0].firstStatus, 'غائب');
  assert.equal(diffs[0].secondStatus, 'حاضر');

  const diffWire = buildAttendanceDiffV3Text({
    servantName: 'تاسوني مريم',
    firstServantName: 'أ. مينا',
    reportTypeKey: 'ATTENDANCE_ONLY',
    diffs,
  });
  const parsedDiff = parseAttendanceReport(diffWire);
  assert.ok(parsedDiff);
  assert.equal(parsedDiff.diffAgainstServant, 'أ. مينا');
  assert.equal(parsedDiff.diffItems.length, 1);
});

test('VISITATION_V1 round-trip, block summary grouping, fractional positioning, packed avatars, and invite token expiry', () => {
  const s1 = { id: 'st_1', name: 'أحمد', studentNumber: 1, blockId: 'b1' } as Student;
  const s2 = { id: 'st_2', name: 'بيشوي', studentNumber: 2, blockId: 'b1' } as Student;
  const s3 = { id: 'st_3', name: 'إبرام', studentNumber: 7, blockId: '' } as Student;

  const wire = buildVisitationV1Text({
    servantName: 'أ. مينا',
    scopeLabel: 'كل الفصل',
    entries: [
      { student: s1, status: 'VISITED' },
      { student: s2, status: 'FOLLOWUP', note: 'امتحانات' },
      { student: s3, status: 'NOT_VISITED' },
    ],
  });
  const parsed = parseVisitationReport(wire);
  assert.ok(parsed);
  assert.equal(parsed.visited.length, 1);
  assert.equal(parsed.followup.length, 1);
  assert.equal(parsed.notVisited.length, 1);

  const blocks: ServantBlock[] = [
    { id: 'b1', groupId: 'g1', servantId: 'u1', servantName: 'مجموعة مينا', colorHex: '#3B82F6', sortOrder: 1 },
  ];
  const grouped = groupItemsByBlock([...parsed.followup, ...parsed.notVisited], [s1, s2, s3], blocks);
  assert.equal(grouped.length, 2);

  assert.equal(computeFractionalPosition(1000, 2000), 1500);

  const packed = packAvatars(['data:image/jpeg;base64,AAA', 'BBB']);
  assert.deepEqual(unpackAvatars(packed), ['AAA', 'BBB']);

  const now = Date.now();
  const groupWithToken = {
    dailyInviteToken: 'ABCD',
    inviteCodeUpdatedAtMillis: now - 25 * 60 * 60 * 1000,
  } as Group;
  assert.equal(isInviteTokenValid(groupWithToken, 'ABCD', now).valid, false);
  const freshGroup = {
    dailyInviteToken: 'ABCD',
    inviteCodeUpdatedAtMillis: now - 1000,
  } as Group;
  assert.equal(isInviteTokenValid(freshGroup, 'abcd', now).valid, true);
});
