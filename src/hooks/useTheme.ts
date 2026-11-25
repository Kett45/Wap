import { useEffect } from 'react';
import type { ThemeId, UiScaleMode } from '../types/kam';

export type KamFontFamily = 'cairo' | 'tajawal' | 'ibm' | 'readex';
export type KamFontWeight = 'normal' | 'medium' | 'bold';

export const UI_SCALE_MIN = 0.7;
export const UI_SCALE_MAX = 1.65;

export const UI_SCALE_PRESETS: Array<{ labelAr: string; value: number }> = [
  { labelAr: 'صغير', value: 0.85 },
  { labelAr: 'قياسي', value: 1.0 },
  { labelAr: 'كبير', value: 1.15 },
  { labelAr: 'كبير جداً', value: 1.3 },
  { labelAr: 'ضخم', value: 1.45 },
];

export const FONT_FAMILY_OPTIONS: Array<{
  id: KamFontFamily;
  labelAr: string;
  sampleAr: string;
  cssValue: string;
}> = [
  {
    id: 'cairo',
    labelAr: 'Cairo (افتراضي)',
    sampleAr: 'أبجد هوز ١٢٣',
    cssValue: "'Cairo', system-ui, -apple-system, sans-serif",
  },
  {
    id: 'tajawal',
    labelAr: 'Tajawal (ناعم)',
    sampleAr: 'أبجد هوز ١٢٣',
    cssValue: "'Tajawal', 'Cairo', system-ui, sans-serif",
  },
  {
    id: 'ibm',
    labelAr: 'IBM Arabic (واضح)',
    sampleAr: 'أبجد هوز ١٢٣',
    cssValue: "'IBM Plex Sans Arabic', 'Cairo', system-ui, sans-serif",
  },
  {
    id: 'readex',
    labelAr: 'Readex Pro (عصري)',
    sampleAr: 'أبجد هوز ١٢٣',
    cssValue: "'Readex Pro', 'Cairo', system-ui, sans-serif",
  },
];

export const FONT_WEIGHT_OPTIONS: Array<{ id: KamFontWeight; labelAr: string }> = [
  { id: 'normal', labelAr: 'خفيف' },
  { id: 'medium', labelAr: 'متوسط' },
  { id: 'bold', labelAr: 'واضح وعريض' },
];

const FONT_FAMILY_STORAGE_KEY = 'kam_local_font_family';
const FONT_WEIGHT_STORAGE_KEY = 'kam_local_font_weight';

export function getStoredFontFamily(): KamFontFamily {
  try {
    const raw = window.localStorage.getItem(FONT_FAMILY_STORAGE_KEY) as KamFontFamily | null;
    if (raw && FONT_FAMILY_OPTIONS.some((o) => o.id === raw)) return raw;
  } catch {
    // ignore storage errors
  }
  return 'cairo';
}

export function getStoredFontWeight(): KamFontWeight {
  try {
    const raw = window.localStorage.getItem(FONT_WEIGHT_STORAGE_KEY) as KamFontWeight | null;
    if (raw && FONT_WEIGHT_OPTIONS.some((o) => o.id === raw)) return raw;
  } catch {
    // ignore storage errors
  }
  return 'medium';
}

export function applyImmediateScale(mode: UiScaleMode | string | undefined, factor: number | undefined): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'MANUAL' && typeof factor === 'number' && Number.isFinite(factor)) {
    const clamped = Math.max(UI_SCALE_MIN, Math.min(UI_SCALE_MAX, factor));
    root.style.fontSize = `${(clamped * 16).toFixed(2)}px`;
    root.style.setProperty('--kam-scale', String(clamped));
  } else {
    root.style.fontSize = '16px';
    root.style.setProperty('--kam-scale', '1');
  }
}

export function applyImmediateTypography(family: KamFontFamily, weight: KamFontWeight): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const opt = FONT_FAMILY_OPTIONS.find((o) => o.id === family) ?? FONT_FAMILY_OPTIONS[0];
  root.style.setProperty('--kam-font-family', opt.cssValue);
  root.setAttribute('data-font-weight', weight);
}

export function saveAndApplyFontFamily(family: KamFontFamily): void {
  try {
    window.localStorage.setItem(FONT_FAMILY_STORAGE_KEY, family);
  } catch {
    // ignore storage errors
  }
  applyImmediateTypography(family, getStoredFontWeight());
}

export function saveAndApplyFontWeight(weight: KamFontWeight): void {
  try {
    window.localStorage.setItem(FONT_WEIGHT_STORAGE_KEY, weight);
  } catch {
    // ignore storage errors
  }
  applyImmediateTypography(getStoredFontFamily(), weight);
}

export function useThemeEffect(
  themeId: ThemeId | string | undefined,
  uiScaleMode: UiScaleMode | string | undefined,
  uiScaleFactor: number | undefined
) {
  useEffect(() => {
    const root = document.documentElement;
    const isLight = themeId === 'LIGHT';
    root.classList.toggle('dark', !isLight);
    root.dir = 'rtl';
    root.lang = 'ar';
  }, [themeId]);

  useEffect(() => {
    applyImmediateScale(uiScaleMode, uiScaleFactor);
  }, [uiScaleMode, uiScaleFactor]);

  useEffect(() => {
    applyImmediateTypography(getStoredFontFamily(), getStoredFontWeight());
  }, []);
}
