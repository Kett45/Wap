import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Edit3,
  SkipForward,
  Undo2,
} from 'lucide-react';
import { useKam } from '../context/KamContext';
import { AvatarBadge } from '../components/ui/AvatarBadge';
import { SwipeableCard } from '../components/ui/SwipeableCard';
import { sortStudentsByPosition } from '../lib/kamRules';
import { buildVisitationV1Text, type VisitationSessionEntry } from '../lib/reportFormats';
import type { VisitationStatus } from '../types/kam';

interface VisitationSwipePageProps {
  onBack: () => void;
}

export const VisitationSwipePage: React.FC<VisitationSwipePageProps> = ({ onBack }) => {
  const {
    userProfile,
    blocks,
    students,
    isAdmin,
    createChildNote,
    editStudent,
    sendGroupChatMessage,
    updateLiveSystemReport,
    showToast,
  } = useKam();

  const myBlock = useMemo(
    () => blocks.find((b) => b.servantId === userProfile?.userId) ?? null,
    [blocks, userProfile?.userId]
  );

  const [scopeFilter, setScopeFilter] = useState<string>(() => (myBlock ? myBlock.id : 'ALL'));
  const [entries, setEntries] = useState<VisitationSessionEntry[]>([]);
  const [followupNote, setFollowupNote] = useState('');
  const [showFollowupPrompt, setShowFollowupPrompt] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const liveReportMsgIdRef = useRef<string | null>(null);

  const scopeLabel = useMemo(() => {
    if (scopeFilter === 'ALL') return 'كل الفصل';
    const blk = blocks.find((b) => b.id === scopeFilter);
    return blk?.servantName || 'بلوكي';
  }, [scopeFilter, blocks]);

  const queue = useMemo(() => {
    const filtered =
      scopeFilter === 'ALL' ? students : students.filter((s) => s.blockId === scopeFilter);
    return sortStudentsByPosition(filtered);
  }, [students, scopeFilter]);

  const doneIds = useMemo(() => new Set(entries.map((e) => e.student.id)), [entries]);
  const remaining = useMemo(() => queue.filter((s) => !doneIds.has(s.id)), [queue, doneIds]);
  const currentStudent = remaining[0] ?? null;

  const syncLiveReport = async (nextEntries: VisitationSessionEntry[]) => {
    if (nextEntries.length === 0) return;
    const text = buildVisitationV1Text({
      servantName: userProfile?.displayName || 'خادم',
      scopeLabel,
      entries: nextEntries,
    });

    if (!liveReportMsgIdRef.current) {
      const msgId = await sendGroupChatMessage({
        type: 'SYSTEM',
        text,
        notificationCategory: 'VISITATION',
      });
      liveReportMsgIdRef.current = msgId;
    } else {
      await updateLiveSystemReport(liveReportMsgIdRef.current, text);
    }
  };

  const handleAction = async (status: VisitationStatus, noteText?: string) => {
    if (!currentStudent || busy) return;
    setBusy(true);
    try {
      const noteBody =
        status === 'VISITED'
          ? 'تم الافتقاد'
          : status === 'FOLLOWUP'
          ? noteText?.trim() || 'يحتاج متابعة'
          : 'لم يتم افتقاده بعد';

      await createChildNote({
        student: currentStudent,
        type: 'VISITATION',
        text: noteBody,
        status,
      });

      const nextEntries: VisitationSessionEntry[] = [
        ...entries,
        { student: currentStudent, status, note: status === 'FOLLOWUP' ? noteBody : undefined },
      ];
      setEntries(nextEntries);
      await syncLiveReport(nextEntries);
      setShowFollowupPrompt(false);
      setFollowupNote('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر تسجيل الافتقاد', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async () => {
    if (entries.length === 0 || busy) return;
    const nextEntries = entries.slice(0, -1);
    setEntries(nextEntries);
    if (nextEntries.length > 0 && liveReportMsgIdRef.current) {
      await syncLiveReport(nextEntries);
    }
    showToast('تم التراجع عن آخر طفل في جلسة الافتقاد', 'info');
  };

  const handleQuickRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStudent || !renameDraft.trim()) return;
    setBusy(true);
    try {
      await editStudent(currentStudent.id, { name: renameDraft.trim() });
      setRenaming(false);
    } finally {
      setBusy(false);
    }
  };

  const visitedCount = entries.filter((e) => e.status === 'VISITED').length;
  const followupCount = entries.filter((e) => e.status === 'FOLLOWUP').length;
  const skippedCount = entries.filter((e) => e.status === 'NOT_VISITED').length;

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-16">
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
            <h1 className="text-base sm:text-lg font-extrabold">الافتقاد الذكي بالسحب</h1>
            <p className="text-xs text-[var(--kam-text-muted)]">
              يُحدّث تقرير الافتقاد لحظياً في شات الفصل ({entries.length}/{queue.length})
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={entries.length === 0 || busy}
          onClick={handleUndo}
          className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[var(--kam-border)] bg-[var(--kam-surface)] text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
        >
          <Undo2 className="w-4 h-4" />
          <span>تراجع</span>
        </button>
      </div>

      {/* Block scope filter */}
      <div>
        <label
          htmlFor="vis-scope-select"
          className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1"
        >
          نطاق الافتقاد
        </label>
        <select
          id="vis-scope-select"
          value={scopeFilter}
          onChange={(e) => {
            setScopeFilter(e.target.value);
            setEntries([]);
            liveReportMsgIdRef.current = null;
          }}
          className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] text-sm font-semibold"
        >
          {myBlock && <option value={myBlock.id}>بلوكي ({myBlock.servantName})</option>}
          {(isAdmin || !myBlock) && <option value="ALL">كل الفصل ({students.length})</option>}
          {isAdmin &&
            blocks
              .filter((b) => b.id !== myBlock?.id)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.servantName}
                </option>
              ))}
        </select>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)]">
          <div className="text-lg font-num font-extrabold text-[var(--kam-success)]">
            {visitedCount}
          </div>
          <div className="text-xs text-[var(--kam-text-muted)]">تم افتقاده</div>
        </div>
        <div className="p-2.5 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)]">
          <div className="text-lg font-num font-extrabold text-[var(--kam-warning)]">
            {followupCount}
          </div>
          <div className="text-xs text-[var(--kam-text-muted)]">يحتاج متابعة</div>
        </div>
        <div className="p-2.5 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)]">
          <div className="text-lg font-num font-extrabold text-[var(--kam-text-muted)]">
            {skippedCount}
          </div>
          <div className="text-xs text-[var(--kam-text-muted)]">لم يتم افتقاده</div>
        </div>
      </div>

      {/* Swipeable Visitation Card */}
      {currentStudent ? (
        <div className="space-y-3">
          <SwipeableCard
            disabled={busy || showFollowupPrompt || renaming}
            rightLabel="تم افتقاده ✓"
            leftLabel="تخطي"
            downLabel="يحتاج متابعة !"
            onSwipeRight={() => handleAction('VISITED')}
            onSwipeLeft={() => handleAction('NOT_VISITED')}
            onSwipeDown={() => setShowFollowupPrompt(true)}
          >
            <div className="rounded-3xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-6 sm:p-8 flex flex-col items-center text-center space-y-5 shadow-sm">
              <AvatarBadge
                studentId={currentStudent.id}
                hasAvatar={currentStudent.hasAvatar}
                directBase64={currentStudent.avatarBase64}
                name={currentStudent.name}
                initials={currentStudent.avatarInitials}
                size="xl"
                accentColor="#8B5CF6"
              />

              {renaming ? (
                <form onSubmit={handleQuickRename} className="flex items-center gap-2 w-full max-w-sm">
                  <input
                    type="text"
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm"
                  />
                  <button
                    type="submit"
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--kam-primary)] text-white text-xs font-bold"
                  >
                    حفظ
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenaming(false)}
                    className="min-h-[42px] px-3 py-2 rounded-xl border border-[var(--kam-border)] text-xs"
                  >
                    إلغاء
                  </button>
                </form>
              ) : (
                <div className="space-y-1">
                  <div className="text-sm font-num font-bold text-[#8B5CF6]">
                    #{currentStudent.studentNumber}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <h2 className="text-2xl font-extrabold">{currentStudent.name}</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setRenameDraft(currentStudent.name);
                        setRenaming(true);
                      }}
                      aria-label="تعديل سريع لاسم الطفل"
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[var(--kam-text-muted)] hover:text-[var(--kam-primary)]"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {showFollowupPrompt ? (
                <div className="w-full max-w-md space-y-3 pt-2">
                  <input
                    type="text"
                    maxLength={500}
                    autoFocus
                    value={followupNote}
                    onChange={(e) => setFollowupNote(e.target.value)}
                    placeholder="ملاحظة المتابعة أو سبب الغياب (اختياري)..."
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm"
                  />
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFollowupPrompt(false)}
                      className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--kam-border)]"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleAction('FOLLOWUP', followupNote)}
                      className="min-h-[42px] px-5 py-2 rounded-xl text-xs font-bold bg-[var(--kam-warning)] text-black"
                    >
                      حفظ كـ يحتاج متابعة
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full grid grid-cols-3 gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleAction('VISITED')}
                    className="min-h-[64px] py-3.5 px-2.5 rounded-2xl bg-[var(--kam-success)] text-white font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1 hover:opacity-95 active:scale-[0.97] transition-all"
                  >
                    <Check className="w-5 h-5" />
                    <span>تم افتقاده</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setShowFollowupPrompt(true)}
                    className="min-h-[64px] py-3.5 px-2.5 rounded-2xl bg-[var(--kam-warning)]/15 border border-[var(--kam-warning)]/50 text-[var(--kam-warning)] font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1 active:scale-[0.97] transition-all"
                  >
                    <AlertCircle className="w-5 h-5" />
                    <span>يحتاج متابعة</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleAction('NOT_VISITED')}
                    className="min-h-[64px] py-3.5 px-2.5 rounded-2xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-[var(--kam-text-secondary)] font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1 active:scale-[0.97] transition-all"
                  >
                    <SkipForward className="w-5 h-5" />
                    <span>تخطي</span>
                  </button>
                </div>
              )}
            </div>
          </SwipeableCard>

          <p className="text-center text-xs text-[var(--kam-text-muted)]">
            اسحب البطاقة يميناً لتأكيد الافتقاد، يساراً للتخطي، أو للأسفل لطلب متابعة
          </p>
        </div>
      ) : (
        <div className="rounded-3xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-8 text-center space-y-2">
          <div className="text-lg font-extrabold">تمت مراجعة جميع أطفال النطاق</div>
          <p className="text-xs text-[var(--kam-text-secondary)]">
            تم تحديث تقرير الافتقاد المجمع تلقائياً داخل شات الفصل.
          </p>
        </div>
      )}
    </div>
  );
};
