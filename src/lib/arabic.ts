// Arabic text normalization, initials extraction, invite code parsing, and digit formatting

const TASHKEEL_AND_TATWEEL_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

export function normalizeArabicName(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .toLowerCase()
    .replace(TASHKEEL_AND_TATWEEL_REGEX, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\s+/g, ' ');
}

export function extractInitials(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'ط';
  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2);
  }
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.slice(0, 4);
}

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => ARABIC_INDIC_DIGITS[Number(d)] ?? d);
}

export interface ParsedInviteCode {
  inviteCode: string;
  dailyToken: string;
}

export function parseInviteCodeInput(rawInput: string): ParsedInviteCode {
  const cleaned = rawInput.replace(/\s+/g, '').toUpperCase();
  if (!cleaned) return { inviteCode: '', dailyToken: '' };

  if (cleaned.includes('-')) {
    const [code, ...rest] = cleaned.split('-');
    return {
      inviteCode: code || '',
      dailyToken: rest.join('') || '',
    };
  }

  if (cleaned.startsWith('KAM') && cleaned.length > 8) {
    return {
      inviteCode: cleaned.slice(0, 8),
      dailyToken: cleaned.slice(8),
    };
  }

  return {
    inviteCode: cleaned,
    dailyToken: '',
  };
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(): string {
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `KAM${suffix}`;
}

export function generateDailyToken(): string {
  let token = '';
  for (let i = 0; i < 4; i++) {
    token += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return token;
}

export function formatRelativeTimeAr(timestamp: unknown): string {
  const ms = toMillis(timestamp);
  if (!ms) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'الآن';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `منذ ${diffMin} د`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `منذ ${diffHour} س`;
  const d = new Date(ms);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function formatClockAr(timestamp: unknown): string {
  const ms = toMillis(timestamp);
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

export function toMillis(timestamp: unknown): number {
  if (!timestamp) return 0;
  if (typeof timestamp === 'number') return timestamp;
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp === 'object' && timestamp !== null) {
    const maybeTs = timestamp as { toMillis?: () => number; seconds?: number };
    if (typeof maybeTs.toMillis === 'function') return maybeTs.toMillis();
    if (typeof maybeTs.seconds === 'number') return maybeTs.seconds * 1000;
  }
  return 0;
}

export function isServantOnline(lastSeenAt: unknown, nowMs: number = Date.now()): boolean {
  const ms = toMillis(lastSeenAt);
  if (!ms) return false;
  return nowMs - ms < 3 * 60 * 1000;
}
