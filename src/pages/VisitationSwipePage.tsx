import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Edit3,
  HeartHandshake,
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
  onBack?: () => void;
}

export const VisitationSwipePage: React.FC<VisitationSwipePageProps> = () => {
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

  return (
    <div className="space-y-3 pb-10">
      {/* Compact Header Card (Matching VisitationSwipeScreen.kt) */}
      <div className="rounded-[18px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#9D7BFF]/18 flex items-center justify-center text-[#9D7BFF] shrink-0">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[15px] font-extrabold truncate">الافتقاد الذكي بالسحب</h1>
              <div className="flex items-center gap-2 text-[11px] font-num">
                <span className="text-[var(--kam-text-secondary)]">{queue.length} طفل</span>
                <span className="text-[#2CB578] font-bold">✓ {visitedCount}</span>
                <span className="text-[#E5A436] font-bold">🔔 {followupCount}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={entries.length === 0 || busy}
            onClick={handleUndo}
            className="h-9 px-3 rounded-xl border border-[var(--kam-border)] bg-[var(--kam-surface-variant)] text-xs font-bold flex items-center gap-1 disabled:opacity-35"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>تراجع</span>
          </button>
        </div>

        {/* Block Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto kam-scrollbar pt-0.5">
          {myBlock && (
            <button
              type="button"
              onClick={() => {
                setScopeFilter(myBlock.id);
                setEntries([]);
                liveReportMsgIdRef.current = null;
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap shrink-0"
              style={{
                backgroundColor:
                  scopeFilter === myBlock.id ? `${myBlock.colorHex}26` : 'var(--kam-bg)',
                borderColor:
                  scopeFilter === myBlock.id ? myBlock.colorHex : 'var(--kam-border)',
                color:
                  scopeFilter === myBlock.id
                    ? myBlock.colorHex
                    : 'var(--kam-text-secondary)',
              }}
            >
              بلوكي ({myBlock.servantName})
            </button>
          )}

          {(isAdmin || !myBlock) && (
            <button
              type="button"
              onClick={() => {
                setScopeFilter('ALL');
                setEntries([]);
                liveReportMsgIdRef.current = null;
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap shrink-0 ${
                scopeFilter === 'ALL'
                  ? 'bg-[var(--kam-primary)]/20 border-[var(--kam-primary)] text-[var(--kam-primary)]'
                  : 'bg-[var(--kam-bg)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
              }`}
            >
              كل الفصل ({students.length})
            </button>
          )}

          {isAdmin &&
            blocks
              .filter((b) => b.id !== myBlock?.id)
              .map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setScopeFilter(b.id);
                    setEntries([]);
                    liveReportMsgIdRef.current = null;
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap shrink-0"
                  style={{
                    backgroundColor:
                      scopeFilter === b.id ? `${b.colorHex}26` : 'var(--kam-bg)',
                    borderColor:
                      scopeFilter === b.id ? b.colorHex : 'var(--kam-border)',
                    color:
                      scopeFilter === b.id ? b.colorHex : 'var(--kam-text-secondary)',
                  }}
                >
                  {b.servantName}
                </button>
              ))}
        </div>
      </div>

      {/* Swipeable Visitation Card */}
      {currentStudent ? (
        <div className="space-y-2.5">
          <SwipeableCard
            disabled={busy || showFollowupPrompt || renaming}
            rightLabel="تم افتقاده ✓"
            leftLabel="تخطي"
            downLabel="يحتاج متابعة !"
            onSwipeRight={() => handleAction('VISITED')}
            onSwipeLeft={() => handleAction('NOT_VISITED')}
            onSwipeDown={() => setShowFollowupPrompt(true)}
          >
            {(() => {
              const blk = blocks.find((b) => b.id === currentStudent.blockId);
              const blkColor = blk?.colorHex || '#9D7BFF';
              return (
                <div className="rounded-[24px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-5 flex flex-col items-center text-center space-y-4 shadow-md">
                  <div className="w-full flex items-center justify-between text-xs">
                    <span
                      className="px-2.5 py-0.5 rounded-lg font-bold"
                      style={{ backgroundColor: `${blkColor}24`, color: blkColor }}
                    >
                      {blk ? `بلوك ${blk.servantName}` : 'بدون بلوك'}
                    </span>
                    <span className="font-num text-[var(--kam-text-muted)]">
                      متبقي {remaining.length} طفل
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

                  {renaming ? (
                    <form
                      onSubmit={handleQuickRename}
                      className="flex items-center gap-1.5 w-full"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        className="flex-1 h-10 px-3 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs"
                      />
                      <button
                        type="submit"
                        className="h-10 px-3 rounded-xl bg-[var(--kam-primary)] text-white text-xs font-bold"
                      >
                        حفظ
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenaming(false)}
                        className="h-10 px-2.5 rounded-xl border border-[var(--kam-border)] text-xs"
                      >
                        إلغاء
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="text-xs font-num font-bold text-[#9D7BFF]">
                        رقم #{currentStudent.studentNumber}
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        <h2 className="text-xl font-extrabold">{currentStudent.name}</h2>
                        <button
                          type="button"
                          onClick={() => {
                            setRenameDraft(currentStudent.name);
                            setRenaming(true);
                          }}
                          aria-label="تعديل اسم الطفل"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--kam-text-muted)] hover:text-[var(--kam-primary)]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {showFollowupPrompt ? (
                    <div className="w-full space-y-2.5 pt-1">
                      <input
                        type="text"
                        maxLength={500}
                        autoFocus
                        value={followupNote}
                        onChange={(e) => setFollowupNote(e.target.value)}
                        placeholder="ملاحظة المتابعة أو سبب الغياب (اختياري)..."
                        className="w-full h-11 px-3.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs"
                      />
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowFollowupPrompt(false)}
                          className="h-10 px-4 rounded-xl text-xs font-semibold border border-[var(--kam-border)]"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleAction('FOLLOWUP', followupNote)}
                          className="h-10 px-5 rounded-xl text-xs font-bold bg-[var(--kam-warning)] text-black"
                        >
                          حفظ كـ يحتاج متابعة
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full grid grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAction('VISITED')}
                        className="h-14 rounded-2xl bg-[var(--kam-success)] text-white font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                      >
                        <Check className="w-5 h-5" />
                        <span>تم افتقاده</span>
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setShowFollowupPrompt(true)}
                        className="h-14 rounded-2xl bg-[var(--kam-warning)]/15 border border-[var(--kam-warning)]/50 text-[var(--kam-warning)] font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                      >
                        <AlertCircle className="w-5 h-5" />
                        <span>يحتاج متابعة</span>
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAction('NOT_VISITED')}
                        className="h-14 rounded-2xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-[var(--kam-text-secondary)] font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                      >
                        <SkipForward className="w-5 h-5" />
                        <span>لم يُفتقد</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </SwipeableCard>

          <p className="text-center text-[11px] text-[var(--kam-text-muted)]">
            اسحب يميناً لتأكيد الافتقاد • يساراً للتخطي • أو لأسفل لطلب متابعة (يُحدّث تقرير الشات تلقائياً)
          </p>
        </div>
      ) : (
        <div className="rounded-[24px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-7 text-center space-y-2.5">
          <div className="text-base font-extrabold">تمت مراجعة جميع أطفال النطاق</div>
          <p className="text-xs text-[var(--kam-text-secondary)]">
            تم تحديث تقرير الافتقاد المجمع تلقائياً داخل شات الفصل.
          </p>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setEntries([]);
                liveReportMsgIdRef.current = null;
              }}
              className="mt-2 h-10 px-4 rounded-xl bg-[var(--kam-primary)] text-[var(--kam-on-primary)] font-bold text-xs"
            >
              بدء جلسة افتقاد جديدة
            </button>
          )}
        </div>
      )}
    </div>
  );
};
