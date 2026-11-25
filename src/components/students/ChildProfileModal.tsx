import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Camera,
  HeartHandshake,
  MessageSquare,
  Send,
  Star,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { useKam } from '../../context/KamContext';
import { formatRelativeTimeAr } from '../../lib/arabic';
import { canUserUndoCardEvent, getCardDefinition } from '../../lib/kamRules';
import { compressImageFile, normalizeBase64ImageSrc, unpackAvatars } from '../../lib/media';
import type { ChildNoteType, Student } from '../../types/kam';
import type { NotificationCategory } from '../../types/chat';

interface ChildProfileModalProps {
  student: Student | null;
  onClose: () => void;
}

type ProfileTab = 'MEMORIZATION' | 'COMMENT' | 'VISITATION' | 'CARDS' | 'INFO';

export const ChildProfileModal: React.FC<ChildProfileModalProps> = ({ student, onClose }) => {
  const {
    group,
    blocks,
    cardEvents,
    childNotes,
    avatarCache,
    isAdmin,
    userProfile,
    getServantDisplayName,
    ensureStudentAvatarLoaded,
    editStudent,
    removeStudent,
    saveStudentAvatarList,
    createChildNote,
    removeChildNote,
    undoCard,
    sendGroupChatMessage,
    showToast,
  } = useKam();

  const [tab, setTab] = useState<ProfileTab>('MEMORIZATION');
  const [editName, setEditName] = useState('');
  const [editNumber, setEditNumber] = useState(1);
  const [editBlockId, setEditBlockId] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [visStatus, setVisStatus] = useState<'VISITED' | 'FOLLOWUP' | 'NOT_VISITED'>('VISITED');
  const [notifyText, setNotifyText] = useState('');
  const [notifyCat, setNotifyCat] = useState<NotificationCategory>('COMMENT');
  const [showNotifyBox, setShowNotifyBox] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (student) {
      setEditName(student.name);
      setEditNumber(student.studentNumber);
      setEditBlockId(student.blockId);
      setNoteInput('');
      setShowNotifyBox(false);
      setConfirmDelete(false);
      if (student.hasAvatar) {
        ensureStudentAvatarLoaded(student.id);
      }
    }
  }, [
    student?.id,
    student?.name,
    student?.studentNumber,
    student?.blockId,
    student?.hasAvatar,
    ensureStudentAvatarLoaded,
  ]);

  const packedAvatars = student ? avatarCache[student.id] || student.avatarBase64 || '' : '';
  const photoList = useMemo(() => unpackAvatars(packedAvatars), [packedAvatars]);

  const studentNotes = useMemo(() => {
    if (!student) return [];
    return childNotes.filter((n) => n.studentId === student.id);
  }, [childNotes, student]);

  const studentEvents = useMemo(() => {
    if (!student) return [];
    return cardEvents.filter((e) => e.studentId === student.id);
  }, [cardEvents, student]);

  if (!student) return null;

  const blockName = blocks.find((b) => b.id === student.blockId)?.servantName || 'بدون بلوك';

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await editStudent(student.id, {
        name: editName.trim(),
        studentNumber: Math.max(1, Math.min(2000, Number(editNumber) || 1)),
        blockId: editBlockId,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر الحفظ', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await compressImageFile(file, { maxDim: 600, maxChars: 110000 });
      await saveStudentAvatarList(student.id, [compressed.base64Raw, ...photoList]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر رفع الصورة', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSetPrimaryPhoto = async (index: number) => {
    if (index === 0) return;
    const next = [photoList[index], ...photoList.filter((_, i) => i !== index)];
    setBusy(true);
    try {
      await saveStudentAvatarList(student.id, next);
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePhoto = async (index: number) => {
    const next = photoList.filter((_, i) => i !== index);
    setBusy(true);
    try {
      await saveStudentAvatarList(student.id, next);
    } finally {
      setBusy(false);
    }
  };

  const handleAddNote = async (type: ChildNoteType) => {
    if (!noteInput.trim()) return;
    setBusy(true);
    try {
      await createChildNote({
        student,
        type,
        text: noteInput.trim(),
        status: type === 'VISITATION' ? visStatus : undefined,
      });
      setNoteInput('');
      showToast('تم حفظ الملاحظة', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر الحفظ', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSendChildNotification = async () => {
    if (!notifyText.trim()) return;
    setBusy(true);
    try {
      await sendGroupChatMessage({
        type: 'SYSTEM',
        text: notifyText.trim(),
        notificationCategory: notifyCat,
        childId: student.id,
        childName: student.name,
        childBlockName: blockName,
      });
      setNotifyText('');
      setShowNotifyBox(false);
      showToast('تم إرسال إشعار الطفل إلى شات الفصل', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر إرسال الإشعار', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      await removeStudent(student.id);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر حذف الطفل', 'error');
    } finally {
      setBusy(false);
    }
  };

  const filteredNotes =
    tab === 'MEMORIZATION' || tab === 'COMMENT' || tab === 'VISITATION'
      ? studentNotes.filter((n) => n.type === tab)
      : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`ملف الطفل ${student.name}`}
    >
      <div className="w-full max-w-2xl max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] shadow-2xl overflow-hidden">
        {/* Mobile grab handle */}
        <div className="sm:hidden w-10 h-1.5 rounded-full bg-[var(--kam-border-strong)] mx-auto mt-2.5" />

        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--kam-border)] flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-[var(--kam-border)] bg-[var(--kam-primary-container)] flex items-center justify-center text-base font-bold text-[var(--kam-primary)] shrink-0">
              {photoList[0] ? (
                <img
                  src={normalizeBase64ImageSrc(photoList[0])}
                  alt={student.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                student.avatarInitials
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-num font-bold text-[var(--kam-primary)]">
                  #{student.studentNumber}
                </span>
                <h2 className="text-base font-bold truncate">{student.name}</h2>
              </div>
              <p className="text-xs text-[var(--kam-text-muted)] truncate">
                {blockName}
                {student.lastMemorizedText ? ` · آخر حفظ: ${student.lastMemorizedText}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowNotifyBox((v) => !v)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] hover:border-[var(--kam-primary)] flex items-center gap-1.5 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5 text-[var(--kam-primary)]" />
              <span>إشعار</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق ملف الطفل"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[var(--kam-text-muted)] hover:bg-[var(--kam-surface-variant)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Optional child notification composer */}
        {showNotifyBox && (
          <div className="px-4 sm:px-5 py-3 bg-[var(--kam-surface-variant)]/70 border-b border-[var(--kam-border)] space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-[var(--kam-text-secondary)]">الفئة:</span>
              {(
                [
                  ['COMMENT', 'ملاحظة'],
                  ['MEMORIZATION', 'محفوظات'],
                  ['VISITATION', 'افتقاد'],
                  ['ABSENT', 'غياب'],
                  ['CARD', 'كارت'],
                  ['CONFLICT', 'تنبيه'],
                ] as const
              ).map(([cat, label]) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setNotifyCat(cat)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                    notifyCat === cat
                      ? 'bg-[var(--kam-primary)] text-white border-[var(--kam-primary)]'
                      : 'bg-[var(--kam-surface)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={notifyText}
                onChange={(e) => setNotifyText(e.target.value)}
                placeholder={`اكتب إشعاراً عن ${student.name} لشات الفصل...`}
                className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] text-xs"
              />
              <button
                type="button"
                disabled={busy || !notifyText.trim()}
                onClick={handleSendChildNotification}
                className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--kam-primary)] text-white disabled:opacity-50 whitespace-nowrap"
              >
                إرسال
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="px-3 sm:px-5 pt-2 border-b border-[var(--kam-border)] flex items-center gap-1 overflow-x-auto kam-scrollbar">
          {(
            [
              ['MEMORIZATION', 'المحفوظات', BookOpen],
              ['COMMENT', 'التعليقات', MessageSquare],
              ['VISITATION', 'الافتقاد', HeartHandshake],
              ['CARDS', 'الكروت', Star],
              ['INFO', 'البيانات والصور', Camera],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-[42px] flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                tab === id
                  ? 'border-[var(--kam-primary)] text-[var(--kam-primary)]'
                  : 'border-transparent text-[var(--kam-text-secondary)] hover:text-[var(--kam-text-primary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto kam-scrollbar p-4 sm:p-5">
          {(tab === 'MEMORIZATION' || tab === 'COMMENT' || tab === 'VISITATION') && (
            <div className="space-y-4">
              <div className="space-y-2.5">
                {tab === 'VISITATION' && (
                  <div className="flex flex-wrap items-center gap-2">
                    {(
                      [
                        ['VISITED', 'تم افتقاده'],
                        ['FOLLOWUP', 'يحتاج متابعة'],
                        ['NOT_VISITED', 'لم يتم افتقاده'],
                      ] as const
                    ).map(([st, lbl]) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setVisStatus(st)}
                        className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-semibold border ${
                          visStatus === st
                            ? 'bg-[var(--kam-primary)] text-white border-[var(--kam-primary)]'
                            : 'bg-[var(--kam-surface-variant)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={500}
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder={
                      tab === 'MEMORIZATION'
                        ? 'اكتب ما حفظه الطفل (مثال: مزمور 23)...'
                        : tab === 'VISITATION'
                        ? 'اكتب تفاصيل الافتقاد...'
                        : 'أضف تعليقاً أو ملاحظة...'
                    }
                    className="flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm"
                  />
                  <button
                    type="button"
                    disabled={busy || !noteInput.trim()}
                    onClick={() => handleAddNote(tab)}
                    className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-[var(--kam-primary)] text-white disabled:opacity-50 whitespace-nowrap"
                  >
                    حفظ
                  </button>
                </div>
              </div>

              {filteredNotes.length === 0 ? (
                <p className="text-center py-8 text-xs text-[var(--kam-text-muted)]">
                  لا توجد سجلات في هذا القسم حتى الآن.
                </p>
              ) : (
                <div className="divide-y divide-[var(--kam-border)] border border-[var(--kam-border)] rounded-xl">
                  {filteredNotes.map((note) => {
                    const canDelete = isAdmin || note.authorUid === userProfile?.userId;
                    return (
                      <div key={note.id} className="p-3.5 flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <p className="text-sm leading-relaxed break-words">{note.text}</p>
                          <div className="flex flex-wrap items-center gap-2 text-[0.72rem] text-[var(--kam-text-muted)]">
                            <span>{getServantDisplayName(note.authorUid, note.authorName)}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {formatRelativeTimeAr(note.clientCreatedAtMillis ?? note.createdAt)}
                            </span>
                            {note.status && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-semibold text-[var(--kam-primary)]">
                                  {note.status === 'VISITED'
                                    ? 'تم افتقاده'
                                    : note.status === 'FOLLOWUP'
                                    ? 'يحتاج متابعة'
                                    : 'لم يتم افتقاده'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => removeChildNote(note.id)}
                            aria-label="حذف الملاحظة"
                            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[var(--kam-text-muted)] hover:text-[var(--kam-danger)]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'CARDS' && (
            <div className="space-y-2">
              {studentEvents.length === 0 ? (
                <p className="text-center py-8 text-xs text-[var(--kam-text-muted)]">
                  لم يحصل الطفل على أي كروت بعد.
                </p>
              ) : (
                <div className="divide-y divide-[var(--kam-border)] border border-[var(--kam-border)] rounded-xl">
                  {studentEvents.map((ev) => {
                    const def = getCardDefinition(ev.cardType, group);
                    const allowUndo = canUserUndoCardEvent(group, userProfile?.userId, ev);
                    return (
                      <div
                        key={ev.id}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base" aria-hidden="true">
                            {def.icon}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold">
                              {def.titleAr}{' '}
                              <span className="font-num text-[var(--kam-success)]">
                                +{ev.points}
                              </span>
                            </div>
                            <div className="text-[0.72rem] text-[var(--kam-text-muted)]">
                              {getServantDisplayName(ev.servantId, ev.servantName)} ·{' '}
                              <span className="font-num">{ev.weekKey}</span>
                            </div>
                          </div>
                        </div>
                        {allowUndo && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await undoCard(ev);
                                showToast('تم التراجع عن الكارت', 'info');
                              } catch (err) {
                                showToast(
                                  err instanceof Error ? err.message : 'تعذر التراجع',
                                  'error'
                                );
                              }
                            }}
                            className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--kam-danger)] hover:bg-[var(--kam-danger)]/10 flex items-center gap-1"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            <span>تراجع</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'INFO' && (
            <div className="space-y-6">
              {/* Photo Gallery */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-[var(--kam-text-secondary)]">
                    معرض صور الطفل (الأولى هي الأساسية)
                  </h3>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--kam-primary)] text-white flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>رفع صورة</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadPhoto}
                    className="hidden"
                  />
                </div>

                {photoList.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-[var(--kam-border-strong)] text-center text-xs text-[var(--kam-text-muted)]">
                    لا توجد صور محفوظة للطفل بعد.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {photoList.map((raw, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-xl overflow-hidden border border-[var(--kam-border)] aspect-square bg-[var(--kam-surface-variant)]"
                      >
                        <img
                          src={normalizeBase64ImageSrc(raw)}
                          alt={`${student.name} ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 flex items-center justify-between gap-1">
                          {idx === 0 ? (
                            <span className="text-[0.65rem] font-bold text-white">الأساسية</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryPhoto(idx)}
                              className="text-[0.65rem] font-semibold text-white hover:underline"
                            >
                              تعيين كأساسية
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(idx)}
                            aria-label="حذف الصورة"
                            className="p-1.5 rounded bg-black/50 text-white hover:text-red-300"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Edit Student Form */}
              <form
                onSubmit={handleSaveInfo}
                className="space-y-4 pt-4 border-t border-[var(--kam-border)]"
              >
                <div>
                  <label
                    htmlFor="edit-st-name"
                    className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1"
                  >
                    الاسم
                  </label>
                  <input
                    id="edit-st-name"
                    type="text"
                    required
                    maxLength={100}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="edit-st-num"
                      className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1"
                    >
                      الرقم
                    </label>
                    <input
                      id="edit-st-num"
                      type="number"
                      min={1}
                      max={2000}
                      value={editNumber}
                      onChange={(e) => setEditNumber(Number(e.target.value))}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm font-num"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-st-blk"
                      className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1"
                    >
                      البلوك
                    </label>
                    <select
                      id="edit-st-blk"
                      value={editBlockId}
                      onChange={(e) => setEditBlockId(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm"
                    >
                      <option value="">بدون بلوك</option>
                      {blocks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.servantName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  {isAdmin ? (
                    confirmDelete ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={handleDeleteStudent}
                          className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--kam-danger)] text-white"
                        >
                          تأكيد حذف الطفل
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="min-h-[42px] px-3 py-2 rounded-xl text-xs border border-[var(--kam-border)]"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmDelete(true)}
                        className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold text-[var(--kam-danger)] border border-[var(--kam-danger)]/40 hover:bg-[var(--kam-danger)]/10 flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف الطفل</span>
                      </button>
                    )
                  ) : (
                    <span />
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold bg-[var(--kam-primary)] text-white disabled:opacity-50"
                  >
                    حفظ التعديلات
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
