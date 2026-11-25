// SaturdayCalendarHelper + Astronomical Coptic Calendar (Calendar of the Martyrs)
// Every new week inside a month starts on day 1 of the month, and thereafter on every Saturday at 00:00.

export const ARABIC_GREGORIAN_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const;

export const COPTIC_MONTHS = [
  'توت',
  'بابه',
  'هاتور',
  'كيهك',
  'طوبة',
  'أمشير',
  'برمهات',
  'برمودة',
  'بشنس',
  'بؤونة',
  'أبيب',
  'مسرى',
  'النسيء',
] as const;

export interface CopticDate {
  year: number;
  month: number; // 1..13
  monthName: string;
  day: number; // 1..30 (or 1..6 for Nasie)
}

export interface SaturdayWeekInfo {
  weekKey: string; // YYYY-MM-W#
  monthKey: string; // YYYY-MM
  year: number;
  month: number; // 1..12
  weekNumber: number; // 1..6
  startDate: Date;
  endDate: Date;
  labelAr: string;
  copticRangeAr: string;
}

// Gregorian date -> Julian Day Number (Fliegel & Van Flandern algorithm)
export function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

// Coptic Era Epoch: JDN 1825030 = 1 Tout, Year 1 AM (29 August 284 AD Julian)
const COPTIC_EPOCH_JDN = 1825030;

export function gregorianToCoptic(date: Date): CopticDate {
  const jdn = gregorianToJdn(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const daysSinceEpoch = jdn - COPTIC_EPOCH_JDN;
  const cycle = Math.floor(daysSinceEpoch / 1461);
  const remInCycle = ((daysSinceEpoch % 1461) + 1461) % 1461;
  // In each 4-year Coptic cycle, years 1, 2, 3 have 365 days; year 4 (rem 1095..1460) has 366 days
  const yearInCycle = Math.min(3, Math.floor(remInCycle / 365));
  const dayOfYear = remInCycle - yearInCycle * 365;
  const year = cycle * 4 + yearInCycle + 1;
  const month = Math.floor(dayOfYear / 30) + 1; // 1..13
  const day = (dayOfYear % 30) + 1;
  return {
    year,
    month,
    monthName: COPTIC_MONTHS[month - 1] ?? 'توت',
    day,
  };
}

export function formatCopticDateAr(date: Date): string {
  const c = gregorianToCoptic(date);
  return `${c.day} ${c.monthName} ${c.year} ش`;
}

export function getCopticMonthsForGregorianMonth(year: number, month: number): string {
  const first = gregorianToCoptic(new Date(year, month - 1, 1));
  const last = gregorianToCoptic(new Date(year, month, 0));
  if (first.monthName === last.monthName) return first.monthName;
  return `${first.monthName} / ${last.monthName}`;
}

export function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getMonthKey(date: Date = new Date()): string {
  return formatMonthKey(date.getFullYear(), date.getMonth() + 1);
}

// Compute all Saturday-delimited weeks inside a Gregorian month.
// Week 1 starts on day 1; each subsequent week starts on every Saturday (dayOfWeek === 6).
export function getSaturdayWeeksInMonth(year: number, month: number): SaturdayWeekInfo[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthKey = formatMonthKey(year, month);
  const weeks: SaturdayWeekInfo[] = [];

  let startDay = 1;
  let weekNum = 1;

  for (let day = 1; day <= daysInMonth; day++) {
    const dt = new Date(year, month - 1, day);
    const isSaturday = dt.getDay() === 6;
    if (day > 1 && isSaturday) {
      const startDate = new Date(year, month - 1, startDay);
      const endDate = new Date(year, month - 1, day - 1);
      const cStart = gregorianToCoptic(startDate);
      const cEnd = gregorianToCoptic(endDate);
      const copticRangeAr =
        cStart.monthName === cEnd.monthName
          ? `${cStart.day}–${cEnd.day} ${cStart.monthName}`
          : `${cStart.day} ${cStart.monthName} – ${cEnd.day} ${cEnd.monthName}`;

      weeks.push({
        weekKey: `${monthKey}-W${weekNum}`,
        monthKey,
        year,
        month,
        weekNumber: weekNum,
        startDate,
        endDate,
        labelAr: `الأسبوع ${weekNum} (${startDay}–${day - 1} ${ARABIC_GREGORIAN_MONTHS[month - 1]})`,
        copticRangeAr,
      });
      startDay = day;
      weekNum += 1;
    }
  }

  // Final week of month
  const startDate = new Date(year, month - 1, startDay);
  const endDate = new Date(year, month - 1, daysInMonth);
  const cStart = gregorianToCoptic(startDate);
  const cEnd = gregorianToCoptic(endDate);
  const copticRangeAr =
    cStart.monthName === cEnd.monthName
      ? `${cStart.day}–${cEnd.day} ${cStart.monthName}`
      : `${cStart.day} ${cStart.monthName} – ${cEnd.day} ${cEnd.monthName}`;

  weeks.push({
    weekKey: `${monthKey}-W${weekNum}`,
    monthKey,
    year,
    month,
    weekNumber: weekNum,
    startDate,
    endDate,
    labelAr: `الأسبوع ${weekNum} (${startDay}–${daysInMonth} ${ARABIC_GREGORIAN_MONTHS[month - 1]})`,
    copticRangeAr,
  });

  return weeks;
}

export function getWeekInfoForDate(date: Date = new Date()): SaturdayWeekInfo {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weeks = getSaturdayWeeksInMonth(year, month);
  for (const w of weeks) {
    if (day >= w.startDate.getDate() && day <= w.endDate.getDate()) {
      return w;
    }
  }
  return weeks[weeks.length - 1];
}

export function getWeekKey(date: Date = new Date()): string {
  return getWeekInfoForDate(date).weekKey;
}

export function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number.parseInt(yStr, 10) || new Date().getFullYear();
  const month = Number.parseInt(mStr, 10) || new Date().getMonth() + 1;
  return { year, month: Math.min(12, Math.max(1, month)) };
}

export function parseWeekKey(weekKey: string): {
  year: number;
  month: number;
  weekNumber: number;
  monthKey: string;
} {
  const match = /^(\d{4})-(\d{2})-W(\d+)$/.exec(weekKey.trim());
  if (!match) {
    const now = getWeekInfoForDate(new Date());
    return {
      year: now.year,
      month: now.month,
      weekNumber: now.weekNumber,
      monthKey: now.monthKey,
    };
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const weekNumber = Number.parseInt(match[3], 10);
  return { year, month, weekNumber, monthKey: formatMonthKey(year, month) };
}

export function getWeekInfoByKey(weekKey: string): SaturdayWeekInfo | null {
  const { year, month, weekNumber } = parseWeekKey(weekKey);
  const weeks = getSaturdayWeeksInMonth(year, month);
  return weeks.find((w) => w.weekNumber === weekNumber) ?? weeks[0] ?? null;
}

export function shiftWeekKey(weekKey: string, deltaWeeks: number): SaturdayWeekInfo {
  const current = getWeekInfoByKey(weekKey) ?? getWeekInfoForDate(new Date());
  if (deltaWeeks === 0) return current;

  // Walk week-by-week across month boundaries reliably
  let cursor = current;
  const step = deltaWeeks > 0 ? 1 : -1;
  let remaining = Math.abs(deltaWeeks);

  while (remaining > 0) {
    const weeksInMonth = getSaturdayWeeksInMonth(cursor.year, cursor.month);
    const idx = weeksInMonth.findIndex((w) => w.weekKey === cursor.weekKey);
    const nextIdx = idx + step;
    if (nextIdx >= 0 && nextIdx < weeksInMonth.length) {
      cursor = weeksInMonth[nextIdx];
    } else if (step > 0) {
      const nextMonth = cursor.month === 12 ? 1 : cursor.month + 1;
      const nextYear = cursor.month === 12 ? cursor.year + 1 : cursor.year;
      const nextWeeks = getSaturdayWeeksInMonth(nextYear, nextMonth);
      cursor = nextWeeks[0];
    } else {
      const prevMonth = cursor.month === 1 ? 12 : cursor.month - 1;
      const prevYear = cursor.month === 1 ? cursor.year - 1 : cursor.year;
      const prevWeeks = getSaturdayWeeksInMonth(prevYear, prevMonth);
      cursor = prevWeeks[prevWeeks.length - 1];
    }
    remaining -= 1;
  }

  return cursor;
}

export function formatMonthTitleAr(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  const gName = ARABIC_GREGORIAN_MONTHS[month - 1] ?? '';
  const cName = getCopticMonthsForGregorianMonth(year, month);
  return `${gName} ${year} · ${cName}`;
}

export function getQuickWeekKeys(referenceDate: Date = new Date()): {
  thisWeek: SaturdayWeekInfo;
  lastWeek: SaturdayWeekInfo;
  twoWeeksAgo: SaturdayWeekInfo;
} {
  const thisWeek = getWeekInfoForDate(referenceDate);
  const lastWeek = shiftWeekKey(thisWeek.weekKey, -1);
  const twoWeeksAgo = shiftWeekKey(thisWeek.weekKey, -2);
  return { thisWeek, lastWeek, twoWeeksAgo };
}

export function getSelectableYears(referenceDate: Date = new Date()): number[] {
  const currentYear = referenceDate.getFullYear();
  const start = 2026;
  const end = Math.max(currentYear + 1, 2027);
  const years: number[] = [];
  for (let y = start; y <= end; y++) {
    years.push(y);
  }
  return years;
}
