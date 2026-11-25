import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileSpreadsheet,
  HeartHandshake,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trophy,
  Undo2,
  UserPlus,
  MessageCircle,
} from 'lucide-react';
import { useKam } from '../context/KamContext';
import { AvatarBadge } from '../components/ui/AvatarBadge';
import { CalendarTreeModal } from '../components/calendar/CalendarTreeModal';
import { AddEditStudentModal } from '../components/students/AddEditStudentModal';
import { BulkImportModal } from '../components/students/BulkImportModal';
import { ChildProfileModal } from '../components/students/ChildProfileModal';
import { isServantOnline, normalizeArabicName } from '../lib/arabic';
import {
  formatMonthTitleAr,
  getWeekInfoByKey,
  shiftWeekKey,
} from '../lib/calendar';
import {
  ALL_STANDARD_CARD_IDS,
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
  onOpenVisitation,
  onOpenLeaderboard,
}) => {
  const {
    group,
    joinedGroups,
    userProfile,
    blocks,
    students,
    cardEvents,
    monthlyBalances,
    attendance,
    members,
    isAdmin,
    selectedWeekKey,
    selectedMonthKey,
    setSelectedWeekKey,
    switchGroup,
    refreshAllData,
    updateProfile,
    awardCard,
    undoCard,
    reorderStudent,
    sendGroupChatMessage,
    getServantDisplayName,
    showToast,
  } = useKam();

  const [rawSearch, setRawSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [addDefaultBlock, setAddDefaultBlock] = useState('');
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [busyCardKey, setBusyCardKey] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(rawSearch.trim());
    }, 180);
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
      // ignore transient error
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

  const handleCardChipClick = async (student: Student, cardType: CardTypeId) => {
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

  const handleSync = async () => {
    setSyncing(true);
    try {
      await refreshAllData();
    } finally {
      setSyncing(false);
    }
  };

  const renderStudentRow = (student: Student, list: Student[], idx: number, blockColor?: string) => {
    const attStatus = attendanceByStudent.get(student.id);
    const points =
      monthBalanceMap.get(student.id) ??
      monthlyBalances.find((b) => b.id === buildMonthlyBalanceDocId(selectedMonthKey, student.id))
        ?.totalPoints ??
      0;

    return (
      <div
        key={student.id}
        className={`flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 border-b border-[var(--kam-border)] last:border-b-0 transition-colors hover:bg-[var(--kam-surface-variant)]/40 ${
          compact ? 'px-3 py-2' : 'px-3.5 py-3'
        }`}
      >
        {/* Top/Right Row: Avatar, Number, Name, Attendance Lamp, Monthly Points, Mobile Reorder */}
        <div className="flex items-center justify-between xl:justify-start gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setSelectedStudentId(student.id)}
            aria-label={`فتح ملف الطفل ${student.name}`}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-right group py-0.5"
          >
            <AvatarBadge
              studentId={student.id}
              hasAvatar={student.hasAvatar}
              directBase64={student.avatarBase64}
              name={student.name}
              initials={student.avatarInitials}
              size={compact ? 'xs' : 'sm'}
              accentColor={blockColor}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-num font-bold text-[var(--kam-text-muted)] shrink-0">
                  #{student.studentNumber}
                </span>
                <span className="text-sm font-bold text-[var(--kam-text-primary)] group-hover:text-[var(--kam-primary)] truncate transition-colors">
                  {student.name}
                </span>
                {attStatus && (
                  <span
                    title={
                      attStatus === 'PRESENT'
                        ? 'حاضر'
                        : attStatus === 'ABSENT'
                        ? 'غائب'
                        : 'عمل مشكلة'
                    }
                    aria-label={
                      attStatus === 'PRESENT'
                        ? 'حاضر'
                        : attStatus === 'ABSENT'
                        ? 'غائب'
                        : 'عمل مشكلة'
                    }
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      attStatus === 'PRESENT'
                        ? 'bg-[var(--kam-success)]'
                        : attStatus === 'ABSENT'
                        ? 'bg-[var(--kam-danger)]'
                        : 'bg-[var(--kam-warning)]'
                    }`}
                  />
                )}
              </div>
              {!compact && student.lastMemorizedText && (
                <p className="text-[0.72rem] text-[var(--kam-text-muted)] truncate max-w-xs">
                  آخر حفظ: {student.lastMemorizedText}
                </p>
              )}
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0 xl:mr-2">
            <span className="text-xs font-num font-extrabold text-[var(--kam-primary)] px-2 py-0.5 rounded-lg bg-[var(--kam-primary-container)]/50">
              {points} ن
            </span>
            {!debouncedSearch && list.length > 1 && (
              <div className="flex items-center">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => handleMoveStudent(list, idx, -1)}
                  aria-label={`تحريك ${student.name} للأعلى`}
                  className="min-h-[34px] min-w-[30px] flex items-center justify-center rounded-lg text-[var(--kam-text-muted)] hover:text-[var(--kam-text-primary)] disabled:opacity-25"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === list.length - 1}
                  onClick={() => handleMoveStudent(list, idx, 1)}
                  aria-label={`تحريك ${student.name} للأسفل`}
                  className="min-h-[34px] min-w-[30px] flex items-center justify-center rounded-lg text-[var(--kam-text-muted)] hover:text-[var(--kam-text-primary)] disabled:opacity-25"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom/Left Row: Touch-Friendly Quick Card Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {activeCards.map((card) => {
            const key = `${student.id}__${card.id}`;
            const events = weekEventsByStudentCard.get(key) ?? [];
            const awarded = events.length > 0;
            const accent = isLight ? card.lightHex : card.darkHex;

            return (
              <button
                key={card.id}
                type="button"
                disabled={busyCardKey === key}
                onClick={() => handleCardChipClick(student, card.id)}
                title={`${card.titleAr} (+${card.points})${awarded ? ' — اضغط للتراجع' : ''}`}
                aria-label={`${awarded ? 'تراجع عن' : 'منح'} كارت ${card.titleAr} لـ ${student.name}`}
                aria-pressed={awarded}
                className={`min-h-[36px] px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1 whitespace-nowrap shrink-0 active:scale-[0.96] ${
                  awarded
                    ? 'text-white shadow-xs'
                    : 'bg-[var(--kam-surface-variant)] border-[var(--kam-border)] text-[var(--kam-text-secondary)] hover:border-[var(--kam-border-strong)]'
                }`}
                style={awarded ? { backgroundColor: accent, borderColor: accent } : undefined}
              >
                <span aria-hidden="true">{card.icon}</span>
                <span className={compact ? 'hidden sm:inline' : ''}>{card.titleAr}</span>
                {events.length > 1 && (
                  <span className="font-num text-[0.68rem] font-bold opacity-95">×{events.length}</span>
                )}
              </button>
            );
          })}
        </div>
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
      <section
        key={block.id}
        className="rounded-2xl border border-[var(--kam-border)] bg-[var(--kam-surface)] overflow-hidden"
      >
        {/* Block header */}
        <div className="px-3.5 py-2.5 bg-[var(--kam-surface-variant)]/55 border-b border-[var(--kam-border)] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleToggleCollapse(block.id)}
            aria-expanded={!isCollapsed}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-right py-1"
          >
            <AvatarBadge
              directBase64={servantMember?.avatarBase64 || servantMember?.avatar}
              name={block.servantName}
              size="sm"
              accentColor={block.colorHex}
              online={online}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: block.colorHex }}
                  aria-hidden="true"
                />
                <h2 className="text-sm font-bold truncate">{block.servantName}</h2>
                <span className="text-xs font-num text-[var(--kam-text-muted)] shrink-0">
                  ({list.length})
                </span>
              </div>
              {servantMember && (
                <p className="text-[0.72rem] text-[var(--kam-text-muted)] truncate">
                  {getServantDisplayName(servantMember.uid, servantMember.displayName)}
                  {online ? ' · متصل الآن' : ''}
                </p>
              )}
            </div>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            {canShowPhone && (
              <>
                <a
                  href={buildTelLink(phone)}
                  aria-label={`اتصال بـ ${block.servantName}`}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] text-[var(--kam-text-secondary)] hover:text-[var(--kam-primary)] transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
                <a
                  href={buildWhatsAppLink(phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`واتساب ${block.servantName}`}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] text-[var(--kam-success)] hover:border-[var(--kam-success)] transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </a>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setAddDefaultBlock(block.id);
                setAddStudentOpen(true);
              }}
              aria-label={`إضافة طفل إلى ${block.servantName}`}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] text-[var(--kam-text-secondary)] hover:text-[var(--kam-primary)] transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleHideBlock(block.id, block.servantName)}
              title="إخفاء البلوك من الرئيسية"
              aria-label={`إخفاء بلوك ${block.servantName}`}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[var(--kam-text-muted)] hover:bg-[var(--kam-surface)] hover:text-[var(--kam-text-primary)]"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleToggleCollapse(block.id)}
              aria-label={isCollapsed ? 'إظهار البلوك' : 'طي البلوك'}
              className="min-h-[38px] min-w-[36px] flex items-center justify-center rounded-xl text-[var(--kam-text-muted)] hover:bg-[var(--kam-surface)]"
            >
              {isCollapsed ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div>
            {list.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-[var(--kam-text-muted)]">
                لا يوجد أطفال في هذا البلوك بعد.
              </div>
            ) : (
              list.map((st, idx) => renderStudentRow(st, list, idx, block.colorHex))
            )}
          </div>
        )}
      </section>
    );
  };

  const unassignedStudents = studentsByBlock.get('') ?? [];
  const totalPresentThisWeek = attendance.filter(
    (a) => a.weekKey === selectedWeekKey && a.status === 'PRESENT'
  ).length;

  return (
    <div className="space-y-4 pb-24">
      {/* Contextual Toolbar: Desktop Class Header + Compact Mobile Week Stepper & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--kam-border)]">
        <div className="flex items-center justify-between md:justify-start gap-3 min-w-0">
          <div className="min-w-0">
            {/* Desktop Title / Group Switcher (mobile already has sticky top bar) */}
            <div className="hidden md:block">
              {joinedGroups.length > 1 ? (
                <select
                  aria-label="تبديل الفصل النشط"
                  value={group?.id || ''}
                  onChange={(e) => switchGroup(e.target.value)}
                  className="text-lg font-extrabold bg-transparent border border-[var(--kam-border)] rounded-xl px-3 py-1.5 max-w-full"
                >
                  {joinedGroups.map((g) => (
                    <option key={g.id} value={g.id} className="bg-[var(--kam-surface)]">
                      {g.name}
                    </option>
                  ))}
                </select>
              ) : (
                <h1 className="text-xl font-extrabold truncate">{group?.name}</h1>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--kam-text-muted)]">
              <span className="font-semibold text-[var(--kam-text-secondary)]">
                {formatMonthTitleAr(selectedMonthKey)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-num">{students.length} طفل</span>
              <span aria-hidden="true">·</span>
              <span className="font-num font-bold text-[var(--kam-success)]">
                حضور: {totalPresentThisWeek}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Saturday Week Stepper + Calendar Tree Trigger */}
          <div className="flex-1 md:flex-none flex items-center justify-between rounded-xl border border-[var(--kam-border)] bg-[var(--kam-surface)] overflow-hidden">
            <button
              type="button"
              onClick={() => setSelectedWeekKey(shiftWeekKey(selectedWeekKey, -1).weekKey)}
              aria-label="الأسبوع السابق"
              className="min-h-[42px] min-w-[42px] flex items-center justify-center text-[var(--kam-text-secondary)] hover:bg-[var(--kam-surface-variant)]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className="flex-1 min-h-[42px] px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[var(--kam-surface-variant)] whitespace-nowrap"
            >
              <Calendar className="w-3.5 h-3.5 text-[var(--kam-primary)] shrink-0" />
              <span>{weekInfo?.labelAr || selectedWeekKey}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedWeekKey(shiftWeekKey(selectedWeekKey, 1).weekKey)}
              aria-label="الأسبوع التالي"
              className="min-h-[42px] min-w-[42px] flex items-center justify-center text-[var(--kam-text-secondary)] hover:bg-[var(--kam-surface-variant)]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            aria-label="مزامنة البيانات"
            className="hidden md:flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-[var(--kam-border)] bg-[var(--kam-surface)] text-[var(--kam-text-secondary)] hover:text-[var(--kam-primary)] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Actions Grid (Mobile Thumb-Friendly >= 44px) */}
      <div
        className={`grid gap-2 ${
          canSeeLeaderboard ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'
        }`}
      >
        <button
          type="button"
          onClick={onOpenSmartAttendance}
          className="min-h-[46px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-[var(--kam-primary)] text-[var(--kam-on-primary)] text-xs font-bold hover:opacity-95 active:scale-[0.98] transition-all whitespace-nowrap"
        >
          <ClipboardCheck className="w-4 h-4 shrink-0" />
          <span>التحضير الذكي</span>
        </button>

        <button
          type="button"
          onClick={onOpenVisitation}
          className="min-h-[46px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] hover:border-[var(--kam-primary)] active:scale-[0.98] text-xs font-bold transition-all whitespace-nowrap"
        >
          <HeartHandshake className="w-4 h-4 text-[#8B5CF6] shrink-0" />
          <span>الافتقاد الذكي</span>
        </button>

        {canSeeLeaderboard && (
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="min-h-[46px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] hover:border-[var(--kam-primary)] active:scale-[0.98] text-xs font-bold transition-all whitespace-nowrap"
          >
            <Trophy className="w-4 h-4 text-[var(--kam-gold)] shrink-0" />
            <span>الصدارة والتقارير</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setAddDefaultBlock('');
            setAddStudentOpen(true);
          }}
          className="min-h-[46px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] hover:border-[var(--kam-primary)] active:scale-[0.98] text-xs font-bold transition-all whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4 text-[var(--kam-success)] shrink-0" />
          <span>إضافة طفل</span>
        </button>

        <button
          type="button"
          onClick={() => setBulkImportOpen(true)}
          className={`${
            canSeeLeaderboard ? 'col-span-2 sm:col-span-1' : ''
          } min-h-[46px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] hover:border-[var(--kam-primary)] active:scale-[0.98] text-xs font-bold transition-all whitespace-nowrap`}
        >
          <FileSpreadsheet className="w-4 h-4 text-[var(--kam-tertiary)] shrink-0" />
          <span>استيراد جماعي</span>
        </button>
      </div>

      {/* Arabic Normalized Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-[var(--kam-text-muted)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          aria-label="بحث عن طفل بالاسم أو الرقم"
          value={rawSearch}
          onChange={(e) => setRawSearch(e.target.value)}
          placeholder="ابحث باسم الطفل أو رقمه (مثال: احمد أو #3)..."
          className="w-full min-h-[46px] pr-10 pl-4 py-2.5 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] text-sm text-[var(--kam-text-primary)] placeholder:text-[var(--kam-text-muted)]"
        />
      </div>

      {/* Hidden Blocks Quick Restore Strip */}
      {hiddenCount > 0 && !debouncedSearch && (
        <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] flex items-center justify-between gap-2 text-xs">
          <span className="text-[var(--kam-text-secondary)] flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-[var(--kam-text-muted)] shrink-0" />
            <span>يوجد {hiddenCount} بلوك مخفي من شاشتك الرئيسية</span>
          </span>
          <button
            type="button"
            onClick={handleRestoreAllHiddenBlocks}
            className="px-3 py-1.5 rounded-xl bg-[var(--kam-primary-container)] text-[var(--kam-primary)] font-bold flex items-center gap-1 shrink-0"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>إظهار الكل</span>
          </button>
        </div>
      )}

      {/* Duplicate Card Alerts */}
      {duplicateAlerts.length > 0 && (
        <div className="rounded-2xl border border-[var(--kam-warning)]/45 bg-[var(--kam-warning)]/10 p-3.5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--kam-warning)]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>تنبيه تكرار كروت في نفس الأسبوع ({duplicateAlerts.length})</span>
          </div>
          <div className="space-y-2">
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
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] text-xs"
                >
                  <div>
                    <span className="font-bold">{alert.studentName}</span> حصل على كارت{' '}
                    <span className="font-bold">{def.titleAr}</span>{' '}
                    <span className="font-num font-bold text-[var(--kam-warning)]">
                      {alert.events.length} مرات
                    </span>{' '}
                    ({servants})
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canUndo && (
                      <button
                        type="button"
                        onClick={async () => {
                          await undoCard(latestEv);
                          showToast('تم التراجع عن الكارت المكرر', 'success');
                        }}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl font-semibold text-[var(--kam-danger)] border border-[var(--kam-danger)]/40 hover:bg-[var(--kam-danger)]/10 flex items-center gap-1"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>تراجع</span>
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
                      className="min-h-[36px] px-3 py-1.5 rounded-xl font-semibold bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] hover:border-[var(--kam-primary)] flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>تنبيه للشات</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Servant Blocks & Unassigned Section */}
      <div className="space-y-3.5">
        {visibleBlocks.map(renderBlockSection)}

        {(unassignedStudents.length > 0 || visibleBlocks.length === 0) && (
          <section className="rounded-2xl border border-[var(--kam-border)] bg-[var(--kam-surface)] overflow-hidden">
            <div className="px-4 py-3 bg-[var(--kam-surface-variant)]/55 border-b border-[var(--kam-border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold">بدون بلوك</h2>
                <span className="text-xs font-num text-[var(--kam-text-muted)]">
                  ({unassignedStudents.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddDefaultBlock('');
                  setAddStudentOpen(true);
                }}
                className="text-xs font-semibold text-[var(--kam-primary)] hover:underline py-1"
              >
                + إضافة طفل
              </button>
            </div>
            {unassignedStudents.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[var(--kam-text-muted)]">
                {debouncedSearch
                  ? 'لا توجد نتائج مطابقة للبحث.'
                  : 'لا يوجد أطفال في هذه القائمة حالياً.'}
              </div>
            ) : (
              unassignedStudents.map((st, idx) => renderStudentRow(st, unassignedStudents, idx))
            )}
          </section>
        )}
      </div>

      {/* Floating Add Button */}
      {userProfile?.showFloatingAddButton !== false && (
        <button
          type="button"
          onClick={() => {
            setAddDefaultBlock('');
            setAddStudentOpen(true);
          }}
          aria-label="إضافة طفل جديد سريع"
          className="fixed bottom-20 left-4 md:bottom-8 md:left-8 z-30 w-13 h-13 rounded-2xl bg-[var(--kam-primary)] text-white shadow-lg flex items-center justify-center hover:opacity-95 active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Modals */}
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
