import type {
  CardDefinition,
  CardEvent,
  CardTypeId,
  CustomCardColorKey,
  CustomCardFrequency,
  DuplicateCardAlert,
  Group,
  StandardCardTypeId,
  Student,
} from '../types/kam';

export const BLOCK_COLOR_PRESETS = [
  { hex: '#3B82F6', nameAr: 'أزرق' },
  { hex: '#10B981', nameAr: 'أخضر زمردي' },
  { hex: '#8B5CF6', nameAr: 'بنفسجي' },
  { hex: '#F59E0B', nameAr: 'كهرماني' },
  { hex: '#F43F5E', nameAr: 'وردي' },
  { hex: '#06B6D4', nameAr: 'سماوي' },
  { hex: '#F97316', nameAr: 'برتقالي' },
] as const;

export const BLOCK_COLOR_PALETTE: string[] = BLOCK_COLOR_PRESETS.map((p) => p.hex);

export const COLOR_KEY_PALETTE: Record<
  CustomCardColorKey,
  { darkHex: string; lightHex: string; labelAr: string }
> = {
  EMERALD: { darkHex: '#22C57E', lightHex: '#159A5E', labelAr: 'زمردي' },
  SKY: { darkHex: '#38BDF8', lightHex: '#0284C7', labelAr: 'سماوي' },
  VIOLET: { darkHex: '#8B7CF6', lightHex: '#6D5CE7', labelAr: 'بنفسجي' },
  INDIGO: { darkHex: '#5E6AD2', lightHex: '#4B5CE5', labelAr: 'نيلي' },
  GOLD: { darkHex: '#EAB34B', lightHex: '#C98212', labelAr: 'ذهبي' },
  TEAL: { darkHex: '#2DD4BF', lightHex: '#0D9488', labelAr: 'فيروزي' },
  ROSE: { darkHex: '#F472B6', lightHex: '#DB2777', labelAr: 'وردي' },
};

export const STANDARD_CARDS: CardDefinition[] = [
  {
    id: 'ATTENDANCE',
    titleAr: 'الحضور',
    points: 3,
    icon: '✓',
    colorKey: 'EMERALD',
    darkHex: '#22C57E',
    lightHex: '#159A5E',
  },
  {
    id: 'QUIET',
    titleAr: 'الهدوء',
    points: 5,
    icon: '🤫',
    colorKey: 'SKY',
    darkHex: '#38BDF8',
    lightHex: '#0284C7',
  },
  {
    id: 'PARTICIPATION',
    titleAr: 'المشاركة',
    points: 2,
    icon: '✋',
    colorKey: 'VIOLET',
    darkHex: '#8B7CF6',
    lightHex: '#6D5CE7',
  },
  {
    id: 'PRAISE',
    titleAr: 'التسبحة',
    points: 10,
    icon: '🎵',
    colorKey: 'INDIGO',
    darkHex: '#5E6AD2',
    lightHex: '#4B5CE5',
  },
  {
    id: 'GOLD',
    titleAr: 'الذهب',
    points: 20,
    icon: '⭐',
    colorKey: 'GOLD',
    darkHex: '#EAB34B',
    lightHex: '#C98212',
  },
  {
    id: 'MEMORIZATION',
    titleAr: 'المحفوظات',
    points: 6,
    icon: '📖',
    colorKey: 'TEAL',
    darkHex: '#2DD4BF',
    lightHex: '#0D9488',
  },
  {
    id: 'CONFESSION',
    titleAr: 'الاعتراف',
    points: 4,
    icon: '🕊️',
    colorKey: 'ROSE',
    darkHex: '#F472B6',
    lightHex: '#DB2777',
  },
];

export const ALL_STANDARD_CARD_IDS: StandardCardTypeId[] = STANDARD_CARDS.map(
  (c) => c.id as StandardCardTypeId
);

export const STANDARD_CARD_POINTS_MAP: Record<StandardCardTypeId, number> = {
  ATTENDANCE: 3,
  QUIET: 5,
  PARTICIPATION: 2,
  PRAISE: 10,
  GOLD: 20,
  MEMORIZATION: 6,
  CONFESSION: 4,
};

export function getCustomElderCardDef(group?: Group | null): CardDefinition {
  const colorKey = (
    group?.customCardColorKey && group.customCardColorKey in COLOR_KEY_PALETTE
      ? group.customCardColorKey
      : 'GOLD'
  ) as CustomCardColorKey;
  const palette = COLOR_KEY_PALETTE[colorKey];
  const points =
    typeof group?.customCardPoints === 'number'
      ? Math.max(0, Math.min(100, Math.round(group.customCardPoints)))
      : 15;
  return {
    id: 'CUSTOM_ELDER',
    titleAr: group?.customCardName?.trim() || 'كارت القمداء',
    points,
    icon: group?.customCardIcon?.trim() || '🏅',
    colorKey,
    darkHex: palette.darkHex,
    lightHex: palette.lightHex,
  };
}

export function getAllCardDefinitions(group?: Group | null): CardDefinition[] {
  if (group?.customCardEnabled) {
    return [...STANDARD_CARDS, getCustomElderCardDef(group)];
  }
  return [...STANDARD_CARDS];
}

export function getCardDefinition(cardType: CardTypeId, group?: Group | null): CardDefinition {
  if (cardType === 'CUSTOM_ELDER') return getCustomElderCardDef(group);
  return STANDARD_CARDS.find((c) => c.id === cardType) ?? STANDARD_CARDS[0];
}

export function isValidCardPointsPair(cardType: CardTypeId, points: number): boolean {
  if (!Number.isInteger(points)) return false;
  if (cardType === 'CUSTOM_ELDER') return points >= 0 && points <= 100;
  return STANDARD_CARD_POINTS_MAP[cardType] === points;
}

export function buildAttendanceDocId(weekKey: string, studentId: string): string {
  return `${weekKey}_${studentId}`;
}

export function buildMonthlyBalanceDocId(monthKey: string, studentId: string): string {
  return `${monthKey}_${studentId}`;
}

export function buildDmChatId(uid1: string, uid2: string): string {
  const [a, b] = [uid1, uid2].sort();
  return `dm_${a}_${b}`;
}

export function isGroupPrimaryAdmin(group: Group | null | undefined, uid: string | null | undefined): boolean {
  if (!group || !uid) return false;
  return group.adminId === uid;
}

export function isGroupAdmin(group: Group | null | undefined, uid: string | null | undefined): boolean {
  if (!group || !uid) return false;
  return group.adminId === uid || (group.assistantAdminIds?.includes(uid) ?? false);
}

export function canUserUndoCardEvent(
  group: Group | null | undefined,
  uid: string | null | undefined,
  event: CardEvent
): boolean {
  if (!group || !uid) return false;
  if (isGroupAdmin(group, uid)) return true;
  return group.allowServantUndo && event.servantId === uid;
}

export interface CardAwardValidationResult {
  allowed: boolean;
  reasonAr?: string;
}

export function validateCardAward(params: {
  group: Group;
  studentId: string;
  cardType: CardTypeId;
  points: number;
  weekKey: string;
  monthKey: string;
  existingEvents: CardEvent[];
  currentMonthPoints: number;
}): CardAwardValidationResult {
  const { group, studentId, cardType, points, weekKey, monthKey, existingEvents, currentMonthPoints } = params;

  if (!isValidCardPointsPair(cardType, points)) {
    return { allowed: false, reasonAr: 'قيمة النقاط لا تطابق نوع الكارت.' };
  }

  const studentEvents = existingEvents.filter((e) => e.studentId === studentId && e.cardType === cardType);

  if (cardType === 'CUSTOM_ELDER') {
    if (!group.customCardEnabled) {
      return { allowed: false, reasonAr: 'هذا الكارت غير مفعّل حالياً من إعدادات الفصل.' };
    }
    const freq: CustomCardFrequency = group.customCardFrequency ?? 'WEEKLY';
    if (freq === 'WEEKLY' && studentEvents.some((e) => e.weekKey === weekKey)) {
      return { allowed: false, reasonAr: 'تم منح هذا الكارت للطفل بالفعل في هذا الأسبوع.' };
    }
    if (freq === 'MONTHLY' && studentEvents.some((e) => e.monthKey === monthKey)) {
      return { allowed: false, reasonAr: 'تم منح هذا الكارت للطفل بالفعل في هذا الشهر.' };
    }
    if (freq === 'ONCE_EVER' && studentEvents.length > 0) {
      return { allowed: false, reasonAr: 'تم منح هذا الكارت للطفل من قبل (يُمنح مرة واحدة فقط).' };
    }
  } else if (group.enforceWeeklyCardLimit) {
    if (studentEvents.some((e) => e.weekKey === weekKey)) {
      return { allowed: false, reasonAr: 'سياسة الفصل تمنع تكرار نفس الكارت للطفل في نفس الأسبوع.' };
    }
  }

  if (group.maxMonthlyPoints > 0 && currentMonthPoints + points > group.maxMonthlyPoints) {
    return {
      allowed: false,
      reasonAr: `تجاوز الحد الأقصى الشهري للفصل (${group.maxMonthlyPoints} نقطة).`,
    };
  }

  return { allowed: true };
}

export function detectDuplicateCardAlerts(
  cardEvents: CardEvent[],
  weekKey: string
): DuplicateCardAlert[] {
  const byKey = new Map<string, CardEvent[]>();
  for (const ev of cardEvents) {
    if (ev.weekKey !== weekKey) continue;
    const key = `${ev.studentId}__${ev.cardType}__${ev.weekKey}`;
    const list = byKey.get(key) ?? [];
    list.push(ev);
    byKey.set(key, list);
  }

  const alerts: DuplicateCardAlert[] = [];
  for (const [key, events] of byKey.entries()) {
    if (events.length < 2) continue;
    const uniqueServants = new Set(events.map((e) => e.servantId));
    if (uniqueServants.size >= 2 || events.length >= 2) {
      alerts.push({
        key,
        studentId: events[0].studentId,
        studentName: events[0].studentName,
        cardType: events[0].cardType,
        weekKey: events[0].weekKey,
        events,
      });
    }
  }
  return alerts;
}

export function getEffectiveStudentPosition(student: Pick<Student, 'position' | 'sortOrder' | 'studentNumber'>): number {
  if (typeof student.position === 'number' && student.position !== 0) {
    return student.position;
  }
  return student.sortOrder * 1000 + student.studentNumber;
}

export function computeFractionalPosition(prevPos: number | null, nextPos: number | null): number {
  if (prevPos === null && nextPos === null) return 1000;
  if (prevPos === null && nextPos !== null) return nextPos - 1000;
  if (prevPos !== null && nextPos === null) return prevPos + 1000;
  return ((prevPos as number) + (nextPos as number)) / 2;
}

export function sortStudentsByPosition<T extends Pick<Student, 'position' | 'sortOrder' | 'studentNumber'>>(
  students: T[]
): T[] {
  return [...students].sort((a, b) => getEffectiveStudentPosition(a) - getEffectiveStudentPosition(b));
}

export function isInviteTokenValid(group: Group, enteredToken: string, nowMs: number = Date.now()): {
  valid: boolean;
  reasonAr?: string;
} {
  if (!group.dailyInviteToken) {
    return { valid: true };
  }
  if (!enteredToken || enteredToken.toUpperCase() !== group.dailyInviteToken.toUpperCase()) {
    return { valid: false, reasonAr: 'رمز الدعوة اليومي غير صحيح. اطلب الكود المحدث من أمين الفصل.' };
  }
  const updatedAt = group.inviteCodeUpdatedAtMillis ?? 0;
  if (updatedAt > 0 && nowMs - updatedAt > 24 * 60 * 60 * 1000) {
    return { valid: false, reasonAr: 'انتهت صلاحية كود الدعوة اليومي (أكثر من 24 ساعة).' };
  }
  return { valid: true };
}
