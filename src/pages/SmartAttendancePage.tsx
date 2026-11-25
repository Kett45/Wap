import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Send,
  Undo2,
  X,
} from 'lucide-react';
import { useKam } from '../context/KamContext';
import { AvatarBadge } from '../components/ui/AvatarBadge';
import { SwipeableCard } from '../components/ui/SwipeableCard';
import {
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
    blocks,
    students,
    cardEvents,
    selectedWeekKey,
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
  const [busy, setBusy] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const allCards = useMemo(() => getAllCardDefinitions(group), [group]);

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

  const handleResetSession = (newMode: 'ATTENDANCE_ONLY' | CardTypeId, newBlock: string) => {
    setMode(newMode);
    setBlockFilter(newBlock);
    setEntries([]);
    setUndoStack([]);
    setShowIssuePrompt(false);
    setIssueNote('');
    setReportSent(false);
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
    <div className="max-w-2xl mx-auto space-y-4 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--kam-border)]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="العودة للرئيسية"
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-[var(--kam-border)] bg-[var(--kam-surface)] hover:border-[var(--kam-primary)]"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold">التحضير الذكي بالسحب</h1>
            <p className="text-xs text-[var(--kam-text-muted)] font-num">
              الأسبوع: {selectedWeekKey} · المنجز {entries.length} / {orderedQueue.length}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={undoStack.length === 0 || busy}
          onClick={handleUndo}
          className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[var(--kam-border)] bg-[var(--kam-surface)] text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
        >
          <Undo2 className="w-4 h-4" />
          <span>تراجع</span>
        </button>
      </div>

      {/* Mode & Block Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label
            htmlFor="att-mode-select"
            className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1"
          >
            وضع الجلسة
          </label>
          <select
            id="att-mode-select"
            value={mode}
            onChange={(e) =>
              handleResetSession(e.target.value as 'ATTENDANCE_ONLY' | CardTypeId, blockFilter)
            }
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] text-sm font-semibold"
          >
            <option value="ATTENDANCE_ONLY">📋 وضع الحضور فقط</option>
            {allCards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} كارت {c.titleAr} (+{c.points})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="att-block-select"
            className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1"
          >
            نطاق الأطفال
          </label>
          <select
            id="att-block-select"
            value={blockFilter}
            onChange={(e) => handleResetSession(mode, e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] text-sm font-semibold"
          >
            <option value="ALL">كل الفصل ({students.length})</option>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.servantName}
              </option>
            ))}
            <option value="UNASSIGNED">بدون بلوك</option>
          </select>
        </div>
      </div>

      {/* Progress stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)]">
          <div className="text-lg font-num font-extrabold text-[var(--kam-success)]">
            {presentCount}
          </div>
          <div className="text-xs text-[var(--kam-text-muted)]">
            {isAttendanceOnly ? 'حاضر' : 'أخذ الكارت'}
          </div>
        </div>
        <div className="p-2.5 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)]">
          <div className="text-lg font-num font-extrabold text-[var(--kam-danger)]">
            {absentCount}
          </div>
          <div className="text-xs text-[var(--kam-text-muted)]">
            {isAttendanceOnly ? 'غائب' : 'لم يأخذ'}
          </div>
        </div>
        <div className="p-2.5 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)]">
          <div className="text-lg font-num font-extrabold text-[var(--kam-warning)]">
            {issueCount}
          </div>
          <div className="text-xs text-[var(--kam-text-muted)]">مشكلة</div>
        </div>
      </div>

      {/* Swipeable Active Child Card OR Finished Summary */}
      {currentStudent ? (
        <div className="space-y-3">
          <SwipeableCard
            disabled={busy || showIssuePrompt}
            rightLabel={isAttendanceOnly ? 'حاضر ✓' : 'أخذ الكارت ✓'}
            leftLabel={isAttendanceOnly ? 'غائب ✕' : 'لم يأخذ ✕'}
            downLabel="عمل مشكلة !"
            onSwipeRight={() => handleDecision('PRESENT')}
            onSwipeLeft={() => handleDecision('ABSENT')}
            onSwipeDown={() => setShowIssuePrompt(true)}
          >
            <div className="rounded-3xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-6 sm:p-8 flex flex-col items-center text-center space-y-5 shadow-sm">
              <AvatarBadge
                studentId={currentStudent.id}
                hasAvatar={currentStudent.hasAvatar}
                directBase64={currentStudent.avatarBase64}
                name={currentStudent.name}
                initials={currentStudent.avatarInitials}
                size="xl"
              />

              <div className="space-y-1">
                <div className="text-sm font-num font-bold text-[var(--kam-primary)]">
                  #{currentStudent.studentNumber}
                </div>
                <h2 className="text-2xl font-extrabold">{currentStudent.name}</h2>
                <p className="text-xs text-[var(--kam-text-muted)]">
                  {blocks.find((b) => b.id === currentStudent.blockId)?.servantName || 'بدون بلوك'}
                  {activeCardDef
                    ? ` · ${activeCardDef.icon} ${activeCardDef.titleAr} (+${activeCardDef.points})`
                    : ''}
                </p>
              </div>

              {showIssuePrompt ? (
                <div className="w-full max-w-md space-y-3 pt-2">
                  <input
                    type="text"
                    maxLength={200}
                    autoFocus
                    value={issueNote}
                    onChange={(e) => setIssueNote(e.target.value)}
                    placeholder="اكتب ملاحظة المشكلة (اختياري)..."
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm"
                  />
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowIssuePrompt(false)}
                      className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--kam-border)]"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDecision('ISSUE', issueNote.trim() || 'عمل مشكلة')}
                      className="min-h-[42px] px-5 py-2 rounded-xl text-xs font-bold bg-[var(--kam-warning)] text-black"
                    >
                      تأكيد تسجيل المشكلة
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full grid grid-cols-3 gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDecision('PRESENT')}
                    className="min-h-[64px] py-3.5 px-2.5 rounded-2xl bg-[var(--kam-success)] text-white font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1 hover:opacity-95 active:scale-[0.97] transition-all"
                  >
                    <Check className="w-5 h-5" />
                    <span>{isAttendanceOnly ? 'حاضر' : 'أخذ الكارت'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setShowIssuePrompt(true)}
                    className="min-h-[64px] py-3.5 px-2.5 rounded-2xl bg-[var(--kam-warning)]/15 border border-[var(--kam-warning)]/50 text-[var(--kam-warning)] font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1 active:scale-[0.97] transition-all"
                  >
                    <AlertTriangle className="w-5 h-5" />
                    <span>عمل مشكلة</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDecision('ABSENT')}
                    className="min-h-[64px] py-3.5 px-2.5 rounded-2xl bg-[var(--kam-danger)] text-white font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1 hover:opacity-95 active:scale-[0.97] transition-all"
                  >
                    <X className="w-5 h-5" />
                    <span>{isAttendanceOnly ? 'غائب' : 'لم يأخذ'}</span>
                  </button>
                </div>
              )}
            </div>
          </SwipeableCard>

          <p className="text-center text-xs text-[var(--kam-text-muted)]">
            اسحب البطاقة يميناً للحضور، يساراً للغياب، أو للأسفل لتسجيل مشكلة
          </p>
        </div>
      ) : (
        <div className="rounded-3xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-8 text-center space-y-3">
          <div className="text-lg font-extrabold">تم الانتهاء من جميع الأطفال في القائمة</div>
          <p className="text-xs text-[var(--kam-text-secondary)] leading-relaxed">
            يمكنك الآن إرسال التقرير المجمع لشات الفصل، مع فحص تلقائي لأي اختلافات عن تقارير الخدام الآخرين.
          </p>
        </div>
      )}

      {/* Send Report Action */}
      {entries.length > 0 && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)]">
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
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--kam-primary)] text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
          >
            <Send className="w-4 h-4" />
            <span>{reportSent ? 'تم إرسال التقرير' : 'إرسال التقرير للشات'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
