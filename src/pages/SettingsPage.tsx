import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Cloud,
  Download,
  Eye,
  EyeOff,
  LogOut,
  Minus,
  Moon,
  Phone,
  Plus,
  ShieldAlert,
  Sparkles,
  Sun,
  Trash2,
  Type,
} from 'lucide-react';
import { useKam } from '../context/KamContext';
import { AvatarBadge } from '../components/ui/AvatarBadge';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  ALL_STANDARD_CARD_IDS,
  COLOR_KEY_PALETTE,
  STANDARD_CARDS,
} from '../lib/kamRules';
import { compressImageFile } from '../lib/media';
import {
  applyImmediateScale,
  FONT_FAMILY_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  getStoredFontFamily,
  getStoredFontWeight,
  saveAndApplyFontFamily,
  saveAndApplyFontWeight,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  UI_SCALE_PRESETS,
  type KamFontFamily,
  type KamFontWeight,
} from '../hooks/useTheme';
import type { CustomCardColorKey, CustomCardFrequency } from '../types/kam';

const COUNTRY_CODES = [
  { code: '+20', label: '🇪🇬 +20 مصر' },
  { code: '+966', label: '🇸🇦 +966 السعودية' },
  { code: '+971', label: '🇦🇪 +971 الإمارات' },
  { code: '+965', label: '🇰🇼 +965 الكويت' },
  { code: '+962', label: '🇯🇴 +962 الأردن' },
  { code: '+1', label: '🇺🇸 +1 أمريكا/كندا' },
  { code: '+61', label: '🇦🇺 +61 أستراليا' },
  { code: '+44', label: '🇬🇧 +44 بريطانيا' },
  { code: '+49', label: '🇩🇪 +49 ألمانيا' },
  { code: '+33', label: '🇫🇷 +33 فرنسا' },
];

export const SettingsPage: React.FC = () => {
  const {
    userProfile,
    group,
    blocks,
    members,
    isAdmin,
    isPrimaryAdmin,
    syncStatus,
    updateProfile,
    updatePolicies,
    saveOwnMemberProfile,
    leaveActiveGroup,
    deleteActiveGroup,
    signOut,
    showToast,
  } = useKam();

  const { isInstallable, isInstalled, isIOS, triggerInstall } = usePWAInstall();

  const myMember = members.find((m) => m.uid === userProfile?.userId);
  const myAvatar = myMember?.avatarBase64 || myMember?.avatar || '';

  const [displayName, setDisplayName] = useState(userProfile?.displayName ?? '');
  const [countryCode, setCountryCode] = useState('+20');
  const [phone, setPhone] = useState(myMember?.primaryPhone || myMember?.phone || '');
  const [secondaryPhone, setSecondaryPhone] = useState(myMember?.secondaryPhone || '');
  const [showPhone, setShowPhone] = useState(myMember?.showPhone ?? false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  // Instant-response manual UI scale & local font preferences
  const [scaleDraft, setScaleDraft] = useState<number>(userProfile?.uiScaleFactor ?? 1.0);
  const [fontFamily, setFontFamily] = useState<KamFontFamily>(() => getStoredFontFamily());
  const [fontWeight, setFontWeight] = useState<KamFontWeight>(() => getStoredFontWeight());
  const scaleDebounceRef = useRef<number | null>(null);

  // Admin custom card draft
  const [customEnabled, setCustomEnabled] = useState(Boolean(group?.customCardEnabled));
  const [customName, setCustomName] = useState(group?.customCardName || 'كارت القمداء');
  const [customPoints, setCustomPoints] = useState(group?.customCardPoints ?? 15);
  const [customIcon, setCustomIcon] = useState(group?.customCardIcon || '🏅');
  const [customColor, setCustomColor] = useState<CustomCardColorKey>(
    (group?.customCardColorKey as CustomCardColorKey) || 'GOLD'
  );
  const [customFreq, setCustomFreq] = useState<CustomCardFrequency>(
    group?.customCardFrequency || 'WEEKLY'
  );
  const [maxMonthlyDraft, setMaxMonthlyDraft] = useState(group?.maxMonthlyPoints ?? 0);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);

  useEffect(() => {
    setDisplayName(userProfile?.displayName ?? '');
  }, [userProfile?.displayName]);

  useEffect(() => {
    if (typeof userProfile?.uiScaleFactor === 'number') {
      setScaleDraft(userProfile.uiScaleFactor);
    }
  }, [userProfile?.uiScaleFactor]);

  useEffect(() => {
    setPhone(myMember?.primaryPhone || myMember?.phone || '');
    setSecondaryPhone(myMember?.secondaryPhone || '');
    setShowPhone(myMember?.showPhone ?? false);
  }, [myMember?.primaryPhone, myMember?.phone, myMember?.secondaryPhone, myMember?.showPhone]);

  useEffect(() => {
    if (!group) return;
    setCustomEnabled(Boolean(group.customCardEnabled));
    setCustomName(group.customCardName || 'كارت القمداء');
    setCustomPoints(group.customCardPoints ?? 15);
    setCustomIcon(group.customCardIcon || '🏅');
    setCustomColor((group.customCardColorKey as CustomCardColorKey) || 'GOLD');
    setCustomFreq(group.customCardFrequency || 'WEEKLY');
    setMaxMonthlyDraft(group.maxMonthlyPoints ?? 0);
  }, [group]);

  useEffect(() => {
    return () => {
      if (scaleDebounceRef.current) window.clearTimeout(scaleDebounceRef.current);
    };
  }, []);

  if (!userProfile) return null;

  const isLight = userProfile.themeId === 'LIGHT';
  const enabledCards = userProfile.enabledCards ?? ALL_STANDARD_CARD_IDS;
  const hiddenBlockIds = userProfile.hiddenBlockIds ?? [];
  const isManualScale = userProfile.uiScaleMode === 'MANUAL';

  const commitScaleFactor = (nextFactor: number, immediatePersist = false) => {
    const clamped = Math.round(Math.max(UI_SCALE_MIN, Math.min(UI_SCALE_MAX, nextFactor)) * 100) / 100;
    setScaleDraft(clamped);
    applyImmediateScale('MANUAL', clamped);

    if (scaleDebounceRef.current) window.clearTimeout(scaleDebounceRef.current);
    if (immediatePersist) {
      updateProfile({ uiScaleMode: 'MANUAL', uiScaleFactor: clamped }).catch(() => {});
    } else {
      scaleDebounceRef.current = window.setTimeout(() => {
        updateProfile({ uiScaleMode: 'MANUAL', uiScaleFactor: clamped }).catch(() => {});
      }, 320);
    }
  };

  const handleSetAutoScale = () => {
    if (scaleDebounceRef.current) window.clearTimeout(scaleDebounceRef.current);
    setScaleDraft(1.0);
    applyImmediateScale('AUTO', 1.0);
    updateProfile({ uiScaleMode: 'AUTO', uiScaleFactor: 1.0 }).catch(() => {});
  };

  const handlePickFontFamily = (next: KamFontFamily) => {
    setFontFamily(next);
    saveAndApplyFontFamily(next);
  };

  const handlePickFontWeight = (next: KamFontWeight) => {
    setFontWeight(next);
    saveAndApplyFontWeight(next);
  };

  const toggleEnabledCard = async (cardId: string) => {
    const next = enabledCards.includes(cardId)
      ? enabledCards.filter((c) => c !== cardId)
      : [...enabledCards, cardId];
    await updateProfile({ enabledCards: next });
  };

  const toggleHiddenBlock = async (blockId: string) => {
    const next = hiddenBlockIds.includes(blockId)
      ? hiddenBlockIds.filter((id) => id !== blockId)
      : [...hiddenBlockIds, blockId];
    await updateProfile({ hiddenBlockIds: next });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try {
      const compressed = await compressImageFile(file, { maxDim: 512, maxChars: 140000 });
      await saveOwnMemberProfile({
        avatarBase64: compressed.base64Raw,
        avatarHash: compressed.hash,
        hasAvatar: true,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر رفع صورة البروفايل', 'error');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarBusy(true);
    try {
      await saveOwnMemberProfile({
        avatarBase64: '',
        avatarHash: '',
        hasAvatar: false,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر حذف الصورة', 'error');
    } finally {
      setAvatarBusy(false);
    }
  };

  const normalizeWithCountry = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('+')) return trimmed;
    const digits = trimmed.replace(/^0+/, '');
    return `${countryCode}${digits}`;
  };

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formattedPrimary = normalizeWithCountry(phone);
      const formattedSecondary = normalizeWithCountry(secondaryPhone);
      await saveOwnMemberProfile({
        displayName: displayName.trim() || userProfile.displayName,
        phone: formattedPrimary,
        primaryPhone: formattedPrimary,
        secondaryPhone: formattedSecondary,
        showPhone,
        phoneHidden: !showPhone,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر حفظ بياناتك', 'error');
    }
  };

  const handleSaveCustomCard = async (e: React.FormEvent) => {
    e.preventDefault();
    await updatePolicies({
      customCardEnabled: customEnabled,
      customCardName: customName.trim() || 'كارت القمداء',
      customCardPoints: Math.max(0, Math.min(100, Number(customPoints) || 0)),
      customCardIcon: customIcon.trim() || '🏅',
      customCardColorKey: customColor,
      customCardFrequency: customFreq,
    });
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="pb-2 border-b border-[var(--kam-border)]">
        <h1 className="text-lg font-extrabold">الإعدادات والتفضيلات</h1>
        <p className="text-xs text-[var(--kam-text-muted)]">
          تخصيص بروفايلك، العمل بدون إنترنت، الخطوط وأحجام الواجهة، وسياسات الفصل
        </p>
      </div>

      {/* PWA Install & Offline Persistence Card */}
      <section className="rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-primary)]/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold flex items-center gap-2">
            <Cloud className="w-4 h-4 text-[var(--kam-primary)]" />
            <span>العمل بدون إنترنت وتثبيت التطبيق (PWA)</span>
          </h2>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
              syncStatus === 'OFFLINE'
                ? 'bg-[#E5A436]/20 text-[#E5A436]'
                : syncStatus === 'SYNCING'
                ? 'bg-[var(--kam-primary)]/20 text-[var(--kam-primary)]'
                : 'bg-[#2CB578]/20 text-[#2CB578]'
            }`}
          >
            {syncStatus === 'OFFLINE'
              ? 'وضع بدون إنترنت'
              : syncStatus === 'SYNCING'
              ? 'جاري المزامنة...'
              : 'مزامنة IndexedDB مفعّلة ✓'}
          </span>
        </div>

        <p className="text-xs text-[var(--kam-text-secondary)] leading-relaxed">
          يتم حفظ جميع بيانات الفصل، الحضور، الكروت، والافتقاد محلياً في المتصفح (IndexedDB) لتعمل بدون إنترنت، وتتم المزامنة تلقائياً فور عودة الاتصال بدون فقدان أو تكرار.
        </p>

        {!isInstalled && (
          <div className="pt-1">
            {isInstallable ? (
              <button
                type="button"
                onClick={() => triggerInstall()}
                className="w-full h-11 rounded-xl bg-[var(--kam-primary)] text-[var(--kam-on-primary)] font-bold text-xs flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>تثبيت التطبيق على الشاشة الرئيسية (يعمل بدون إنترنت)</span>
              </button>
            ) : isIOS ? (
              <div className="p-2.5 rounded-xl bg-[var(--kam-surface-variant)] text-xs text-[var(--kam-text-secondary)]">
                لتثبيت التطبيق على iPhone: اضغط على زر المشاركة في Safari ثم اختر{' '}
                <strong className="text-[var(--kam-text-primary)]">إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* Personal Profile, Servant Avatar & Phones */}
      <section className="rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-extrabold flex items-center gap-2">
          <Phone className="w-4 h-4 text-[var(--kam-success)]" />
          <span>ملفي الشخصي وصورة البروفايل</span>
        </h2>

        {/* Servant Avatar Picker */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-2xl bg-[var(--kam-surface-variant)]/55 border border-[var(--kam-border)]">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <AvatarBadge
                directBase64={myAvatar}
                name={displayName || userProfile.displayName}
                size="lg"
                online
              />
              <label
                className="absolute -bottom-1 -left-1 min-h-[30px] min-w-[30px] flex items-center justify-center rounded-full bg-[var(--kam-primary)] text-white cursor-pointer shadow"
                aria-label="تغيير صورة البروفايل"
              >
                <Camera className="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  disabled={avatarBusy}
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
            </div>
            <div>
              <div className="text-sm font-extrabold">{userProfile.displayName}</div>
              <div className="text-xs text-[var(--kam-text-muted)]">
                تظهر صورتك لباقي خدام الفصل في البلوكات والشات
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[var(--kam-primary)] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
              <Camera className="w-3.5 h-3.5" />
              <span>{avatarBusy ? 'جاري الرفع...' : myAvatar ? 'تغيير الصورة' : 'رفع صورة'}</span>
              <input
                type="file"
                accept="image/*"
                disabled={avatarBusy}
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
            {myAvatar && (
              <button
                type="button"
                disabled={avatarBusy}
                onClick={handleRemoveAvatar}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-[var(--kam-danger)]/40 text-[var(--kam-danger)] text-xs font-bold hover:bg-[var(--kam-danger)]/10"
              >
                حذف
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSavePersonal} className="space-y-3.5">
          <div>
            <label
              htmlFor="prof-name"
              className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1"
            >
              الاسم الظاهر في الفصل
            </label>
            <input
              id="prof-name"
              type="text"
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="prof-country-code"
              className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1"
            >
              كود الدولة لأرقام الهاتف والواتساب
            </label>
            <select
              id="prof-country-code"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs font-bold"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="prof-phone"
                className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1"
              >
                رقم الهاتف الأساسي / واتساب
              </label>
              <input
                id="prof-phone"
                type="tel"
                dir="ltr"
                maxLength={24}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm font-num text-right"
              />
            </div>

            <div>
              <label
                htmlFor="prof-phone-2"
                className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1"
              >
                رقم هاتف ثانوي (اختياري)
              </label>
              <input
                id="prof-phone-2"
                type="tel"
                dir="ltr"
                maxLength={24}
                value={secondaryPhone}
                onChange={(e) => setSecondaryPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm font-num text-right"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={showPhone}
                onChange={(e) => setShowPhone(e.target.checked)}
                className="w-4 h-4 accent-[var(--kam-primary)] shrink-0"
              />
              <span>إظهار أزرار الاتصال والواتساب للخدام في البلوك ودليل الفصل</span>
            </label>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[var(--kam-primary)] text-white text-xs font-bold shrink-0"
            >
              حفظ بياناتي
            </button>
          </div>
        </form>
      </section>

      {/* Typography, Manual Scale & Appearance Studio */}
      <section className="rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-extrabold flex items-center gap-2">
          <Type className="w-4 h-4 text-[var(--kam-primary)]" />
          <span>الخطوط وحجم الواجهة والمظهر</span>
        </h2>

        {/* Theme */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold">المظهر (داكن / فاتح)</div>
            <div className="text-[0.72rem] text-[var(--kam-text-muted)]">
              مريح للعين في القاعات والضوء النهاري
            </div>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)]">
            <button
              type="button"
              onClick={() => updateProfile({ themeId: 'DARK' })}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                !isLight ? 'bg-[var(--kam-primary)] text-white' : 'text-[var(--kam-text-secondary)]'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>داكن</span>
            </button>
            <button
              type="button"
              onClick={() => updateProfile({ themeId: 'LIGHT' })}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                isLight ? 'bg-[var(--kam-primary)] text-white' : 'text-[var(--kam-text-secondary)]'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>فاتح</span>
            </button>
          </div>
        </div>

        {/* Manual UI & Text Scale */}
        <div className="pt-3.5 border-t border-[var(--kam-border)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold">تكبير وتصغير الواجهة والخطوط بالكامل</div>
              <div className="text-[0.72rem] text-[var(--kam-text-muted)]">
                يغيّر حجم النصوص والأزرار والكروت في كل صفحات التطبيق فوراً
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSetAutoScale}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold ${
                  !isManualScale
                    ? 'bg-[var(--kam-primary)] text-white border-[var(--kam-primary)]'
                    : 'bg-[var(--kam-surface-variant)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
                }`}
              >
                تلقائي
              </button>
              <button
                type="button"
                onClick={() => commitScaleFactor(scaleDraft, true)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold font-num ${
                  isManualScale
                    ? 'bg-[var(--kam-primary)] text-white border-[var(--kam-primary)]'
                    : 'bg-[var(--kam-surface-variant)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
                }`}
              >
                يدوي ({Math.round(scaleDraft * 100)}%)
              </button>
            </div>
          </div>

          {/* Always-accessible slider & +/- buttons (automatically enters MANUAL on adjustment) */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-[var(--kam-surface-variant)]/55 border border-[var(--kam-border)]">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => commitScaleFactor(scaleDraft - 0.05, true)}
                aria-label="تصغير الواجهة"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] hover:border-[var(--kam-primary)]"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="range"
                aria-label="نسبة التكبير اليدوي"
                min={UI_SCALE_MIN}
                max={UI_SCALE_MAX}
                step={0.05}
                value={scaleDraft}
                onChange={(e) => commitScaleFactor(Number(e.target.value), false)}
                className="flex-1 h-2 accent-[var(--kam-primary)] cursor-pointer"
              />
              <button
                type="button"
                onClick={() => commitScaleFactor(scaleDraft + 0.05, true)}
                aria-label="تكبير الواجهة"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] hover:border-[var(--kam-primary)]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5">
              {UI_SCALE_PRESETS.map((preset) => {
                const selected = isManualScale && Math.abs(scaleDraft - preset.value) < 0.02;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => commitScaleFactor(preset.value, true)}
                    className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-bold border transition-colors ${
                      selected
                        ? 'bg-[var(--kam-primary)] text-white border-[var(--kam-primary)]'
                        : 'bg-[var(--kam-surface)] border-[var(--kam-border)] text-[var(--kam-text-secondary)] hover:border-[var(--kam-primary)]'
                    }`}
                  >
                    {preset.labelAr}{' '}
                    <span className="font-num opacity-80">({Math.round(preset.value * 100)}%)</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Family & Weight Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-2">
              <div className="text-xs font-bold text-[var(--kam-text-secondary)]">نوع الخط العربي</div>
              <div className="grid grid-cols-2 gap-1.5">
                {FONT_FAMILY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handlePickFontFamily(opt.id)}
                    style={{ fontFamily: opt.cssValue }}
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-right transition-colors ${
                      fontFamily === opt.id
                        ? 'bg-[var(--kam-primary-container)] border-[var(--kam-primary)] text-[var(--kam-text-primary)]'
                        : 'bg-[var(--kam-surface-variant)]/50 border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.labelAr}</div>
                    <div className="text-[0.7rem] opacity-75">{opt.sampleAr}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-[var(--kam-text-secondary)]">سمك ووضوح الخط</div>
              <div className="grid grid-cols-3 gap-1.5">
                {FONT_WEIGHT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handlePickFontWeight(opt.id)}
                    className={`min-h-[44px] px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors ${
                      fontWeight === opt.id
                        ? 'bg-[var(--kam-primary)] text-white border-[var(--kam-primary)]'
                        : 'bg-[var(--kam-surface-variant)]/50 border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
                    }`}
                  >
                    {opt.labelAr}
                  </button>
                ))}
              </div>

              {/* Live Typography Preview Card */}
              <div className="p-3 rounded-xl bg-[var(--kam-surface-variant)]/70 border border-[var(--kam-border)] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">#14 كيرلس هاني</div>
                  <div className="text-xs text-[var(--kam-text-muted)]">معاينة حية للخط والحجم</div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-[var(--kam-primary)] text-white text-xs font-bold shrink-0">
                  ⭐ حضور +10
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--kam-border)]">
          <div>
            <div className="text-xs font-bold">الوضع المضغوط للقوائم</div>
            <div className="text-[0.72rem] text-[var(--kam-text-muted)]">
              عرض عدد أكبر من الأطفال في الشاشة
            </div>
          </div>
          <input
            type="checkbox"
            aria-label="تفعيل الوضع المضغوط"
            checked={Boolean(userProfile.compactViewMode)}
            onChange={(e) => updateProfile({ compactViewMode: e.target.checked })}
            className="w-5 h-5 accent-[var(--kam-primary)]"
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--kam-border)]">
          <div>
            <div className="text-xs font-bold">زر الإضافة العائم</div>
            <div className="text-[0.72rem] text-[var(--kam-text-muted)]">
              إظهار زر (+) السريع في الرئيسية
            </div>
          </div>
          <input
            type="checkbox"
            aria-label="إظهار زر الإضافة العائم"
            checked={userProfile.showFloatingAddButton !== false}
            onChange={(e) => updateProfile({ showFloatingAddButton: e.target.checked })}
            className="w-5 h-5 accent-[var(--kam-primary)]"
          />
        </div>
      </section>

      {/* Personal Enabled Cards */}
      <section className="rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-extrabold">الكروت الظاهرة لك شخصياً</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STANDARD_CARDS.map((card) => {
            const checked = enabledCards.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => toggleEnabledCard(card.id)}
                className={`min-h-[44px] px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-colors ${
                  checked
                    ? 'bg-[var(--kam-primary-container)] border-[var(--kam-primary)] text-[var(--kam-text-primary)]'
                    : 'bg-[var(--kam-surface-variant)] border-[var(--kam-border)] text-[var(--kam-text-muted)]'
                }`}
              >
                <span>
                  {card.icon} {card.titleAr}
                </span>
                <span className="font-num text-xs">+{card.points}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Personal Visible / Hidden Blocks */}
      {blocks.length > 0 && (
        <section className="rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-4 sm:p-5 space-y-3">
          <div>
            <h2 className="text-sm font-extrabold">البلوكات الظاهرة في شاشتك الرئيسية</h2>
            <p className="text-xs text-[var(--kam-text-muted)]">
              يمكنك إخفاء البلوكات التي لا تتابعها يومياً (يؤثر على شاشتك فقط)
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {blocks.map((blk) => {
              const hidden = hiddenBlockIds.includes(blk.id);
              return (
                <button
                  key={blk.id}
                  type="button"
                  onClick={() => toggleHiddenBlock(blk.id)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-colors ${
                    hidden
                      ? 'bg-[var(--kam-surface-variant)]/40 border-[var(--kam-border)] text-[var(--kam-text-muted)]'
                      : 'bg-[var(--kam-surface-variant)] border-[var(--kam-primary)]/40 text-[var(--kam-text-primary)]'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: blk.colorHex }}
                    />
                    <span className="truncate">{blk.servantName}</span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-[var(--kam-primary)]" />}
                    <span>{hidden ? 'مخفي' : 'ظاهر'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Admin Class Policies */}
      {isAdmin && group && (
        <>
          <section className="rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-4 sm:p-5 space-y-3.5">
            <h2 className="text-sm font-extrabold">سياسات الفصل (للأمين ومساعده)</h2>
            {(
              [
                ['allowServantUndo', 'السماح للخدام بالتراجع عن الكروت التي سجلها بنفسه', group.allowServantUndo],
                ['enforceWeeklyCardLimit', 'منع تكرار نفس الكارت لنفس الطفل في نفس الأسبوع', group.enforceWeeklyCardLimit],
                ['attendanceIsCardOnly', 'احتساب الحضور ككارت فقط', group.attendanceIsCardOnly],
                ['showLeaderboard', 'إظهار لوحة الصدارة لجميع الخدام', group.showLeaderboard],
                ['autoStudentNumber', 'الترقيم التلقائي للأطفال الجدد', group.autoStudentNumber],
              ] as const
            ).map(([key, label, value]) => (
              <label key={key} className="flex items-center justify-between gap-3 text-xs cursor-pointer py-1">
                <span className="font-semibold">{label}</span>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => updatePolicies({ [key]: e.target.checked })}
                  className="w-5 h-5 accent-[var(--kam-primary)] shrink-0"
                />
              </label>
            ))}

            <div className="pt-2 border-t border-[var(--kam-border)] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-bold">الحد الأقصى الشهري للنقاط (0 = بلا حد)</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={maxMonthlyDraft}
                  onChange={(e) => setMaxMonthlyDraft(Number(e.target.value))}
                  className="w-24 min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs font-num"
                />
                <button
                  type="button"
                  onClick={() => updatePolicies({ maxMonthlyPoints: maxMonthlyDraft })}
                  className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[var(--kam-primary)] text-white text-xs font-bold"
                >
                  تطبيق
                </button>
              </div>
            </div>
          </section>

          {/* Custom Elder Card (كارت القمداء) */}
          <section className="rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--kam-gold)]" />
                <span>إعدادات الكارت الإضافي (كارت القمداء)</span>
              </h2>
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={customEnabled}
                  onChange={(e) => setCustomEnabled(e.target.checked)}
                  className="w-5 h-5 accent-[var(--kam-primary)]"
                />
                <span>مفعّل</span>
              </label>
            </div>

            <form onSubmit={handleSaveCustomCard} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="cc-name" className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1">
                    اسم الكارت
                  </label>
                  <input
                    id="cc-name"
                    type="text"
                    maxLength={40}
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="cc-pts" className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1">
                    النقاط (0..100)
                  </label>
                  <input
                    id="cc-pts"
                    type="number"
                    min={0}
                    max={100}
                    value={customPoints}
                    onChange={(e) => setCustomPoints(Number(e.target.value))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs font-num"
                  />
                </div>
                <div>
                  <label htmlFor="cc-icon" className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1">
                    الإيموجي
                  </label>
                  <input
                    id="cc-icon"
                    type="text"
                    maxLength={12}
                    value={customIcon}
                    onChange={(e) => setCustomIcon(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cc-color" className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1">
                    لون الكارت
                  </label>
                  <select
                    id="cc-color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value as CustomCardColorKey)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs"
                  >
                    {(Object.keys(COLOR_KEY_PALETTE) as CustomCardColorKey[]).map((k) => (
                      <option key={k} value={k}>
                        {COLOR_KEY_PALETTE[k].labelAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cc-freq" className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1">
                    معدل التكرار المسموح
                  </label>
                  <select
                    id="cc-freq"
                    value={customFreq}
                    onChange={(e) => setCustomFreq(e.target.value as CustomCardFrequency)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs"
                  >
                    <option value="WEEKLY">مرة واحدة أسبوعياً</option>
                    <option value="MONTHLY">مرة واحدة شهرياً</option>
                    <option value="ONCE_EVER">مرة واحدة للأبد</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[var(--kam-primary)] text-white text-xs font-bold"
                >
                  حفظ إعدادات الكارت الإضافي
                </button>
              </div>
            </form>
          </section>
        </>
      )}

      {/* Danger Zone & Account */}
      <section className="rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!isPrimaryAdmin && group && (
            <button
              type="button"
              onClick={leaveActiveGroup}
              className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold text-[var(--kam-warning)] border border-[var(--kam-warning)]/40 hover:bg-[var(--kam-warning)]/10 flex items-center gap-1.5"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>مغادرة الفصل</span>
            </button>
          )}
          {isPrimaryAdmin && group && !confirmDeleteGroup && (
            <button
              type="button"
              onClick={() => setConfirmDeleteGroup(true)}
              className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold text-[var(--kam-danger)] border border-[var(--kam-danger)]/40 hover:bg-[var(--kam-danger)]/10 flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف الفصل</span>
            </button>
          )}
          {isPrimaryAdmin && group && confirmDeleteGroup && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  setConfirmDeleteGroup(false);
                  await deleteActiveGroup();
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold bg-[var(--kam-danger)] text-white"
              >
                تأكيد الحذف النهائي
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteGroup(false)}
                className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold border border-[var(--kam-border)]"
              >
                إلغاء
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={signOut}
          className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold border border-[var(--kam-border)] hover:border-[var(--kam-danger)] hover:text-[var(--kam-danger)] flex items-center gap-1.5"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </section>
    </div>
  );
};
