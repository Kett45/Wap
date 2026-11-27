import React, { useMemo, useState } from 'react';
import { ArrowRight, Calendar, Search, Trophy, X } from 'lucide-react';
import { useKam } from '../context/KamContext';
import { AvatarBadge } from '../components/ui/AvatarBadge';
import { CalendarTreeModal } from '../components/calendar/CalendarTreeModal';
import { ChildProfileModal } from '../components/students/ChildProfileModal';
import { normalizeArabicName } from '../lib/arabic';
import { getQuickWeekKeys } from '../lib/calendar';
import { getAllCardDefinitions } from '../lib/kamRules';
import type { CardTypeId, Student } from '../types/kam';

interface ReportsLeaderboardPageProps {
  onBack: () => void;
}

type SortFilterMode = 'HIGHEST' | 'WEAKEST' | 'ABSENT_ZERO' | 'ACTIVE_ONLY';

export const ReportsLeaderboardPage: React.FC<ReportsLeaderboardPageProps> = ({ onBack }) => {
  const {
    group,
    userProfile,
    blocks,
    students,
    cardEvents,
    attendance,
    selectedWeekKey,
  } = useKam();

  const quick = useMemo(() => getQuickWeekKeys(new Date()), []);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([selectedWeekKey]);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [sortMode, setSortMode] = useState<SortFilterMode>('HIGHEST');
  const [selectedBlockId, setSelectedBlockId] = useState<string>('ALL');
  const [selectedCardType, setSelectedCardType] = useState<'ALL' | CardTypeId>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const allCards = useMemo(() => getAllCardDefinitions(group), [group]);
  const weekSet = useMemo(() => new Set(selectedWeeks), [selectedWeeks]);
  const isLight = userProfile?.themeId === 'LIGHT';

  // Compute raw student stats across the selected period
  const allRows = useMemo(() => {
    const eventsInPeriod = cardEvents.filter((e) => weekSet.has(e.weekKey));
    const attInPeriod = attendance.filter((a) => weekSet.has(a.weekKey));

    return students.map((student) => {
      const studentEvents = eventsInPeriod.filter((e) => e.studentId === student.id);
      const byCardPoints: Partial<Record<CardTypeId, number>> = {};
      const byCardCounts: Partial<Record<CardTypeId, number>> = {};
      let totalPoints = 0;

      for (const ev of studentEvents) {
        totalPoints += ev.points;
        byCardPoints[ev.cardType] = (byCardPoints[ev.cardType] ?? 0) + ev.points;
        byCardCounts[ev.cardType] = (byCardCounts[ev.cardType] ?? 0) + 1;
      }

      const studentAtt = attInPeriod.filter((a) => a.studentId === student.id);
      const presentRecords = studentAtt.filter((a) => a.status === 'PRESENT').length;
      const attCardCount = byCardCounts.ATTENDANCE ?? 0;
      const presentCount = Math.max(presentRecords, attCardCount);

      const displayPoints =
        selectedCardType === 'ALL' ? totalPoints : byCardPoints[selectedCardType] ?? 0;

      return {
        student,
        totalPoints,
        displayPoints,
        eventsCount: studentEvents.length,
        byCardPoints,
        byCardCounts,
        presentCount,
      };
    });
  }, [students, cardEvents, attendance, weekSet, selectedCardType]);

  // 4 Top Summary Counts (Matching FullClassLeaderboardScreen.kt)
  const summaryStats = useMemo(() => {
    const total = allRows.length;
    const active = allRows.filter((r) => r.totalPoints > 0).length;
    const absentZero = allRows.filter((r) => r.presentCount === 0).length;
    const weakZero = allRows.filter((r) => r.totalPoints === 0).length;
    return { total, active, absentZero, weakZero };
  }, [allRows]);

  // Filtered & Sorted Leaderboard List
  const filteredRows = useMemo(() => {
    const normSearch = normalizeArabicName(searchQuery.trim().replace(/^#/, ''));

    return allRows
      .filter((row) => {
        if (selectedBlockId === 'UNASSIGNED' && row.student.blockId) return false;
        if (
          selectedBlockId !== 'ALL' &&
          selectedBlockId !== 'UNASSIGNED' &&
          row.student.blockId !== selectedBlockId
        ) {
          return false;
        }
        if (selectedCardType !== 'ALL' && (row.byCardPoints[selectedCardType] ?? 0) === 0) {
          return false;
        }
        if (sortMode === 'ABSENT_ZERO' && row.presentCount > 0) return false;
        if (sortMode === 'ACTIVE_ONLY' && row.totalPoints === 0) return false;

        if (normSearch) {
          const normName = normalizeArabicName(row.student.name);
          const numStr = String(row.student.studentNumber);
          if (!normName.includes(normSearch) && !numStr.includes(normSearch)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortMode === 'WEAKEST' || sortMode === 'ABSENT_ZERO') {
          if (a.displayPoints !== b.displayPoints) return a.displayPoints - b.displayPoints;
          if (a.presentCount !== b.presentCount) return a.presentCount - b.presentCount;
          return a.student.studentNumber - b.student.studentNumber;
        }
        if (b.displayPoints !== a.displayPoints) return b.displayPoints - a.displayPoints;
        if (b.presentCount !== a.presentCount) return b.presentCount - a.presentCount;
        return a.student.studentNumber - b.student.studentNumber;
      });
  }, [allRows, selectedBlockId, selectedCardType, sortMode, searchQuery]);

  return (
    <div className="space-y-3 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--kam-border)]">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="رجوع"
            className="w-10 h-10 rounded-xl border border-[var(--kam-border)] bg-[var(--kam-surface)] flex items-center justify-center shrink-0"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold flex items-center gap-1.5 truncate">
              <Trophy className="w-4 h-4 text-[var(--kam-gold)] shrink-0" />
              <span>ترتيب الفصل الكامل</span>
            </h1>
            <p className="text-[11px] text-[var(--kam-text-muted)] font-num">
              {selectedWeeks.length === 1
                ? selectedWeeks[0]
                : `${selectedWeeks.length} أسابيع محددة`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          className="h-9 px-3 rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-primary)]/50 text-xs font-bold flex items-center gap-1.5 shrink-0"
        >
          <Calendar className="w-3.5 h-3.5 text-[var(--kam-primary)]" />
          <span>شجرة التقويم</span>
        </button>
      </div>

      {/* Quick Period Selector Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto kam-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedWeeks([quick.thisWeek.weekKey])}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap ${
            selectedWeeks.length === 1 && selectedWeeks[0] === quick.thisWeek.weekKey
              ? 'bg-[var(--kam-primary)]/20 border-[var(--kam-primary)] text-[var(--kam-primary)]'
              : 'bg-[var(--kam-surface)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
          }`}
        >
          هذا الأسبوع
        </button>
        <button
          type="button"
          onClick={() => setSelectedWeeks([quick.lastWeek.weekKey])}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap ${
            selectedWeeks.length === 1 && selectedWeeks[0] === quick.lastWeek.weekKey
              ? 'bg-[var(--kam-primary)]/20 border-[var(--kam-primary)] text-[var(--kam-primary)]'
              : 'bg-[var(--kam-surface)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
          }`}
        >
          الأسبوع السابق
        </button>
        <button
          type="button"
          onClick={() => setSelectedWeeks([quick.twoWeeksAgo.weekKey])}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap ${
            selectedWeeks.length === 1 && selectedWeeks[0] === quick.twoWeeksAgo.weekKey
              ? 'bg-[var(--kam-primary)]/20 border-[var(--kam-primary)] text-[var(--kam-primary)]'
              : 'bg-[var(--kam-surface)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
          }`}
        >
          قبل أسبوعين
        </button>
      </div>

      {/* 4 Summary Filter Cards (كل الفصل / متفاعلين / غائبين / ضعفاء) */}
      <div className="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          onClick={() => setSortMode('HIGHEST')}
          className={`p-2 rounded-[14px] border text-center transition-colors ${
            sortMode === 'HIGHEST'
              ? 'bg-[var(--kam-primary)]/20 border-[var(--kam-primary)]'
              : 'bg-[var(--kam-surface)] border-[var(--kam-border)]'
          }`}
        >
          <div className="text-base font-num font-extrabold text-[var(--kam-primary)]">
            {summaryStats.total}
          </div>
          <div className="text-[10px] font-bold text-[var(--kam-text-secondary)]">كل الفصل</div>
        </button>

        <button
          type="button"
          onClick={() => setSortMode('ACTIVE_ONLY')}
          className={`p-2 rounded-[14px] border text-center transition-colors ${
            sortMode === 'ACTIVE_ONLY'
              ? 'bg-[#2CB578]/20 border-[#2CB578]'
              : 'bg-[var(--kam-surface)] border-[var(--kam-border)]'
          }`}
        >
          <div className="text-base font-num font-extrabold text-[#2CB578]">
            {summaryStats.active}
          </div>
          <div className="text-[10px] font-bold text-[var(--kam-text-secondary)]">متفاعلين</div>
        </button>

        <button
          type="button"
          onClick={() => setSortMode('ABSENT_ZERO')}
          className={`p-2 rounded-[14px] border text-center transition-colors ${
            sortMode === 'ABSENT_ZERO'
              ? 'bg-[#EF5350]/20 border-[#EF5350]'
              : 'bg-[var(--kam-surface)] border-[var(--kam-border)]'
          }`}
        >
          <div className="text-base font-num font-extrabold text-[#EF5350]">
            {summaryStats.absentZero}
          </div>
          <div className="text-[10px] font-bold text-[var(--kam-text-secondary)]">
            غائبين (0)
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSortMode('WEAKEST')}
          className={`p-2 rounded-[14px] border text-center transition-colors ${
            sortMode === 'WEAKEST'
              ? 'bg-[#E5A436]/20 border-[#E5A436]'
              : 'bg-[var(--kam-surface)] border-[var(--kam-border)]'
          }`}
        >
          <div className="text-base font-num font-extrabold text-[#E5A436]">
            {summaryStats.weakZero}
          </div>
          <div className="text-[10px] font-bold text-[var(--kam-text-secondary)]">
            ضعفاء (0 ن)
          </div>
        </button>
      </div>

      {/* Search Bar inside Leaderboard */}
      <div className="relative">
        <Search className="w-4 h-4 text-[var(--kam-text-muted)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث باسم الطفل أو رقمه داخل الترتيب..."
          className="w-full h-10 pr-10 pl-8 rounded-xl bg-[var(--kam-surface)] border border-[var(--kam-border)] text-xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--kam-text-muted)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Sort & Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto kam-scrollbar">
        {(
          [
            { id: 'HIGHEST', label: '🏆 الأعلى للأقل' },
            { id: 'WEAKEST', label: '⚠️ الضعفاء والأقل أولاً' },
            { id: 'ABSENT_ZERO', label: '🚫 غياب (0 حضور)' },
            { id: 'ACTIVE_ONLY', label: '✓ المتفاعلين (>0)' },
          ] as Array<{ id: SortFilterMode; label: string }>
        ).map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setSortMode(chip.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap shrink-0 ${
              sortMode === chip.id
                ? 'bg-[var(--kam-gold)]/20 border-[var(--kam-gold)] text-[var(--kam-gold)]'
                : 'bg-[var(--kam-surface)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Block Filter & Card Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto kam-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedBlockId('ALL')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap ${
            selectedBlockId === 'ALL'
              ? 'bg-[var(--kam-primary)]/20 border-[var(--kam-primary)] text-[var(--kam-primary)]'
              : 'bg-[var(--kam-surface)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
          }`}
        >
          كل البلوكات
        </button>
        {blocks.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setSelectedBlockId(b.id)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap"
            style={{
              backgroundColor:
                selectedBlockId === b.id ? `${b.colorHex}26` : 'var(--kam-surface)',
              borderColor:
                selectedBlockId === b.id ? b.colorHex : 'var(--kam-border)',
              color:
                selectedBlockId === b.id ? b.colorHex : 'var(--kam-text-secondary)',
            }}
          >
            {b.servantName}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSelectedBlockId('UNASSIGNED')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap ${
            selectedBlockId === 'UNASSIGNED'
              ? 'bg-[var(--kam-gold)]/20 border-[var(--kam-gold)] text-[var(--kam-gold)]'
              : 'bg-[var(--kam-surface)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
          }`}
        >
          بدون بلوك
        </button>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto kam-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedCardType('ALL')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap ${
            selectedCardType === 'ALL'
              ? 'bg-[var(--kam-primary)]/20 border-[var(--kam-primary)] text-[var(--kam-primary)]'
              : 'bg-[var(--kam-surface)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
          }`}
        >
          كل الكروت
        </button>
        {allCards.map((c) => {
          const active = selectedCardType === c.id;
          const accent = isLight ? c.lightHex : c.darkHex;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCardType(c.id)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap"
              style={{
                backgroundColor: active ? `${accent}26` : 'var(--kam-surface)',
                borderColor: active ? accent : 'var(--kam-border)',
                color: active ? accent : 'var(--kam-text-secondary)',
              }}
            >
              {c.icon} {c.titleAr}
            </button>
          );
        })}
      </div>

      {/* Leaderboard Student Cards */}
      <div className="space-y-2">
        {filteredRows.length === 0 ? (
          <div className="rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-8 text-center text-xs text-[var(--kam-text-muted)]">
            لا يوجد أطفال مطابقين للفلاتر الحالية.
          </div>
        ) : (
          filteredRows.map((row, idx) => {
            const rank = idx + 1;
            const blk = blocks.find((b) => b.id === row.student.blockId);
            const blkColor = blk?.colorHex || '#6C7BFF';

            return (
              <button
                key={row.student.id}
                type="button"
                onClick={() => setSelectedStudent(row.student)}
                className="w-full rounded-[16px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-3 text-right space-y-2 hover:border-[var(--kam-primary)]/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 text-center font-num text-sm font-extrabold shrink-0">
                      {sortMode === 'HIGHEST' && rank <= 3
                        ? rank === 1
                          ? '🥇'
                          : rank === 2
                          ? '🥈'
                          : '🥉'
                        : `#${rank}`}
                    </span>
                    <AvatarBadge
                      studentId={row.student.id}
                      hasAvatar={row.student.hasAvatar}
                      directBase64={row.student.avatarBase64}
                      name={row.student.name}
                      initials={row.student.avatarInitials}
                      size="sm"
                      accentHex={blkColor}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[var(--kam-text-primary)] truncate">
                        {row.student.name}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--kam-text-secondary)]">
                        <span className="font-num">رقم #{row.student.studentNumber}</span>
                        <span>•</span>
                        <span style={{ color: blkColor }}>
                          {blk ? blk.servantName : 'بدون بلوك'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="px-2.5 py-1 rounded-xl bg-[var(--kam-gold)]/18 text-[var(--kam-gold)] font-num font-extrabold text-sm shrink-0">
                    {row.displayPoints} ن
                  </div>
                </div>

                {/* Colored Per-Card Breakdown Pills */}
                <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                  <span
                    className={`px-2 py-0.5 rounded-md font-num text-[10px] font-bold ${
                      row.presentCount > 0
                        ? 'bg-[#2CB578]/18 text-[#2CB578]'
                        : 'bg-[#EF5350]/18 text-[#EF5350]'
                    }`}
                  >
                    الحضور: {row.presentCount}
                  </span>
                  {allCards.map((c) => {
                    const count = row.byCardCounts[c.id] ?? 0;
                    const pts = row.byCardPoints[c.id] ?? 0;
                    if (!pts) return null;
                    const accent = isLight ? c.lightHex : c.darkHex;
                    return (
                      <span
                        key={c.id}
                        className="px-2 py-0.5 rounded-md font-num text-[10px] font-bold"
                        style={{
                          backgroundColor: `${accent}22`,
                          color: accent,
                        }}
                      >
                        {c.icon} {c.titleAr}: +{pts} ({count})
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })
        )}
      </div>

      <CalendarTreeModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        selectedWeekKeys={selectedWeeks}
        onApply={setSelectedWeeks}
      />

      <ChildProfileModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    </div>
  );
};
