import React, { useMemo, useState } from 'react';
import { Calendar, Check, ChevronDown, ChevronLeft, X } from 'lucide-react';
import {
  ARABIC_GREGORIAN_MONTHS,
  formatMonthKey,
  getCopticMonthsForGregorianMonth,
  getQuickWeekKeys,
  getSaturdayWeeksInMonth,
  getSelectableYears,
} from '../../lib/calendar';

interface CalendarTreeModalProps {
  open: boolean;
  onClose: () => void;
  selectedWeekKeys: string[];
  onApply: (weekKeys: string[]) => void;
  singleSelect?: boolean;
}

export const CalendarTreeModal: React.FC<CalendarTreeModalProps> = ({
  open,
  onClose,
  selectedWeekKeys,
  onApply,
  singleSelect = false,
}) => {
  const [draft, setDraft] = useState<string[]>(selectedWeekKeys);
  const years = useMemo(() => getSelectableYears(new Date()), []);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [expandedYear, setExpandedYear] = useState<number>(Math.max(2026, currentYear));
  const [expandedMonthKey, setExpandedMonthKey] = useState<string>(
    formatMonthKey(Math.max(2026, currentYear), currentMonth)
  );

  const quick = useMemo(() => getQuickWeekKeys(new Date()), []);

  React.useEffect(() => {
    if (open) setDraft(selectedWeekKeys);
  }, [open, selectedWeekKeys]);

  if (!open) return null;

  const toggleWeek = (wk: string) => {
    if (singleSelect) {
      onApply([wk]);
      onClose();
      return;
    }
    setDraft((prev) => (prev.includes(wk) ? prev.filter((x) => x !== wk) : [...prev, wk]));
  };

  const toggleWholeMonth = (year: number, month: number) => {
    const weeks = getSaturdayWeeksInMonth(year, month).map((w) => w.weekKey);
    if (singleSelect) {
      onApply([weeks[0]]);
      onClose();
      return;
    }
    const allSelected = weeks.every((w) => draft.includes(w));
    if (allSelected) {
      setDraft((prev) => prev.filter((x) => !weeks.includes(x)));
    } else {
      setDraft((prev) => Array.from(new Set([...prev, ...weeks])));
    }
  };

  const pickQuick = (wk: string) => {
    if (singleSelect) {
      onApply([wk]);
      onClose();
    } else {
      setDraft([wk]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="اختيار الفترة من التقويم"
    >
      <div className="w-full max-w-lg max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[var(--kam-surface)] border-t sm:border border-[var(--kam-border)] shadow-2xl overflow-hidden pb-safe">
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <span className="w-10 h-1 rounded-full bg-[var(--kam-border-strong)]" />
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--kam-border)]">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-[var(--kam-primary)]" />
            <h2 className="text-base font-bold">تقويم أسابيع السبت والقبطي</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق التقويم"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-[var(--kam-text-muted)] hover:bg-[var(--kam-surface-variant)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick week shortcuts */}
        <div className="px-5 py-3 border-b border-[var(--kam-border)] bg-[var(--kam-surface-variant)]/50 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => pickQuick(quick.thisWeek.weekKey)}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
              draft.length === 1 && draft[0] === quick.thisWeek.weekKey
                ? 'bg-[var(--kam-primary)] text-[var(--kam-on-primary)]'
                : 'bg-[var(--kam-surface)] border border-[var(--kam-border)] text-[var(--kam-text-primary)] hover:border-[var(--kam-primary)]'
            }`}
          >
            هذا الأسبوع
          </button>
          <button
            type="button"
            onClick={() => pickQuick(quick.lastWeek.weekKey)}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
              draft.length === 1 && draft[0] === quick.lastWeek.weekKey
                ? 'bg-[var(--kam-primary)] text-[var(--kam-on-primary)]'
                : 'bg-[var(--kam-surface)] border border-[var(--kam-border)] text-[var(--kam-text-primary)] hover:border-[var(--kam-primary)]'
            }`}
          >
            الأسبوع اللي فات
          </button>
          <button
            type="button"
            onClick={() => pickQuick(quick.twoWeeksAgo.weekKey)}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
              draft.length === 1 && draft[0] === quick.twoWeeksAgo.weekKey
                ? 'bg-[var(--kam-primary)] text-[var(--kam-on-primary)]'
                : 'bg-[var(--kam-surface)] border border-[var(--kam-border)] text-[var(--kam-text-primary)] hover:border-[var(--kam-primary)]'
            }`}
          >
            الأسبوع اللي قبله
          </button>
        </div>

        {/* Years -> Months + Coptic -> Saturday Weeks Tree */}
        <div className="flex-1 overflow-y-auto kam-scrollbar p-4 space-y-2">
          {years.map((year) => {
            const isYearOpen = expandedYear === year;
            return (
              <div
                key={year}
                className="rounded-xl border border-[var(--kam-border)] bg-[var(--kam-surface-variant)]/30 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedYear(isYearOpen ? -1 : year)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold hover:bg-[var(--kam-surface-variant)] transition-colors"
                >
                  <span className="font-num">{year}</span>
                  {isYearOpen ? (
                    <ChevronDown className="w-4 h-4 text-[var(--kam-text-muted)]" />
                  ) : (
                    <ChevronLeft className="w-4 h-4 text-[var(--kam-text-muted)]" />
                  )}
                </button>

                {isYearOpen && (
                  <div className="border-t border-[var(--kam-border)] divide-y divide-[var(--kam-border)]">
                    {ARABIC_GREGORIAN_MONTHS.map((mName, idx) => {
                      const monthNum = idx + 1;
                      const mKey = formatMonthKey(year, monthNum);
                      const isMonthOpen = expandedMonthKey === mKey;
                      const weeks = getSaturdayWeeksInMonth(year, monthNum);
                      const selectedCount = weeks.filter((w) => draft.includes(w.weekKey)).length;
                      const copticLabel = getCopticMonthsForGregorianMonth(year, monthNum);

                      return (
                        <div key={mKey} className="bg-[var(--kam-surface)]">
                          <div className="flex items-center justify-between px-4 py-2.5 gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedMonthKey(isMonthOpen ? '' : mKey)}
                              className="flex-1 flex items-center gap-2 text-right text-sm font-semibold"
                            >
                              {isMonthOpen ? (
                                <ChevronDown className="w-4 h-4 text-[var(--kam-text-muted)] shrink-0" />
                              ) : (
                                <ChevronLeft className="w-4 h-4 text-[var(--kam-text-muted)] shrink-0" />
                              )}
                              <span>{mName}</span>
                              <span className="text-xs text-[var(--kam-text-muted)] font-normal">
                                · {copticLabel}
                              </span>
                            </button>

                            {!singleSelect && (
                              <button
                                type="button"
                                onClick={() => toggleWholeMonth(year, monthNum)}
                                className="text-xs font-medium text-[var(--kam-primary)] hover:underline whitespace-nowrap shrink-0"
                              >
                                {selectedCount === weeks.length ? 'إلغاء الشهر' : 'تحديد الشهر'}
                              </button>
                            )}
                          </div>

                          {isMonthOpen && (
                            <div className="px-4 pb-3 pt-1 space-y-1.5 bg-[var(--kam-surface-variant)]/40">
                              {weeks.map((w) => {
                                const checked = draft.includes(w.weekKey);
                                return (
                                  <button
                                    key={w.weekKey}
                                    type="button"
                                    onClick={() => toggleWeek(w.weekKey)}
                                    className={`w-full min-h-[48px] flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors border ${
                                      checked
                                        ? 'bg-[var(--kam-primary-container)] border-[var(--kam-primary)] text-[var(--kam-text-primary)]'
                                        : 'bg-[var(--kam-surface)] border-[var(--kam-border)] text-[var(--kam-text-secondary)] hover:border-[var(--kam-border-strong)]'
                                    }`}
                                  >
                                    <div className="flex flex-col items-start gap-0.5 text-right">
                                      <span className="font-semibold text-[var(--kam-text-primary)]">
                                        {w.labelAr}
                                      </span>
                                      <span className="text-[0.7rem] text-[var(--kam-text-muted)]">
                                        القبطي: {w.copticRangeAr} · <span className="font-num">{w.weekKey}</span>
                                      </span>
                                    </div>
                                    <span
                                      className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                                        checked
                                          ? 'bg-[var(--kam-primary)] border-[var(--kam-primary)] text-white'
                                          : 'border-[var(--kam-border-strong)]'
                                      }`}
                                    >
                                      {checked && <Check className="w-3.5 h-3.5" />}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!singleSelect && (
          <div className="px-5 py-3.5 border-t border-[var(--kam-border)] flex items-center justify-between gap-3 bg-[var(--kam-surface)]">
            <span className="text-xs text-[var(--kam-text-secondary)] font-num">
              المحدد: {draft.length} أسبوع
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--kam-border)] hover:bg-[var(--kam-surface-variant)]"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={draft.length === 0}
                onClick={() => {
                  if (draft.length > 0) {
                    onApply(draft);
                    onClose();
                  }
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold bg-[var(--kam-primary)] text-[var(--kam-on-primary)] disabled:opacity-50"
              >
                تطبيق الفترة
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
