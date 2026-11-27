import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Bell,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  FileSpreadsheet,
  MessageCircle,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Send,
  Trophy,
  Undo2,
  UserCheck,
  UserPlus,
  Users,
  X,
  ZoomIn,
} from 'lucide-react';
import { useKam } from '../context/KamContext';
import { AvatarBadge } from '../components/ui/AvatarBadge';
import { CalendarTreeModal } from '../components/calendar/CalendarTreeModal';
import { AddEditStudentModal } from '../components/students/AddEditStudentModal';
import { BulkImportModal } from '../components/students/BulkImportModal';
import { ChildProfileModal } from '../components/students/ChildProfileModal';
import { isServantOnline, normalizeArabicName } from '../lib/arabic';
import { formatMonthTitleAr, getWeekInfoByKey, shiftWeekKey } from '../lib/calendar';
import {
  ALL_STANDARD_CARD_IDS,
  BLOCK_COLOR_PALETTE,
  buildMonthlyBalanceDocId,
  canUserUndoCardEvent,
  detectDuplicateCardAlerts,
  getAllCardDefinitions,
  getCardDefinition,
  sortStudentsByPosition,
} from '../lib/kamRules';
import { buildTelLink, buildWhatsAppLink } from '../lib/phone';
import type { CardTypeId, ServantBlock, Student } from '../types/kam';

interface HomePageProps {
  onOpenSmartAttendance: () => void;
  onOpenVisitation: () => void;
  onOpenLeaderboard: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onOpenSmartAttendance,
  onOpenLeaderboard,
}) => {
  const {
    group,
    userProfile,
    blocks,
    students,
    cardEvents,
    monthlyBalances,
    attendance,
    childNotes,
    members,
    isAdmin,
    selectedWeekKey,
    selectedMonthKey,
    setSelectedWeekKey,
    updateProfile,
    awardCard,
    undoCard,
    editStudent,
    reorderStudent,
    mergeDuplicateStudents,
    createChildNote,
    createBlock,
    updateBlock,
    sendGroupChatMessage,
    getServantDisplayName,
    setQuickPeekStudent,
    showToast,
  } = useKam();

  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [rawSearch, setRawSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [addDefaultBlock, setAddDefaultBlock] = useState('');
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [busyCardKey, setBusyCardKey] = useState<string | null>(null);

  // Additional mobile dialogs
  const [quickAddDialogOpen, setQuickAddDialogOpen] = useState(false);
  const [createBlockModalOpen, setCreateBlockModalOpen] = useState(false);
  const [newBlockName, setNewBlockName] = useState('');
  const [newBlockColor, setNewBlockColor] = useState<string>(BLOCK_COLOR_PALETTE[0]);

  const [assignServantBlock, setAssignServantBlock] = useState<ServantBlock | null>(null);
  const [assignCustomName, setAssignCustomName] = useState('');

  const [moveBlockStudent, setMoveBlockStudent] = useState<Student | null>(null);
  const [quickCommentStudent, setQuickCommentStudent] = useState<Student | null>(null);
  const [quickCommentText, setQuickCommentText] = useState('');
  const [memorizationSheetStudent, setMemorizationSheetStudent] = useState<Student | null>(null);
  const [memorizationInput, setMemorizationInput] = useState('');

  const [showDuplicateAlertsModal, setShowDuplicateAlertsModal] = useState(false);
  const [showDuplicateNamesModal, setShowDuplicateNamesModal] = useState(false);
  const [dismissedDuplicatePairs, setDismissedDuplicatePairs] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(rawSearch.trim());
    }, 150);
    return () => window.clearTimeout(timer);
  }, [rawSearch]);

  const weekInfo = useMemo(() => getWeekInfoByKey(selectedWeekKey), [selectedWeekKey]);

  const activeCards = useMemo(() => {
    const all = getAllCardDefinitions(group);
    const enabled = new Set(userProfile?.enabledCards ?? ALL_STANDARD_CARD_IDS);
    return all.filter((c) => c.id === 'CUSTOM_ELDER' || enabled.has(c.id));
  }, [group, userProfile?.enabledCards]);

  const collapsedSet = useMemo(
    () => new Set(userProfile?.collapsedBlockIds ?? []),
    [userProfile?.collapsedBlockIds]
  );

  const hiddenSet = useMemo(
    () => new Set(userProfile?.hiddenBlockIds ?? []),
    [userProfile?.hiddenBlockIds]
  );

  const visibleBlocks = useMemo(() => {
    if (debouncedSearch) return blocks;
    return blocks.filter((b) => !hiddenSet.has(b.id));
  }, [blocks, hiddenSet, debouncedSearch]);

  const hiddenCount = useMemo(
    () => blocks.filter((b) => hiddenSet.has(b.id)).length,
    [blocks, hiddenSet]
  );

  const attendanceByStudent = useMemo(() => {
    const map = new Map<string, 'PRESENT' | 'ABSENT' | 'ISSUE'>();
    for (const a of attendance) {
      if (a.weekKey === selectedWeekKey) {
        map.set(a.studentId, a.status);
      }
    }
    return map;
  }, [attendance, selectedWeekKey]);

  const monthBalanceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of monthlyBalances) {
      if (b.monthKey === selectedMonthKey) {
        map.set(b.studentId, b.totalPoints);
      }
    }
    return map;
  }, [monthlyBalances, selectedMonthKey]);

  const weekEventsByStudentCard = useMemo(() => {
    const map = new Map<string, typeof cardEvents>();
    for (const ev of cardEvents) {
      if (ev.weekKey !== selectedWeekKey) continue;
      const key = `${ev.studentId}__${ev.cardType}`;
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [cardEvents, selectedWeekKey]);

  const duplicateAlerts = useMemo(
    () => detectDuplicateCardAlerts(cardEvents, selectedWeekKey),
    [cardEvents, selectedWeekKey]
  );

  // Detect duplicate student names across the classroom
  const duplicateStudentPairs = useMemo(() => {
    const byNorm = new Map<string, Student[]>();
    for (const st of students) {
      const norm = normalizeArabicName(st.name);
      if (!norm) continue;
      const list = byNorm.get(norm) ?? [];
      list.push(st);
      byNorm.set(norm, list);
    }
    const pairs: Array<{ key: string; a: Student; b: Student }> = [];
    for (const [, list] of byNorm.entries()) {
      if (list.length >= 2) {
        const sorted = [...list].sort((x, y) => x.studentNumber - y.studentNumber);
        const a = sorted[0];
        const b = sorted[1];
        const key = [a.id, b.id].sort().join('__');
        if (!dismissedDuplicatePairs.has(key)) {
          pairs.push({ key, a, b });
        }
      }
    }
    return pairs;
  }, [students, dismissedDuplicatePairs]);

  const filteredStudents = useMemo(() => {
    if (!debouncedSearch) return students;
    const normQuery = normalizeArabicName(debouncedSearch.replace(/^#/, ''));
    return students.filter((s) => {
      const normName = normalizeArabicName(s.name);
      const numStr = String(s.studentNumber);
      return normName.includes(normQuery) || numStr.includes(normQuery);
    });
  }, [students, debouncedSearch]);

  const studentsByBlock = useMemo(() => {
    const map = new Map<string, Student[]>();
    const validBlockIds = new Set(blocks.map((b) => b.id));
    for (const s of filteredStudents) {
      const key = s.blockId && validBlockIds.has(s.blockId) ? s.blockId : '';
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    for (const [k, list] of map.entries()) {
      map.set(k, sortStudentsByPosition(list));
    }
    return map;
  }, [filteredStudents, blocks]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? null,
    [students, selectedStudentId]
  );

  const compact = Boolean(userProfile?.compactViewMode);
  const isLight = userProfile?.themeId === 'LIGHT';
  const canSeeLeaderboard = isAdmin || group?.showLeaderboard !== false;

  const handleToggleCollapse = async (blockId: string) => {
    const next = new Set(collapsedSet);
    if (next.has(blockId)) next.delete(blockId);
    else next.add(blockId);
    try {
      await updateProfile({ collapsedBlockIds: Array.from(next) });
    } catch {
      // ignore
    }
  };

  const handleHideBlock = async (blockId: string, blockName: string) => {
    const next = new Set(hiddenSet);
    next.add(blockId);
    try {
      await updateProfile({ hiddenBlockIds: Array.from(next) });
      showToast(`تم إخفاء بلوك "${blockName}" من الرئيسية`, 'info');
    } catch {
      showToast('تعذر إخفاء البلوك', 'error');
    }
  };

  const handleRestoreAllHiddenBlocks = async () => {
    try {
      await updateProfile({ hiddenBlockIds: [] });
      showToast('تم إظهار جميع البلوكات المخفية', 'success');
    } catch {
      showToast('تعذر استعادة البلوكات', 'error');
    }
  };

  const handleCardToggle = async (student: Student, cardType: CardTypeId) => {
    const key = `${student.id}__${cardType}`;
    if (busyCardKey === key) return;
    setBusyCardKey(key);
    try {
      const existingList = weekEventsByStudentCard.get(key) ?? [];
      const undoable = existingList.find((ev) =>
        canUserUndoCardEvent(group, userProfile?.userId, ev)
      );
      if (existingList.length > 0 && undoable) {
        await undoCard(undoable);
        showToast(
          `تم التراجع عن كارت ${getCardDefinition(cardType, group).titleAr} لـ ${student.name}`,
          'info'
        );
      } else {
        await awardCard(student, cardType, selectedWeekKey);
        const def = getCardDefinition(cardType, group);
        showToast(`+${def.points} نقطة (${def.titleAr}) لـ ${student.name}`, 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر تحديث الكارت', 'error');
    } finally {
      setBusyCardKey(null);
    }
  };

  const handleMoveStudent = async (list: Student[], index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const moving = list[index];
    const withoutMoving = list.filter((s) => s.id !== moving.id);
    const prevStudent = targetIdx > 0 ? withoutMoving[targetIdx - 1] : null;
    const nextStudent = targetIdx < withoutMoving.length ? withoutMoving[targetIdx] : null;
    try {
      await reorderStudent({
        studentId: moving.id,
        prevStudent,
        nextStudent,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر تغيير الترتيب', 'error');
    }
  };

  const handleQuickAssignToBlock = async (student: Student, block: ServantBlock) => {
    try {
      await editStudent(student.id, { blockId: block.id });
      showToast(`تم نقل ${student.name} إلى بلوك ${block.servantName}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر نقل الطفل', 'error');
    }
  };

  const renderStudentRow = (
    student: Student,
    list: Student[],
    idx: number,
    blockColor: string,
    isUnassignedSection = false
  ) => {
    const attRecordStatus = attendanceByStudent.get(student.id);
    const hasAttendanceCard =
      (weekEventsByStudentCard.get(`${student.id}__ATTENDANCE`) ?? []).length > 0;
    const isPresent = attRecordStatus === 'PRESENT' || hasAttendanceCard;
    const isAbsent = !isPresent && attRecordStatus === 'ABSENT';

    const points =
      monthBalanceMap.get(student.id) ??
      monthlyBalances.find((b) => b.id === buildMonthlyBalanceDocId(selectedMonthKey, student.id))
        ?.totalPoints ??
      0;

    return (
      <div
        key={student.id}
        className={`rounded-[16px] bg-[var(--kam-surface)] border border-[var(--kam-border)]/70 transition-colors ${
          compact ? 'p-2.5 space-y-2' : 'p-3 space-y-2.5'
        }`}
      >
        {/* Line 1: Avatar + Attendance Indicator Lamp + Full Student Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setSelectedStudentId(student.id)}
              aria-label={`ملف الطفل ${student.name}`}
              className="block"
            >
              <AvatarBadge
                studentId={student.id}
                hasAvatar={student.hasAvatar}
                directBase64={student.avatarBase64}
                name={student.name}
                initials={student.avatarInitials}
                size="sm"
                accentHex={blockColor}
              />
            </button>
            <button
              type="button"
              onClick={() => setQuickPeekStudent(student)}
              title="معاينة سريعة مكبرة"
              className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] flex items-center justify-center text-[var(--kam-text-secondary)] hover:text-[var(--kam-primary)]"
            >
              <ZoomIn className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* Glowing Attendance Indicator Lamp */}
          <span
            title={isPresent ? 'حاضر هذا الأسبوع' : isAbsent ? 'غائب هذا الأسبوع' : 'لم يُسجل حضور'}
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
            style={{
              backgroundColor: isPresent
                ? 'rgba(44, 181, 120, 0.25)'
                : isAbsent
                ? 'rgba(239, 83, 80, 0.22)'
                : 'transparent',
            }}
          >
            <span
              className="w-2 h-2 rounded-full border"
              style={{
                backgroundColor: isPresent
                  ? '#2CB578'
                  : isAbsent
                  ? '#EF5350'
                  : 'var(--kam-surface-variant)',
                borderColor: isPresent
                  ? '#2CB578'
                  : isAbsent
                  ? '#EF5350'
                  : 'rgba(154, 162, 188, 0.45)',
              }}
            />
          </span>

          <button
            type="button"
            onClick={() => setSelectedStudentId(student.id)}
            className="flex-1 min-w-0 text-right font-bold text-[15px] text-[var(--kam-text-primary)] hover:text-[var(--kam-primary)] leading-snug break-words"
          >
            {student.name}
          </button>
        </div>

        {/* Line 2: Student Number + Monthly Points Pill + Quick Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-num font-medium text-[var(--kam-text-secondary)]">
              رقم #{student.studentNumber}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[var(--kam-gold)]/15 text-[var(--kam-gold)] font-num font-bold text-xs">
              {points} نقطة
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Quick Comment Button */}
            <button
              type="button"
              onClick={() => {
                setQuickCommentStudent(student);
                setQuickCommentText('');
              }}
              title="إضافة تعليق سريع"
              className="w-7 h-7 rounded-lg bg-[#38A3E8]/14 text-[#38A3E8] flex items-center justify-center hover:opacity-90"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>

            {/* Reorder Up/Down */}
            {!debouncedSearch && list.length > 1 && (
              <>
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => handleMoveStudent(list, idx, -1)}
                  title="تحريك لأعلى"
                  className="w-7 h-7 rounded-lg bg-[var(--kam-surface-variant)] text-[var(--kam-text-secondary)] flex items-center justify-center disabled:opacity-30"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === list.length - 1}
                  onClick={() => handleMoveStudent(list, idx, 1)}
                  title="تحريك لأسفل"
                  className="w-7 h-7 rounded-lg bg-[var(--kam-surface-variant)] text-[var(--kam-text-secondary)] flex items-center justify-center disabled:opacity-30"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {/* Move Block Button */}
            <button
              type="button"
              onClick={() => setMoveBlockStudent(student)}
              title="نقل إلى بلوك خادم"
              className="w-7 h-7 rounded-lg bg-[var(--kam-surface-variant)] text-[var(--kam-text-secondary)] hover:text-[var(--kam-primary)] flex items-center justify-center"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            {/* History / Profile Button */}
            <button
              type="button"
              onClick={() => setSelectedStudentId(student.id)}
              title="سجل الكروت والتفاصيل"
              className="w-7 h-7 rounded-lg bg-[var(--kam-surface-variant)] text-[var(--kam-text-secondary)] hover:text-[var(--kam-primary)] flex items-center justify-center"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Last Memorization Badge if present */}
        {student.lastMemorizedText && (
          <button
            type="button"
            onClick={() => {
              setMemorizationSheetStudent(student);
              setMemorizationInput('');
            }}
            className="w-full px-2.5 py-1.5 rounded-[10px] bg-[#22B8B0]/12 border border-[#22B8B0]/35 flex items-center justify-between gap-2 text-right"
          >
            <span className="text-[11px] font-semibold text-[#22B8B0] truncate">
              📖 آخر حفظ: {student.lastMemorizedText}
            </span>
            <span className="text-[10px] text-[var(--kam-text-muted)] shrink-0">سجل الحفظ</span>
          </button>
        )}

        {/* Line 3: CompactCardButtonsRow (Matching CompactCardButtonsRow.kt 1:1) */}
        <div className="flex items-center gap-1.5">
          {activeCards.map((card) => {
            const key = `${student.id}__${card.id}`;
            const events = weekEventsByStudentCard.get(key) ?? [];
            const isSelected = events.length > 0;
            const accent = isLight ? card.lightHex : card.darkHex;

            return (
              <button
                key={card.id}
                type="button"
                disabled={busyCardKey === key}
                onClick={() => {
                  if (card.id === 'MEMORIZATION') {
                    setMemorizationSheetStudent(student);
                    setMemorizationInput('');
                  } else {
                    handleCardToggle(student, card.id);
                  }
                }}
                title={`${card.titleAr} (+${card.points})`}
                aria-label={`${isSelected ? 'تراجع عن' : 'منح'} كارت ${card.titleAr} لـ ${student.name}`}
                aria-pressed={isSelected}
                className="flex-1 h-[38px] rounded-[10px] border flex items-center justify-center font-num transition-all active:scale-90 select-none"
                style={{
                  backgroundColor: isSelected ? accent : 'var(--kam-surface-variant)',
                  borderColor: isSelected ? accent : `${accent}66`,
                  color: isSelected
                    ? accent === '#E5A436' || accent === '#22B8B0'
                      ? '#07080D'
                      : '#FFFFFF'
                    : accent,
                }}
              >
                {isSelected ? (
                  <span className="text-[13px] font-extrabold leading-none">{card.points}</span>
                ) : (
                  <span className="text-[15px] font-bold leading-none">{card.icon}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Block Assignment Row for Unassigned Students */}
        {isUnassignedSection && blocks.length > 0 && (
          <div className="pt-1 flex items-center gap-1.5 overflow-x-auto kam-scrollbar">
            <span className="text-[11px] text-[var(--kam-text-muted)] shrink-0">نقل سريع:</span>
            {blocks.map((blk) => (
              <button
                key={blk.id}
                type="button"
                onClick={() => handleQuickAssignToBlock(student, blk)}
                className="px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap shrink-0 transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: `${blk.colorHex}1F`,
                  borderColor: `${blk.colorHex}66`,
                  color: blk.colorHex,
                }}
              >
                ↗ {blk.servantName}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderBlockSection = (block: ServantBlock) => {
    const list = studentsByBlock.get(block.id) ?? [];
    if (debouncedSearch && list.length === 0) return null;
    const isCollapsed = collapsedSet.has(block.id) && !debouncedSearch;
    const servantMember = members.find((m) => m.uid === block.servantId);
    const online = servantMember ? isServantOnline(servantMember.lastSeenAt) : false;
    const phone = servantMember?.primaryPhone || servantMember?.phone || '';
    const canShowPhone =
      Boolean(phone) && !servantMember?.phoneHidden && servantMember?.showPhone !== false;

    return (
      <section key={block.id} className="space-y-1.5 pt-2">
        {/* ServantBlockHeaderCard (Matching HomeScreen.kt) */}
        <div
          className="rounded-[14px] border p-3 transition-colors"
          style={{
            backgroundColor: `${block.colorHex}20`,
            borderColor: `${block.colorHex}73`,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => handleToggleCollapse(block.id)}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-right"
            >
              <AvatarBadge
                directBase64={servantMember?.avatarBase64 || servantMember?.avatar}
                name={block.servantName}
                size="sm"
                accentHex={block.colorHex}
                online={online}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold text-[var(--kam-text-primary)] truncate">
                  بلوك {block.servantName}
                </div>
                <div className="text-[11px] text-[var(--kam-text-secondary)] truncate">
                  {group?.name} • <span className="font-num">{list.length}</span> طفل
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignServantBlock(block);
                    setAssignCustomName(block.servantName);
                  }}
                  className="px-2 py-1 rounded-lg bg-[var(--kam-surface)]/80 border flex items-center gap-1 text-[11px] font-bold"
                  style={{ borderColor: `${block.colorHex}66`, color: block.colorHex }}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>تعيين خادم</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleHideBlock(block.id, block.servantName)}
                title="إخفاء البلوك من الرئيسية"
                className="w-7 h-7 rounded-lg bg-[var(--kam-surface)]/70 flex items-center justify-center text-[var(--kam-text-muted)] hover:text-[var(--kam-text-primary)]"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleToggleCollapse(block.id)}
                className="px-2.5 py-1 rounded-[10px] flex items-center gap-1 font-num font-bold text-xs"
                style={{
                  backgroundColor: `${block.colorHex}38`,
                  color: block.colorHex,
                }}
              >
                <span>{list.length}</span>
                {isCollapsed ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {canShowPhone && (
            <div className="mt-2 pt-2 border-t border-[var(--kam-border)]/40 flex items-center justify-between gap-2 text-xs">
              <span className="font-num text-[var(--kam-text-secondary)]" dir="ltr">
                📞 {phone}
              </span>
              <div className="flex items-center gap-1.5">
                <a
                  href={buildTelLink(phone)}
                  className="px-2.5 py-1 rounded-lg bg-[var(--kam-surface)] text-[var(--kam-text-primary)] font-bold text-[11px] flex items-center gap-1"
                >
                  <Phone className="w-3 h-3 text-[var(--kam-primary)]" />
                  <span>اتصال</span>
                </a>
                <a
                  href={buildWhatsAppLink(phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-[#2CB578]/20 text-[#2CB578] font-bold text-[11px] flex items-center gap-1"
                >
                  <MessageCircle className="w-3 h-3" />
                  <span>واتساب</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Children rows */}
        {!isCollapsed && (
          <div className="space-y-1.5">
            {list.length === 0 ? (
              <div className="rounded-xl bg-[var(--kam-surface)]/60 border border-[var(--kam-border)]/50 px-4 py-4 text-center text-xs text-[var(--kam-text-muted)]">
                لا يوجد أطفال في هذا البلوك بعد
              </div>
            ) : (
              list.map((st, idx) => renderStudentRow(st, list, idx, block.colorHex, false))
            )}
          </div>
        )}
      </section>
    );
  };

  const unassignedStudents = studentsByBlock.get('') ?? [];
  const isUnassignedCollapsed = collapsedSet.has('__UNASSIGNED__') && !debouncedSearch;

  return (
    <div className="space-y-2.5 pb-16">
      {/* HomeTopControlCard (Matching HomeScreen.kt 1:1) */}
      <div className="rounded-[20px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-3 space-y-2.5 shadow-sm">
        {/* Row 1: Group Title on Right + 4 Action Buttons on Left */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] font-extrabold text-[var(--kam-text-primary)] truncate">
              {group?.name || 'نجم الكارت'}
            </h1>
            <div className="text-[11px] font-semibold text-[var(--kam-gold)]">نجم الكارت</div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* 1. Smart Attendance Swipe Button */}
            <button
              type="button"
              onClick={onOpenSmartAttendance}
              className="h-[38px] px-2.5 rounded-xl bg-[#2CB578]/16 border border-[#2CB578]/55 text-[#2CB578] font-bold text-xs flex items-center gap-1 hover:opacity-90"
            >
              <span>📋</span>
              <span>سحب</span>
            </button>

            {/* 2. Search Toggle Icon Button */}
            <button
              type="button"
              onClick={() => {
                if (isSearchExpanded) {
                  setRawSearch('');
                  setIsSearchExpanded(false);
                } else {
                  setIsSearchExpanded(true);
                }
              }}
              aria-label="بحث"
              className={`w-[38px] h-[38px] rounded-xl border flex items-center justify-center transition-colors ${
                isSearchExpanded || rawSearch
                  ? 'bg-[var(--kam-primary)]/22 border-[var(--kam-primary)] text-[var(--kam-primary)]'
                  : 'bg-[var(--kam-surface-variant)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
              }`}
            >
              {isSearchExpanded ? <X className="w-[18px] h-[18px]" /> : <Search className="w-[18px] h-[18px]" />}
            </button>

            {/* 3. Full Class Leaderboard Trophy Button */}
            {canSeeLeaderboard && (
              <button
                type="button"
                onClick={onOpenLeaderboard}
                aria-label="ترتيب الفصل الكامل"
                className="w-[38px] h-[38px] rounded-xl bg-[var(--kam-gold)]/16 border border-[var(--kam-gold)]/55 text-[var(--kam-gold)] flex items-center justify-center hover:opacity-90"
              >
                <Trophy className="w-[18px] h-[18px]" />
              </button>
            )}

            {/* 4. Duplicate Card Alerts Bell Button */}
            <button
              type="button"
              onClick={() => setShowDuplicateAlertsModal(true)}
              aria-label="إشعارات تكرار الكروت"
              className={`relative w-[38px] h-[38px] rounded-xl border flex items-center justify-center transition-colors ${
                duplicateAlerts.length > 0
                  ? 'bg-[var(--kam-danger)]/16 border-[var(--kam-danger)]/60 text-[var(--kam-danger)]'
                  : 'bg-[var(--kam-surface-variant)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
              }`}
            >
              <Bell className="w-[18px] h-[18px]" />
              {duplicateAlerts.length > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[var(--kam-danger)] text-white font-num font-bold text-[10px] flex items-center justify-center">
                  {duplicateAlerts.length > 9 ? '9+' : duplicateAlerts.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Dedicated Calendar Strip (Prev | Month • Week | Next) */}
        <div className="rounded-[14px] bg-[var(--kam-surface-variant)]/55 border border-[var(--kam-primary)]/35 px-1.5 py-1 flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => setSelectedWeekKey(shiftWeekKey(selectedWeekKey, -1).weekKey)}
            aria-label="الأسبوع السابق"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--kam-text-secondary)] hover:bg-[var(--kam-surface)]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setCalendarOpen(true)}
            className="flex-1 py-1 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--kam-text-primary)] hover:bg-[var(--kam-surface)]/50 truncate"
          >
            <Calendar className="w-3.5 h-3.5 text-[var(--kam-primary)] shrink-0" />
            <span className="truncate">
              {formatMonthTitleAr(selectedMonthKey)} • {weekInfo?.labelAr || selectedWeekKey}
            </span>
            <span className="text-[11px] font-bold text-[var(--kam-primary)] shrink-0">▾</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedWeekKey(shiftWeekKey(selectedWeekKey, 1).weekKey)}
            aria-label="الأسبوع التالي"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--kam-text-secondary)] hover:bg-[var(--kam-surface)]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Expandable Search Input */}
        {(isSearchExpanded || rawSearch) && (
          <div className="relative pt-0.5">
            <Search className="w-4 h-4 text-[var(--kam-text-muted)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              autoFocus
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder="ابحث باسم الطفل أو رقمه..."
              className="w-full h-11 pr-10 pl-9 rounded-[14px] bg-[var(--kam-bg)] border border-[var(--kam-primary)] text-sm text-[var(--kam-text-primary)] outline-none"
            />
            {rawSearch && (
              <button
                type="button"
                onClick={() => setRawSearch('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--kam-text-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Inline Duplicate Card Alert Strip */}
        {duplicateAlerts.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDuplicateAlertsModal(true)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--kam-danger)]/14 border border-[var(--kam-danger)]/45 flex items-center justify-between gap-2 text-right"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-[var(--kam-danger)] shrink-0" />
              <span className="text-xs font-bold text-[var(--kam-danger)] truncate">
                يوجد {duplicateAlerts.length} تنبيه تكرار كارت لنفس الطفل
              </span>
            </div>
            <span className="text-[11px] font-bold text-[var(--kam-primary)] shrink-0">عرض</span>
          </button>
        )}
      </div>

      {/* Duplicate Student Names Comparison Banner */}
      {duplicateStudentPairs.length > 0 && (
        <div className="rounded-[14px] bg-[#E8854A]/14 border border-[#E8854A]/55 p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-5 h-5 text-[#E8854A] shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#E8854A]">
                تم اكتشاف {duplicateStudentPairs.length} اسم متطابق في المجموعة
              </div>
              <div className="text-[11px] text-[var(--kam-text-secondary)] truncate">
                قارن النقاط والبلوك لدمج السجلين أو الإبقاء عليهما
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDuplicateNamesModal(true)}
            className="px-3 py-1.5 rounded-xl bg-[#E8854A] text-[#07080D] font-bold text-xs shrink-0"
          >
            مقارنة ودمج
          </button>
        </div>
      )}

      {/* Hidden Blocks Quick Restore Strip */}
      {hiddenCount > 0 && !debouncedSearch && (
        <div className="px-3 py-2 rounded-[14px] bg-[var(--kam-surface)] border border-[var(--kam-border)] flex items-center justify-between gap-2 text-xs">
          <span className="text-[var(--kam-text-secondary)] flex items-center gap-1.5">
            <EyeOff className="w-3.5 h-3.5 text-[var(--kam-text-muted)] shrink-0" />
            <span>يوجد {hiddenCount} بلوك مخفي من شاشتك</span>
          </span>
          <button
            type="button"
            onClick={handleRestoreAllHiddenBlocks}
            className="px-2.5 py-1 rounded-lg bg-[var(--kam-primary)]/18 text-[var(--kam-primary)] font-bold flex items-center gap-1 shrink-0"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>إظهار الكل</span>
          </button>
        </div>
      )}

      {/* Servant Blocks */}
      <div className="space-y-2">
        {visibleBlocks.map(renderBlockSection)}

        {/* Unassigned Students Section (بدون بلوك) */}
        {(unassignedStudents.length > 0 || visibleBlocks.length === 0) && (
          <section className="space-y-1.5 pt-2">
            <button
              type="button"
              onClick={() => handleToggleCollapse('__UNASSIGNED__')}
              className="w-full rounded-[14px] bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] p-3 flex items-center justify-between gap-2 text-right"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Users className="w-5 h-5 text-[var(--kam-gold)] shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[var(--kam-text-primary)]">
                    بدون بلوك (الأسماء الجديدة)
                  </div>
                  <div className="text-[11px] text-[var(--kam-text-secondary)]">
                    {isUnassignedCollapsed
                      ? 'مخفي • اضغط لإظهار الأطفال غير الموزعين'
                      : 'اضغط على زر النقل لتوزيع الطفل على بلوك خادم'}
                  </div>
                </div>
              </div>
              <div className="px-2.5 py-1 rounded-[10px] bg-[var(--kam-gold)]/20 text-[var(--kam-gold)] font-num font-bold text-xs flex items-center gap-1 shrink-0">
                <span>{unassignedStudents.length}</span>
                {isUnassignedCollapsed ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </div>
            </button>

            {!isUnassignedCollapsed && (
              <div className="space-y-1.5">
                {unassignedStudents.length === 0 ? (
                  <div className="rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] px-4 py-6 text-center text-xs text-[var(--kam-text-muted)]">
                    {debouncedSearch
                      ? 'لا توجد نتائج مطابقة للبحث.'
                      : 'لا يوجد أطفال بدون بلوك حالياً.'}
                  </div>
                ) : (
                  unassignedStudents.map((st, idx) =>
                    renderStudentRow(st, unassignedStudents, idx, '#E5A436', true)
                  )
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Auto-Shrinking Floating Action Button (+ إضافة / استيراد) */}
      {userProfile?.showFloatingAddButton !== false && (
        <div className="fixed bottom-20 inset-x-0 z-30 pointer-events-none flex justify-center">
          <div className="w-full max-w-[500px] px-4 flex justify-start">
            <button
              type="button"
              onClick={() => setQuickAddDialogOpen(true)}
              className="pointer-events-auto h-11 px-4 rounded-2xl bg-[var(--kam-primary)] text-[var(--kam-on-primary)] font-bold text-xs shadow-xl flex items-center gap-1.5 hover:opacity-95 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة / استيراد</span>
            </button>
          </div>
        </div>
      )}

      {/* QuickAddActionDialog (إضافة طفل واحد / استيراد قائمة أسماء / إضافة بلوك خادم جديد) */}
      {quickAddDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setQuickAddDialogOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[380px] rounded-[22px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[var(--kam-text-primary)]">
                إضافة سريعة للفصل
              </h3>
              <button
                type="button"
                onClick={() => setQuickAddDialogOpen(false)}
                className="w-8 h-8 rounded-full bg-[var(--kam-surface-variant)] flex items-center justify-center text-[var(--kam-text-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setQuickAddDialogOpen(false);
                setAddDefaultBlock('');
                setAddStudentOpen(true);
              }}
              className="w-full h-12 px-4 rounded-xl bg-[var(--kam-primary)] text-[var(--kam-on-primary)] font-bold text-xs flex items-center gap-2.5"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>إضافة طفل واحد</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickAddDialogOpen(false);
                setBulkImportOpen(true);
              }}
              className="w-full h-12 px-4 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-[var(--kam-text-primary)] font-bold text-xs flex items-center gap-2.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-[var(--kam-gold)] shrink-0" />
              <span>استيراد قائمة أسماء (حتى ١٥٠ للمجموعة)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickAddDialogOpen(false);
                setNewBlockName('');
                setNewBlockColor(
                  BLOCK_COLOR_PALETTE[blocks.length % BLOCK_COLOR_PALETTE.length]
                );
                setCreateBlockModalOpen(true);
              }}
              className="w-full h-12 px-4 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-[var(--kam-text-primary)] font-bold text-xs flex items-center gap-2.5"
            >
              <Users className="w-4 h-4 text-[#2CB578] shrink-0" />
              <span>إضافة بلوك خادم جديد</span>
            </button>
          </div>
        </div>
      )}

      {/* Create Servant Block Dialog */}
      {createBlockModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setCreateBlockModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newBlockName.trim()) return;
              await createBlock({
                servantId: userProfile?.userId || '',
                servantName: newBlockName.trim(),
                colorHex: newBlockColor,
              });
              setCreateBlockModalOpen(false);
            }}
            className="w-full max-w-[380px] rounded-[22px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-5 space-y-4"
          >
            <h3 className="text-base font-extrabold">إضافة بلوك خادم جديد</h3>
            <div>
              <label className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1.5">
                اسم الخادم / البلوك
              </label>
              <input
                type="text"
                required
                value={newBlockName}
                onChange={(e) => setNewBlockName(e.target.value)}
                placeholder="مثال: أ. بيتر"
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--kam-bg)] border border-[var(--kam-border)] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1.5">
                لون البلوك
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {BLOCK_COLOR_PALETTE.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setNewBlockColor(hex)}
                    className={`w-7 h-7 rounded-full border-2 ${
                      newBlockColor === hex ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 h-11 rounded-xl bg-[var(--kam-primary)] text-[var(--kam-on-primary)] font-bold text-xs"
              >
                حفظ البلوك
              </button>
              <button
                type="button"
                onClick={() => setCreateBlockModalOpen(false)}
                className="px-4 h-11 rounded-xl bg-[var(--kam-surface-variant)] text-xs font-semibold"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assign Servant To Block Dialog (Admin) */}
      {assignServantBlock && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setAssignServantBlock(null)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[390px] rounded-[22px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-5 space-y-3.5"
          >
            <h3 className="text-base font-extrabold">
              تعيين خادم لـ بلوك {assignServantBlock.servantName}
            </h3>
            <p className="text-xs text-[var(--kam-text-secondary)]">
              اختر خادماً من أعضاء المجموعة أو اكتب اسماً مخصصاً للبلوك:
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1.5 kam-scrollbar">
              {members.map((m) => (
                <button
                  key={m.uid}
                  type="button"
                  onClick={async () => {
                    await updateBlock(assignServantBlock.id, {
                      servantId: m.uid,
                      servantName: m.displayName,
                    });
                    setAssignServantBlock(null);
                  }}
                  className="w-full p-2.5 rounded-xl bg-[var(--kam-surface-variant)] hover:border-[var(--kam-primary)] border border-[var(--kam-border)] flex items-center justify-between text-xs font-bold"
                >
                  <span>{m.displayName}</span>
                  <span className="text-[10px] text-[var(--kam-primary)]">اختيار</span>
                </button>
              ))}
            </div>
            <div className="pt-2 border-t border-[var(--kam-border)] space-y-2">
              <input
                type="text"
                value={assignCustomName}
                onChange={(e) => setAssignCustomName(e.target.value)}
                placeholder="أو اكتب اسم البلوك يدوياً..."
                className="w-full h-10 px-3 rounded-xl bg-[var(--kam-bg)] border border-[var(--kam-border)] text-xs"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!assignCustomName.trim()) return;
                    await updateBlock(assignServantBlock.id, {
                      servantName: assignCustomName.trim(),
                    });
                    setAssignServantBlock(null);
                  }}
                  className="flex-1 h-10 rounded-xl bg-[var(--kam-primary)] text-[var(--kam-on-primary)] font-bold text-xs"
                >
                  تحديث الاسم
                </button>
                <button
                  type="button"
                  onClick={() => setAssignServantBlock(null)}
                  className="px-4 h-10 rounded-xl bg-[var(--kam-surface-variant)] text-xs"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move Student To Block Dialog */}
      {moveBlockStudent && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setMoveBlockStudent(null)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[380px] rounded-[22px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-5 space-y-3"
          >
            <h3 className="text-base font-extrabold">نقل "{moveBlockStudent.name}" إلى بلوك</h3>
            <div className="space-y-1.5 max-h-64 overflow-y-auto kam-scrollbar">
              {blocks.map((blk) => (
                <button
                  key={blk.id}
                  type="button"
                  onClick={async () => {
                    await editStudent(moveBlockStudent.id, { blockId: blk.id });
                    setMoveBlockStudent(null);
                  }}
                  className="w-full p-3 rounded-xl bg-[var(--kam-surface-variant)] border flex items-center justify-between text-xs font-bold"
                  style={{
                    borderColor:
                      moveBlockStudent.blockId === blk.id ? blk.colorHex : 'var(--kam-border)',
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: blk.colorHex }}
                    />
                    <span>بلوك {blk.servantName}</span>
                  </span>
                  {moveBlockStudent.blockId === blk.id && (
                    <span className="text-[10px] text-[var(--kam-primary)]">البلوك الحالي</span>
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={async () => {
                  await editStudent(moveBlockStudent.id, { blockId: '' });
                  setMoveBlockStudent(null);
                }}
                className="w-full p-3 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] flex items-center justify-between text-xs font-bold text-[var(--kam-gold)]"
              >
                <span>بدون بلوك (الأسماء الجديدة)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Comment Sheet */}
      {quickCommentStudent && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setQuickCommentStudent(null)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!quickCommentText.trim()) return;
              await createChildNote({
                student: quickCommentStudent,
                type: 'COMMENT',
                text: quickCommentText.trim(),
              });
              showToast(`تم حفظ التعليق لـ ${quickCommentStudent.name}`, 'success');
              setQuickCommentStudent(null);
            }}
            className="w-full max-w-[380px] rounded-[22px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-5 space-y-3"
          >
            <h3 className="text-base font-extrabold">
              💬 تعليق سريع — {quickCommentStudent.name}
            </h3>
            <textarea
              rows={3}
              required
              autoFocus
              value={quickCommentText}
              onChange={(e) => setQuickCommentText(e.target.value)}
              placeholder="اكتب ملاحظة أو تعليقاً حول الطفل..."
              className="w-full p-3 rounded-xl bg-[var(--kam-bg)] border border-[var(--kam-border)] text-xs"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 h-10 rounded-xl bg-[var(--kam-primary)] text-[var(--kam-on-primary)] font-bold text-xs"
              >
                حفظ التعليق
              </button>
              <button
                type="button"
                onClick={() => setQuickCommentStudent(null)}
                className="px-4 h-10 rounded-xl bg-[var(--kam-surface-variant)] text-xs"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Memorization Notes Sheet (Matching MemorizationNotesSheet in HomeScreen.kt) */}
      {memorizationSheetStudent && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setMemorizationSheetStudent(null)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[400px] rounded-[22px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-[#22B8B0]">
                  📖 كارت وسجل المحفوظات
                </h3>
                <p className="text-xs text-[var(--kam-text-secondary)]">
                  {memorizationSheetStudent.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMemorizationSheetStudent(null)}
                className="w-8 h-8 rounded-full bg-[var(--kam-surface-variant)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const key = `${memorizationSheetStudent.id}__MEMORIZATION`;
              const memEvents = weekEventsByStudentCard.get(key) ?? [];
              const hasMemCard = memEvents.length > 0;
              return (
                <button
                  type="button"
                  onClick={() => handleCardToggle(memorizationSheetStudent, 'MEMORIZATION')}
                  className={`w-full h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-colors ${
                    hasMemCard
                      ? 'bg-[#22B8B0] text-[#07080D] border-[#22B8B0]'
                      : 'bg-[#22B8B0]/15 text-[#22B8B0] border-[#22B8B0]/50'
                  }`}
                >
                  <span>📖</span>
                  <span>
                    {hasMemCard
                      ? 'تم منح كارت المحفوظات هذا الأسبوع (+6) — اضغط للتراجع'
                      : 'منح كارت المحفوظات هذا الأسبوع (+6 نقاط)'}
                  </span>
                </button>
              );
            })()}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!memorizationInput.trim()) return;
                await createChildNote({
                  student: memorizationSheetStudent,
                  type: 'MEMORIZATION',
                  text: memorizationInput.trim(),
                });
                const key = `${memorizationSheetStudent.id}__MEMORIZATION`;
                const hasMemCard = (weekEventsByStudentCard.get(key) ?? []).length > 0;
                if (!hasMemCard) {
                  await handleCardToggle(memorizationSheetStudent, 'MEMORIZATION');
                }
                setMemorizationInput('');
                showToast('تم تسجيل تسميع المحفوظات', 'success');
              }}
              className="space-y-2"
            >
              <label className="block text-xs font-bold text-[var(--kam-text-secondary)]">
                ما الذي سمّعه الطفل اليوم؟ (مزمور / آية / لحن)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={memorizationInput}
                  onChange={(e) => setMemorizationInput(e.target.value)}
                  placeholder="مثال: المزمور الخمسون / طوبى للرحماء..."
                  className="flex-1 h-10 px-3 rounded-xl bg-[var(--kam-bg)] border border-[var(--kam-border)] text-xs"
                />
                <button
                  type="submit"
                  className="h-10 px-3.5 rounded-xl bg-[#22B8B0] text-[#07080D] font-bold text-xs shrink-0"
                >
                  حفظ + كارت
                </button>
              </div>
            </form>

            {/* Previous memorization notes */}
            <div className="max-h-40 overflow-y-auto space-y-1.5 kam-scrollbar pt-1">
              {childNotes
                .filter(
                  (n) =>
                    n.studentId === memorizationSheetStudent.id && n.type === 'MEMORIZATION'
                )
                .slice(0, 6)
                .map((note) => (
                  <div
                    key={note.id}
                    className="p-2.5 rounded-xl bg-[var(--kam-surface-variant)] text-xs space-y-0.5"
                  >
                    <div className="font-semibold text-[var(--kam-text-primary)]">{note.text}</div>
                    <div className="text-[10px] text-[var(--kam-text-muted)]">
                      بواسطة {note.authorName}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Card Alerts Dialog */}
      {showDuplicateAlertsModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowDuplicateAlertsModal(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] rounded-[22px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[var(--kam-text-primary)]">
                🔔 تنبيهات تكرار الكروت ({duplicateAlerts.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowDuplicateAlertsModal(false)}
                className="w-8 h-8 rounded-full bg-[var(--kam-surface-variant)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {duplicateAlerts.length === 0 ? (
              <div className="py-6 text-center text-xs text-[var(--kam-text-muted)]">
                لا توجد أي كروت مكررة لنفس الطفل في هذا الأسبوع.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto kam-scrollbar">
                {duplicateAlerts.map((alert) => {
                  const def = getCardDefinition(alert.cardType, group);
                  const latestEv = alert.events[0];
                  const canUndo = canUserUndoCardEvent(group, userProfile?.userId, latestEv);
                  const servants = alert.events
                    .map((e) => getServantDisplayName(e.servantId, e.servantName))
                    .join(' و ');
                  return (
                    <div
                      key={alert.key}
                      className="p-3 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-xs space-y-2"
                    >
                      <div>
                        <span className="font-bold">{alert.studentName}</span> حصل على كارت{' '}
                        <span className="font-bold">{def.titleAr}</span>{' '}
                        <span className="font-num font-bold text-[var(--kam-warning)]">
                          {alert.events.length} مرات
                        </span>{' '}
                        ({servants})
                      </div>
                      <div className="flex items-center gap-2">
                        {canUndo && (
                          <button
                            type="button"
                            onClick={async () => {
                              await undoCard(latestEv);
                              showToast('تم التراجع عن الكارت المكرر', 'success');
                            }}
                            className="h-8 px-3 rounded-lg font-bold text-[var(--kam-danger)] border border-[var(--kam-danger)]/40 flex items-center gap-1"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            <span>حذف المكرر</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await sendGroupChatMessage({
                              type: 'SYSTEM',
                              text: `تنبيه تكرار كارت ${def.titleAr} للطفل ${alert.studentName} (${alert.events.length} مرات في ${alert.weekKey}) من: ${servants}`,
                              notificationCategory: 'CONFLICT',
                              childId: alert.studentId,
                              childName: alert.studentName,
                            });
                            showToast('تم إرسال تنبيه التكرار لشات الفصل', 'info');
                          }}
                          className="h-8 px-3 rounded-lg font-bold bg-[var(--kam-surface)] border border-[var(--kam-border)] flex items-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>إرسال للشات</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Duplicate Student Names Comparison & Merge Dialog */}
      {showDuplicateNamesModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowDuplicateNamesModal(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[430px] rounded-[22px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#E8854A]">
                مقارنة ودمج الأسماء المتطابقة
              </h3>
              <button
                type="button"
                onClick={() => setShowDuplicateNamesModal(false)}
                className="w-8 h-8 rounded-full bg-[var(--kam-surface-variant)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto kam-scrollbar">
              {duplicateStudentPairs.map((pair) => {
                const blockA =
                  blocks.find((b) => b.id === pair.a.blockId)?.servantName || 'بدون بلوك';
                const blockB =
                  blocks.find((b) => b.id === pair.b.blockId)?.servantName || 'بدون بلوك';
                const ptsA = monthBalanceMap.get(pair.a.id) ?? 0;
                const ptsB = monthBalanceMap.get(pair.b.id) ?? 0;

                return (
                  <div
                    key={pair.key}
                    className="p-3 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] space-y-2.5 text-xs"
                  >
                    <div className="font-extrabold text-sm text-[var(--kam-text-primary)]">
                      {pair.a.name}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-[var(--kam-surface)] border border-[var(--kam-border)]">
                        <div className="font-bold">سجل #{pair.a.studentNumber}</div>
                        <div className="text-[11px] text-[var(--kam-text-secondary)]">{blockA}</div>
                        <div className="font-num font-bold text-[var(--kam-gold)] mt-0.5">
                          {ptsA} نقطة
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-[var(--kam-surface)] border border-[var(--kam-border)]">
                        <div className="font-bold">سجل #{pair.b.studentNumber}</div>
                        <div className="text-[11px] text-[var(--kam-text-secondary)]">{blockB}</div>
                        <div className="font-num font-bold text-[var(--kam-gold)] mt-0.5">
                          {ptsB} نقطة
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await mergeDuplicateStudents(pair.a.id, pair.b.id);
                        }}
                        className="flex-1 h-9 rounded-lg bg-[var(--kam-primary)] text-[var(--kam-on-primary)] font-bold text-xs"
                      >
                        دمج في #{pair.a.studentNumber}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDismissedDuplicatePairs((prev) => new Set([...prev, pair.key]));
                        }}
                        className="px-3 h-9 rounded-lg bg-[var(--kam-surface)] border border-[var(--kam-border)] font-semibold text-xs"
                      >
                        الاحتفاظ بالاثنين
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Standard Modals */}
      <CalendarTreeModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        selectedWeekKeys={[selectedWeekKey]}
        singleSelect
        onApply={(wks) => {
          if (wks[0]) setSelectedWeekKey(wks[0]);
        }}
      />
      <AddEditStudentModal
        open={addStudentOpen}
        onClose={() => setAddStudentOpen(false)}
        defaultBlockId={addDefaultBlock}
      />
      <BulkImportModal open={bulkImportOpen} onClose={() => setBulkImportOpen(false)} />
      <ChildProfileModal student={selectedStudent} onClose={() => setSelectedStudentId(null)} />
    </div>
  );
};
