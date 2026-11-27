import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Send,
  Star,
  Undo2,
  X,
} from 'lucide-react';
import { useKam } from '../context/KamContext';
import { AvatarBadge } from '../components/ui/AvatarBadge';
import { SwipeableCard } from '../components/ui/SwipeableCard';
import {
  ALL_STANDARD_CARD_IDS,
  buildMonthlyBalanceDocId,
  canUserUndoCardEvent,
  getAllCardDefinitions,
  getCardDefinition,
  sortStudentsByPosition,
} from '../lib/kamRules';
import type { AttendanceStatus, CardTypeId, Student } from '../types/kam';
import type { AttendanceSessionEntry } from '../lib/reportFormats';

interface SmartAttendancePageProps {
  onBack: () => void;
}

interface UndoAction {
  student: Student;
  status: AttendanceStatus;
  createdCardEventId?: string;
}

export const SmartAttendancePage: React.FC<SmartAttendancePageProps> = ({ onBack }) => {
  const {
    group,
    userProfile,
    blocks,
    students,
    cardEvents,
    monthlyBalances,
    selectedWeekKey,
    selectedMonthKey,
    saveAttendance,
    removeAttendance,
    awardCard,
    undoCard,
    publishSmartAttendanceReport,
    showToast,
  } = useKam();

  const [mode, setMode] = useState<'ATTENDANCE_ONLY' | CardTypeId>('ATTENDANCE_ONLY');
  const [blockFilter, setBlockFilter] = useState<string>('ALL');
  const [entries, setEntries] = useState<AttendanceSessionEntry[]>([]);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [issueNote, setIssueNote] = useState('');
  const [showIssuePrompt, setShowIssuePrompt] = useState(false);
  const [showCardModeMenu, setShowCardModeMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const allCards = useMemo(() => {
    const all = getAllCardDefinitions(group);
    const enabled = new Set(userProfile?.enabledCards ?? ALL_STANDARD_CARD_IDS);
    return all.filter((c) => c.id === 'CUSTOM_ELDER' || enabled.has(c.id));
  }, [group, userProfile?.enabledCards]);

  const orderedQueue = useMemo(() => {
    const filtered =
      blockFilter === 'ALL'
        ? students
        : blockFilter === 'UNASSIGNED'
        ? students.filter((s) => !s.blockId)
        : students.filter((s) => s.blockId === blockFilter);
    return sortStudentsByPosition(filtered);
  }, [students, blockFilter]);

  const doneIds = useMemo(() => new Set(entries.map((e) => e.student.id)), [entries]);
  const remaining = useMemo(
    () => orderedQueue.filter((s) => !doneIds.has(s.id)),
    [orderedQueue, doneIds]
  );

  const currentStudent = remaining[0] ?? null;
  const isAttendanceOnly = mode === 'ATTENDANCE_ONLY';
  const activeCardDef = !isAttendanceOnly ? getCardDefinition(mode, group) : null;
  const isLight = userProfile?.themeId === 'LIGHT';

  const handleResetSession = (newMode: 'ATTENDANCE_ONLY' | CardTypeId, newBlock: string) => {
    setMode(newMode);
    setBlockFilter(newBlock);
    setEntries([]);
    setUndoStack([]);
    setShowIssuePrompt(false);
    setIssueNote('');
    setReportSent(false);
    setShowCardModeMenu(false);
  };

  const handleDecision = async (status: AttendanceStatus, noteText?: string) => {
    if (!currentStudent || busy) return;
    setBusy(true);
    try {
      await saveAttendance({
        student: currentStudent,
        status,
        weekKey: selectedWeekKey,
        note: noteText || '',
      });

      let createdEventId: string | undefined;
      if (!isAttendanceOnly && status === 'PRESENT') {
        try {
          createdEventId = await awardCard(currentStudent, mode, selectedWeekKey);
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : 'تم تسجيل الحضور ولكن تعذر منح الكارت',
            'warning'
          );
        }
      }

      setEntries((prev) => [...prev, { student: currentStudent, status, note: noteText }]);
      setUndoStack((prev) => [
        ...prev,
        { student: currentStudent, status, createdCardEventId: createdEventId },
      ]);
      setShowIssuePrompt(false);
      setIssueNote('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر حفظ التسجيل', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0 || busy) return;
    const last = undoStack[undoStack.length - 1];
    setBusy(true);
    try {
      await removeAttendance(selectedWeekKey, last.student.id);
      if (last.createdCardEventId) {
        const ev = cardEvents.find((e) => e.id === last.createdCardEventId);
        if (ev) await undoCard(ev);
      }
      setUndoStack((prev) => prev.slice(0, -1));
      setEntries((prev) => prev.filter((e) => e.student.id !== last.student.id));
      showToast(`تم التراجع عن ${last.student.name}`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر التراجع', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickToggleCardForCurrent = async (cardType: CardTypeId) => {
    if (!currentStudent || busy) return;
    const existing = cardEvents.filter(
      (e) =>
        e.studentId === currentStudent.id &&
        e.weekKey === selectedWeekKey &&
        e.cardType === cardType
    );
    const undoable = existing.find((ev) =>
      canUserUndoCardEvent(group, userProfile?.userId, ev)
    );
    try {
      if (existing.length > 0 && undoable) {
        await undoCard(undoable);
        showToast(`تم إلغاء كارت ${getCardDefinition(cardType, group).titleAr}`, 'info');
      } else {
        await awardCard(currentStudent, cardType, selectedWeekKey);
        const def = getCardDefinition(cardType, group);
        showToast(`+${def.points} نقطة (${def.titleAr})`, 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر تحديث الكارت', 'error');
    }
  };

  const handlePublishReport = async () => {
    if (entries.length === 0 || busy) return;
    setBusy(true);
    try {
      const res = await publishSmartAttendanceReport({
        weekKey: selectedWeekKey,
        reportTypeKey: mode,
        entries,
      });
      if (res.outcome === 'IDENTICAL_SKIPPED') {
        showToast('التقرير مطابق تماماً لتقرير الخادم الأول', 'info');
      } else if (res.outcome === 'DIFF_SENT') {
        showToast('تم إرسال تقرير الاختلافات فقط إلى شات الفصل', 'warning');
      } else {
        showToast('تم إرسال تقرير التحضير إلى شات الفصل بنجاح', 'success');
      }
      setReportSent(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر إرسال التقرير', 'error');
    } finally {
      setBusy(false);
    }
  };

  const presentCount = entries.filter((e) => e.status === 'PRESENT').length;
  const absentCount = entries.filter((e) => e.status === 'ABSENT').length;
  const issueCount = entries.filter((e) => e.status === 'ISSUE').length;

  return (
    <div className="space-y-3 pb-10">
      {/* Top Bar (Matching SmartAttendanceScreen.kt: Back + Title + Undo + Gold Star Mode Selector) */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--kam-border)] relative">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="رجوع"
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-[var(--kam-border)] bg-[var(--kam-surface)] shrink-0"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold truncate">
              {activeCardDef
                ? `${activeCardDef.icon} تحضير كارت ${activeCardDef.titleAr}`
                : '📋 التحضير الذكي بالسحب'}
            </h1>
            <p className="text-[11px] text-[var(--kam-text-muted)] font-num">
              {selectedWeekKey} • {entries.length} / {orderedQueue.length} طفل
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Undo Button */}
          <button
            type="button"
            disabled={undoStack.length === 0 || busy}
            onClick={handleUndo}
            title="تراجع"
            className="h-10 px-2.5 rounded-xl border border-[var(--kam-border)] bg-[var(--kam-surface)] text-xs font-bold flex items-center gap-1 disabled:opacity-35"
          >
            <Undo2 className="w-4 h-4" />
            <span>تراجع</span>
          </button>

          {/* Golden Star Card Mode Selector Button */}
          <button
            type="button"
            onClick={() => setShowCardModeMenu((v) => !v)}
            title="اختيار نوع الكارت للسحب"
            className={`h-10 px-2.5 rounded-xl border flex items-center gap-1 text-xs font-bold transition-colors ${
              activeCardDef
                ? 'bg-[var(--kam-gold)]/22 border-[var(--kam-gold)] text-[var(--kam-gold)]'
                : 'bg-[var(--kam-surface)] border-[var(--kam-gold)]/55 text-[var(--kam-gold)]'
            }`}
          >
            <Star className="w-4 h-4 fill-[var(--kam-gold)]" />
            <span>{activeCardDef ? activeCardDef.icon : 'الكارت'}</span>
          </button>
        </div>

        {/* Dropdown Menu for Star Card Mode Selector */}
        {showCardModeMenu && (
          <div className="absolute left-0 top-12 z-40 w-64 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] shadow-2xl p-2 space-y-1">
            <div className="px-2.5 py-1 text-[11px] font-bold text-[var(--kam-text-muted)]">
              اختر وضع السحب وتقرير الشات:
            </div>
            <button
              type="button"
              onClick={() => handleResetSession('ATTENDANCE_ONLY', blockFilter)}
              className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between ${
                isAttendanceOnly
                  ? 'bg-[var(--kam-primary)]/20 text-[var(--kam-primary)]'
                  : 'hover:bg-[var(--kam-surface-variant)]'
              }`}
            >
              <span>📋 وضع الحضور فقط</span>
              {isAttendanceOnly && <span>✓</span>}
            </button>
            {allCards.map((c) => {
              const selected = mode === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleResetSession(c.id, blockFilter)}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between ${
                    selected
                      ? 'bg-[var(--kam-primary)]/20 text-[var(--kam-primary)]'
                      : 'hover:bg-[var(--kam-surface-variant)]'
                  }`}
                >
                  <span>
                    {c.icon} كارت {c.titleAr} (+{c.points})
                  </span>
                  {selected && <span>✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Block Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto kam-scrollbar py-0.5">
        <button
          type="button"
          onClick={() => handleResetSession(mode, 'ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap shrink-0 ${
            blockFilter === 'ALL'
              ? 'bg-[var(--kam-primary)]/20 border-[var(--kam-primary)] text-[var(--kam-primary)]'
              : 'bg-[var(--kam-surface)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
          }`}
        >
          كل الفصل ({students.length})
        </button>
        {blocks.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => handleResetSession(mode, b.id)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap shrink-0"
            style={{
              backgroundColor:
                blockFilter === b.id ? `${b.colorHex}26` : 'var(--kam-surface)',
              borderColor:
                blockFilter === b.id ? b.colorHex : 'var(--kam-border)',
              color:
                blockFilter === b.id ? b.colorHex : 'var(--kam-text-secondary)',
            }}
          >
            {b.servantName}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleResetSession(mode, 'UNASSIGNED')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap shrink-0 ${
            blockFilter === 'UNASSIGNED'
              ? 'bg-[var(--kam-gold)]/20 border-[var(--kam-gold)] text-[var(--kam-gold)]'
              : 'bg-[var(--kam-surface)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
          }`}
        >
          بدون بلوك
        </button>
      </div>

      {/* Progress Counters */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)]">
          <div className="text-base font-num font-extrabold text-[var(--kam-success)]">
            {presentCount}
          </div>
          <div className="text-[11px] text-[var(--kam-text-muted)]">
            {isAttendanceOnly ? 'حاضر' : 'أخذ الكارت'}
          </div>
        </div>
        <div className="p-2 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)]">
          <div className="text-base font-num font-extrabold text-[var(--kam-danger)]">
            {absentCount}
          </div>
          <div className="text-[11px] text-[var(--kam-text-muted)]">
            {isAttendanceOnly ? 'غائب' : 'لم يأخذ'}
          </div>
        </div>
        <div className="p-2 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)]">
          <div className="text-base font-num font-extrabold text-[var(--kam-warning)]">
            {issueCount}
          </div>
          <div className="text-[11px] text-[var(--kam-text-muted)]">مشكلة</div>
        </div>
      </div>

      {/* Swipeable Active Child Card OR Finished Summary */}
      {currentStudent ? (
        <div className="space-y-2.5">
          <SwipeableCard
            disabled={busy || showIssuePrompt}
            rightLabel={isAttendanceOnly ? 'حاضر ✓' : 'أخذ الكارت ✓'}
            leftLabel={isAttendanceOnly ? 'غائب ✕' : 'لم يأخذ ✕'}
            downLabel="عمل مشكلة !"
            onSwipeRight={() => handleDecision('PRESENT')}
            onSwipeLeft={() => handleDecision('ABSENT')}
            onSwipeDown={() => setShowIssuePrompt(true)}
          >
            {(() => {
              const blk = blocks.find((b) => b.id === currentStudent.blockId);
              const blkColor = blk?.colorHex || '#6C7BFF';
              const balId = buildMonthlyBalanceDocId(selectedMonthKey, currentStudent.id);
              const pts = monthlyBalances.find((b) => b.id === balId)?.totalPoints ?? 0;

              return (
                <div className="rounded-[24px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-5 flex flex-col items-center text-center space-y-4 shadow-md">
                  <div className="w-full flex items-center justify-between text-xs">
                    <span
                      className="px-2.5 py-0.5 rounded-lg font-bold"
                      style={{ backgroundColor: `${blkColor}24`, color: blkColor }}
                    >
                      {blk ? `بلوك ${blk.servantName}` : 'بدون بلوك'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-[var(--kam-gold)]/18 text-[var(--kam-gold)] font-num font-bold">
                      {pts} نقطة
                    </span>
                  </div>

                  <AvatarBadge
                    studentId={currentStudent.id}
                    hasAvatar={currentStudent.hasAvatar}
                    directBase64={currentStudent.avatarBase64}
                    name={currentStudent.name}
                    initials={currentStudent.avatarInitials}
                    size="xl"
                    accentHex={blkColor}
                  />

                  <div className="space-y-0.5">
                    <div className="text-xs font-num font-bold text-[var(--kam-text-secondary)]">
                      رقم #{currentStudent.studentNumber}
                    </div>
                    <h2 className="text-xl font-extrabold text-[var(--kam-text-primary)]">
                      {currentStudent.name}
                    </h2>
                  </div>

                  {/* Quick All-Cards Strip inside Swipe Card */}
                  <div className="w-full flex items-center gap-1 pt-1">
                    {allCards.map((c) => {
                      const hasCard = cardEvents.some(
                        (e) =>
                          e.studentId === currentStudent.id &&
                          e.weekKey === selectedWeekKey &&
                          e.cardType === c.id
                      );
                      const accent = isLight ? c.lightHex : c.darkHex;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleQuickToggleCardForCurrent(c.id)}
                          title={`${c.titleAr} (+${c.points})`}
                          className="flex-1 h-9 rounded-[10px] border flex items-center justify-center font-num text-xs font-extrabold transition-all"
                          style={{
                            backgroundColor: hasCard ? accent : 'var(--kam-surface-variant)',
                            borderColor: hasCard ? accent : `${accent}66`,
                            color: hasCard
                              ? accent === '#E5A436' || accent === '#22B8B0'
                                ? '#07080D'
                                : '#FFFFFF'
                              : accent,
                          }}
                        >
                          {hasCard ? c.points : c.icon}
                        </button>
                      );
                    })}
                  </div>

                  {showIssuePrompt ? (
                    <div className="w-full space-y-2.5 pt-2">
                      <input
                        type="text"
                        maxLength={200}
                        autoFocus
                        value={issueNote}
                        onChange={(e) => setIssueNote(e.target.value)}
                        placeholder="اكتب ملاحظة المشكلة (اختياري)..."
                        className="w-full h-11 px-3.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs"
                      />
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowIssuePrompt(false)}
                          className="h-10 px-4 rounded-xl text-xs font-semibold border border-[var(--kam-border)]"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDecision('ISSUE', issueNote.trim() || 'عمل مشكلة')}
                          className="h-10 px-5 rounded-xl text-xs font-bold bg-[var(--kam-warning)] text-black"
                        >
                          تأكيد المشكلة
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full grid grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDecision('PRESENT')}
                        className="h-14 rounded-2xl bg-[var(--kam-success)] text-white font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                      >
                        <Check className="w-5 h-5" />
                        <span>{isAttendanceOnly ? 'حاضر' : 'أخذ الكارت'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setShowIssuePrompt(true)}
                        className="h-14 rounded-2xl bg-[var(--kam-warning)]/15 border border-[var(--kam-warning)]/50 text-[var(--kam-warning)] font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                      >
                        <AlertTriangle className="w-5 h-5" />
                        <span>عمل مشكلة</span>
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDecision('ABSENT')}
                        className="h-14 rounded-2xl bg-[var(--kam-danger)] text-white font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                      >
                        <X className="w-5 h-5" />
                        <span>{isAttendanceOnly ? 'غائب' : 'لم يأخذ'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </SwipeableCard>

          <p className="text-center text-[11px] text-[var(--kam-text-muted)]">
            اسحب يميناً للحضور • يساراً للغياب • أو لأسفل لتسجيل مشكلة
          </p>
        </div>
      ) : (
        <div className="rounded-[24px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-7 text-center space-y-3">
          <div className="text-base font-extrabold">تم الانتهاء من جميع الأطفال في القائمة</div>
          <p className="text-xs text-[var(--kam-text-secondary)] leading-relaxed">
            يمكنك الآن إرسال التقرير المجمع لشات الفصل، مع فحص تلقائي لأي اختلافات عن تقارير الخدام الآخرين.
          </p>
        </div>
      )}

      {/* Send Report Action */}
      {entries.length > 0 && (
        <div className="flex items-center justify-between gap-2 p-3.5 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)]">
          <div className="text-xs text-[var(--kam-text-secondary)]">
            تم تسجيل{' '}
            <span className="font-num font-bold text-[var(--kam-text-primary)]">
              {entries.length}
            </span>{' '}
            طفل
          </div>
          <button
            type="button"
            disabled={busy || reportSent}
            onClick={handlePublishReport}
            className="h-10 px-4 rounded-xl bg-[var(--kam-primary)] text-[var(--kam-on-primary)] text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{reportSent ? 'تم إرسال التقرير' : 'إرسال التقرير للشات'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
