// Wire formats shared with the kAM Android mobile app:
// [ATTENDANCE_V3], [ATTENDANCE_V2], DIFF| cross-servant comparison, and [VISITATION_V1] live report.

import type { AttendanceStatus, CardTypeId, CustomCardColorKey, ServantBlock, Student, VisitationStatus } from '../types/kam';
import { getCardDefinition } from './kamRules';
import type { Group } from '../types/kam';

export interface AttendanceReportItem {
  studentId: string;
  studentNumber: number;
  studentName: string;
  extra?: string; // cardTitle for N| or issue note for I|
}

export interface AttendanceDiffItem {
  studentId: string;
  studentNumber: number;
  studentName: string;
  firstStatus: string;
  secondStatus: string;
  note?: string;
}

export interface ParsedAttendanceV3 {
  version: 'V3' | 'V2';
  servantName: string;
  reportTypeKey: string; // 'ATTENDANCE_ONLY' or CardTypeId
  title: string;
  icon: string;
  colorKey: CustomCardColorKey | string;
  presentNames: string[];
  absentItems: AttendanceReportItem[];
  noCardItems: AttendanceReportItem[];
  issueItems: AttendanceReportItem[];
  diffAgainstServant?: string;
  diffItems: AttendanceDiffItem[];
}

export interface VisitationReportItem {
  studentId: string;
  studentNumber: number;
  studentName: string;
  note?: string;
}

export interface ParsedVisitationV1 {
  servantName: string;
  scopeLabel: string;
  visited: VisitationReportItem[];
  followup: VisitationReportItem[];
  notVisited: VisitationReportItem[];
}

export interface BlockSummaryGroup {
  blockId: string;
  blockName: string;
  colorHex: string;
  count: number;
  numbers: number[];
}

function cleanWireField(value: string): string {
  return value.replace(/[|\r\n]+/g, ' ').trim();
}

export function getReportHeaderMeta(
  reportTypeKey: 'ATTENDANCE_ONLY' | CardTypeId,
  group?: Group | null
): { title: string; icon: string; colorKey: CustomCardColorKey; cardTitle: string } {
  if (reportTypeKey === 'ATTENDANCE_ONLY') {
    return {
      title: 'تقرير الحضور',
      icon: '📋',
      colorKey: 'EMERALD',
      cardTitle: 'الحضور',
    };
  }
  const card = getCardDefinition(reportTypeKey, group);
  return {
    title: `تقرير كارت ${card.titleAr}`,
    icon: card.icon,
    colorKey: card.colorKey,
    cardTitle: card.titleAr,
  };
}

export interface AttendanceSessionEntry {
  student: Pick<Student, 'id' | 'name' | 'studentNumber'>;
  status: AttendanceStatus;
  note?: string;
}

export function buildAttendanceV3Text(params: {
  servantName: string;
  reportTypeKey: 'ATTENDANCE_ONLY' | CardTypeId;
  entries: AttendanceSessionEntry[];
  group?: Group | null;
}): string {
  const { servantName, reportTypeKey, entries, group } = params;
  const meta = getReportHeaderMeta(reportTypeKey, group);
  const isAttendanceOnly = reportTypeKey === 'ATTENDANCE_ONLY';

  const presentNames: string[] = [];
  const lines: string[] = [
    '[ATTENDANCE_V3]',
    `S|${cleanWireField(servantName)}`,
    `T|${reportTypeKey}`,
    `TL|${cleanWireField(meta.title)}`,
    `IC|${cleanWireField(meta.icon)}`,
    `CK|${meta.colorKey}`,
  ];

  const negativeLines: string[] = [];

  for (const entry of entries) {
    const sId = cleanWireField(entry.student.id);
    const sNum = entry.student.studentNumber;
    const sName = cleanWireField(entry.student.name);
    if (entry.status === 'PRESENT') {
      presentNames.push(sName);
    } else if (entry.status === 'ABSENT') {
      if (isAttendanceOnly) {
        negativeLines.push(`A|${sId}|${sNum}|${sName}`);
      } else {
        negativeLines.push(`N|${sId}|${sNum}|${sName}|${cleanWireField(meta.cardTitle)}`);
      }
    } else if (entry.status === 'ISSUE') {
      negativeLines.push(`I|${sId}|${sNum}|${sName}|${cleanWireField(entry.note || 'عمل مشكلة')}`);
    }
  }

  lines.push(`PL|${presentNames.join(' • ')}`);
  lines.push(...negativeLines);

  return lines.join('\n').slice(0, 3950);
}

export function buildAttendanceDiffV3Text(params: {
  servantName: string;
  firstServantName: string;
  reportTypeKey: 'ATTENDANCE_ONLY' | CardTypeId;
  diffs: AttendanceDiffItem[];
  group?: Group | null;
}): string {
  const { servantName, firstServantName, reportTypeKey, diffs, group } = params;
  const meta = getReportHeaderMeta(reportTypeKey, group);

  const lines: string[] = [
    '[ATTENDANCE_V3]',
    `S|${cleanWireField(servantName)}`,
    `T|${reportTypeKey}`,
    `TL|${cleanWireField(meta.title)}`,
    `IC|${cleanWireField(meta.icon)}`,
    `CK|${meta.colorKey}`,
    `DIFF|${cleanWireField(firstServantName)}`,
  ];

  for (const d of diffs) {
    const parts = [
      'D',
      cleanWireField(d.studentId),
      String(d.studentNumber),
      cleanWireField(d.studentName),
      cleanWireField(d.firstStatus),
      cleanWireField(d.secondStatus),
    ];
    if (d.note) parts.push(cleanWireField(d.note));
    lines.push(parts.join('|'));
  }

  return lines.join('\n').slice(0, 3950);
}

export function parseAttendanceReport(text: string): ParsedAttendanceV3 | null {
  if (!text) return null;
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return null;

  const header = rawLines[0];
  if (header !== '[ATTENDANCE_V3]' && header !== '[ATTENDANCE_V2]') {
    return null;
  }

  const parsed: ParsedAttendanceV3 = {
    version: header === '[ATTENDANCE_V3]' ? 'V3' : 'V2',
    servantName: '',
    reportTypeKey: 'ATTENDANCE_ONLY',
    title: 'تقرير الحضور',
    icon: '📋',
    colorKey: 'EMERALD',
    presentNames: [],
    absentItems: [],
    noCardItems: [],
    issueItems: [],
    diffItems: [],
  };

  for (let i = 1; i < rawLines.length; i++) {
    const parts = rawLines[i].split('|');
    const tag = parts[0];
    switch (tag) {
      case 'S':
        parsed.servantName = parts[1] ?? '';
        break;
      case 'T':
        parsed.reportTypeKey = parts[1] || 'ATTENDANCE_ONLY';
        break;
      case 'TL':
        parsed.title = parts[1] || parsed.title;
        break;
      case 'IC':
        parsed.icon = parts[1] || parsed.icon;
        break;
      case 'CK':
        parsed.colorKey = parts[1] || parsed.colorKey;
        break;
      case 'PL':
        parsed.presentNames = (parts[1] ?? '')
          .split('•')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case 'A':
        parsed.absentItems.push({
          studentId: parts[1] ?? '',
          studentNumber: Number.parseInt(parts[2] ?? '0', 10) || 0,
          studentName: parts[3] ?? '',
        });
        break;
      case 'N':
        parsed.noCardItems.push({
          studentId: parts[1] ?? '',
          studentNumber: Number.parseInt(parts[2] ?? '0', 10) || 0,
          studentName: parts[3] ?? '',
          extra: parts[4] ?? '',
        });
        break;
      case 'I':
        parsed.issueItems.push({
          studentId: parts[1] ?? '',
          studentNumber: Number.parseInt(parts[2] ?? '0', 10) || 0,
          studentName: parts[3] ?? '',
          extra: parts[4] ?? '',
        });
        break;
      case 'DIFF':
        parsed.diffAgainstServant = parts[1] ?? '';
        break;
      case 'D':
        parsed.diffItems.push({
          studentId: parts[1] ?? '',
          studentNumber: Number.parseInt(parts[2] ?? '0', 10) || 0,
          studentName: parts[3] ?? '',
          firstStatus: parts[4] ?? '',
          secondStatus: parts[5] ?? '',
          note: parts[6] ?? undefined,
        });
        break;
      default:
        break;
    }
  }

  return parsed;
}

export function statusLabelAr(status: AttendanceStatus, reportTypeKey: string): string {
  const isAttendanceOnly = reportTypeKey === 'ATTENDANCE_ONLY';
  if (status === 'PRESENT') return isAttendanceOnly ? 'حاضر' : 'أخذ الكارت';
  if (status === 'ABSENT') return isAttendanceOnly ? 'غائب' : 'لم يأخذ الكارت';
  return 'مشكلة';
}

// Compute Cross-Servant Diff between a baseline report and the second servant's session entries
export function computeCrossServantDiff(params: {
  baselineReport: ParsedAttendanceV3;
  secondEntries: AttendanceSessionEntry[];
}): AttendanceDiffItem[] {
  const { baselineReport, secondEntries } = params;
  const reportTypeKey = baselineReport.reportTypeKey;

  // Map baseline status by studentId (and fallback by studentName for PL|)
  const firstById = new Map<string, AttendanceStatus>();
  for (const item of baselineReport.absentItems) firstById.set(item.studentId, 'ABSENT');
  for (const item of baselineReport.noCardItems) firstById.set(item.studentId, 'ABSENT');
  for (const item of baselineReport.issueItems) firstById.set(item.studentId, 'ISSUE');

  const presentSet = new Set(baselineReport.presentNames.map((n) => n.trim()));

  const diffs: AttendanceDiffItem[] = [];

  for (const entry of secondEntries) {
    let firstStatus: AttendanceStatus | null = firstById.get(entry.student.id) ?? null;
    if (!firstStatus && presentSet.has(entry.student.name.trim())) {
      firstStatus = 'PRESENT';
    }
    if (!firstStatus) {
      // Student was not present in the first servant's report — skip or treat as non-overlapping
      continue;
    }
    if (firstStatus !== entry.status) {
      diffs.push({
        studentId: entry.student.id,
        studentNumber: entry.student.studentNumber,
        studentName: entry.student.name,
        firstStatus: statusLabelAr(firstStatus, reportTypeKey),
        secondStatus: statusLabelAr(entry.status, reportTypeKey),
        note: entry.status === 'ISSUE' ? entry.note : undefined,
      });
    }
  }

  return diffs;
}

export interface VisitationSessionEntry {
  student: Pick<Student, 'id' | 'name' | 'studentNumber'>;
  status: VisitationStatus;
  note?: string;
}

export function buildVisitationV1Text(params: {
  servantName: string;
  scopeLabel: string;
  entries: VisitationSessionEntry[];
}): string {
  const { servantName, scopeLabel, entries } = params;
  const lines: string[] = [
    '[VISITATION_V1]',
    `S|${cleanWireField(servantName)}`,
    `B|${cleanWireField(scopeLabel)}`,
  ];

  for (const entry of entries) {
    const sId = cleanWireField(entry.student.id);
    const sNum = entry.student.studentNumber;
    const sName = cleanWireField(entry.student.name);
    if (entry.status === 'VISITED') {
      lines.push(`V|${sId}|${sNum}|${sName}`);
    } else if (entry.status === 'FOLLOWUP') {
      lines.push(`F|${sId}|${sNum}|${sName}|${cleanWireField(entry.note || 'يحتاج متابعة')}`);
    } else {
      lines.push(`U|${sId}|${sNum}|${sName}`);
    }
  }

  return lines.join('\n').slice(0, 3950);
}

export function parseVisitationReport(text: string): ParsedVisitationV1 | null {
  if (!text) return null;
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0 || rawLines[0] !== '[VISITATION_V1]') return null;

  const parsed: ParsedVisitationV1 = {
    servantName: '',
    scopeLabel: 'كل الفصل',
    visited: [],
    followup: [],
    notVisited: [],
  };

  for (let i = 1; i < rawLines.length; i++) {
    const parts = rawLines[i].split('|');
    const tag = parts[0];
    switch (tag) {
      case 'S':
        parsed.servantName = parts[1] ?? '';
        break;
      case 'B':
        parsed.scopeLabel = parts[1] || 'كل الفصل';
        break;
      case 'V':
        parsed.visited.push({
          studentId: parts[1] ?? '',
          studentNumber: Number.parseInt(parts[2] ?? '0', 10) || 0,
          studentName: parts[3] ?? '',
        });
        break;
      case 'F':
        parsed.followup.push({
          studentId: parts[1] ?? '',
          studentNumber: Number.parseInt(parts[2] ?? '0', 10) || 0,
          studentName: parts[3] ?? '',
          note: parts[4] ?? '',
        });
        break;
      case 'U':
        parsed.notVisited.push({
          studentId: parts[1] ?? '',
          studentNumber: Number.parseInt(parts[2] ?? '0', 10) || 0,
          studentName: parts[3] ?? '',
        });
        break;
      default:
        break;
    }
  }

  return parsed;
}

export function groupItemsByBlock(
  items: Array<{ studentId: string; studentNumber: number }>,
  students: Student[],
  blocks: ServantBlock[]
): BlockSummaryGroup[] {
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const blockMap = new Map(blocks.map((b) => [b.id, b]));
  const grouped = new Map<string, BlockSummaryGroup>();

  for (const item of items) {
    const student = studentMap.get(item.studentId);
    const blockId = student?.blockId || '';
    const block = blockId ? blockMap.get(blockId) : undefined;
    const key = block ? block.id : '__unassigned__';
    const existing = grouped.get(key) ?? {
      blockId: key,
      blockName: block ? block.servantName : 'بدون بلوك',
      colorHex: block ? block.colorHex : '#686E7E',
      count: 0,
      numbers: [],
    };
    existing.count += 1;
    if (item.studentNumber > 0) {
      existing.numbers.push(item.studentNumber);
    }
    grouped.set(key, existing);
  }

  return Array.from(grouped.values()).map((g) => ({
    ...g,
    numbers: [...g.numbers].sort((a, b) => a - b),
  }));
}
