import React, { useMemo, useState } from 'react';
import { ArrowRight, Calendar, Filter, Trophy } from 'lucide-react';
import { useKam } from '../context/KamContext';
import { AvatarBadge } from '../components/ui/AvatarBadge';
import { CalendarTreeModal } from '../components/calendar/CalendarTreeModal';
import { getQuickWeekKeys } from '../lib/calendar';
import { getAllCardDefinitions } from '../lib/kamRules';
import type { CardTypeId } from '../types/kam';

interface ReportsLeaderboardPageProps {
  onBack: () => void;
}

export const ReportsLeaderboardPage: React.FC<ReportsLeaderboardPageProps> = ({ onBack }) => {
  const {
    group,
    blocks,
    students,
    cardEvents,
    attendance,
    selectedWeekKey,
  } = useKam();

  const quick = useMemo(() => getQuickWeekKeys(new Date()), []);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([selectedWeekKey]);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedCardTypes, setSelectedCardTypes] = useState<CardTypeId[]>([]);
  const [attendanceOnly, setAttendanceOnly] = useState(false);

  const allCards = useMemo(() => getAllCardDefinitions(group), [group]);

  const toggleItem = <T extends string>(list: T[], val: T, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
    setter(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  };

  const weekSet = useMemo(() => new Set(selectedWeeks), [selectedWeeks]);

  // Filtered students list
  const scopedStudents = useMemo(() => {
    return students.filter((s) => {
      if (selectedBlockIds.length > 0) {
        const blkKey = s.blockId || '__unassigned__';
        if (!selectedBlockIds.includes(blkKey)) return false;
      }
      if (selectedStudentIds.length > 0 && !selectedStudentIds.includes(s.id)) {
        return false;
      }
      return true;
    });
  }, [students, selectedBlockIds, selectedStudentIds]);

  const scopedStudentIds = useMemo(() => new Set(scopedStudents.map((s) => s.id)), [scopedStudents]);

  // Leaderboard calculations
  const rankedRows = useMemo(() => {
    const eventsInPeriod = cardEvents.filter((e) => weekSet.has(e.weekKey));
    const attInPeriod = attendance.filter((a) => weekSet.has(a.weekKey));

    return scopedStudents
      .map((student) => {
        const studentEvents = eventsInPeriod.filter((e) => {
          if (e.studentId !== student.id) return false;
          if (attendanceOnly) return e.cardType === 'ATTENDANCE';
          if (selectedCardTypes.length > 0 && !selectedCardTypes.includes(e.cardType)) return false;
          return true;
        });

        const byCard: Partial<Record<CardTypeId, number>> = {};
        let totalPoints = 0;
        for (const ev of studentEvents) {
          totalPoints += ev.points;
          byCard[ev.cardType] = (byCard[ev.cardType] ?? 0) + ev.points;
        }

        const studentAtt = attInPeriod.filter((a) => a.studentId === student.id);
        const presentWeeks = studentAtt.filter((a) => a.status === 'PRESENT').length;
        const absentWeeks = studentAtt.filter((a) => a.status === 'ABSENT').length;

        return {
          student,
          totalPoints,
          eventsCount: studentEvents.length,
          byCard,
          presentWeeks,
          absentWeeks,
        };
      })
      .sort((a, b) => {
        if (attendanceOnly) {
          if (b.presentWeeks !== a.presentWeeks) return b.presentWeeks - a.presentWeeks;
        }
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return a.student.studentNumber - b.student.studentNumber;
      });
  }, [scopedStudents, cardEvents, attendance, weekSet, attendanceOnly, selectedCardTypes]);

  // Summary metrics (bottom strip)
  const summary = useMemo(() => {
    const attInPeriod = attendance.filter(
      (a) => weekSet.has(a.weekKey) && scopedStudentIds.has(a.studentId)
    );
    const presentCount = attInPeriod.filter((a) => a.status === 'PRESENT').length;
    const absentCount = attInPeriod.filter((a) => a.status === 'ABSENT').length;

    const filteredPoints = rankedRows.reduce((acc, r) => acc + r.totalPoints, 0);

    // Total app points in selected period WITHOUT sub-filter restrictions
    const totalAppPointsInPeriod = cardEvents
      .filter((e) => weekSet.has(e.weekKey))
      .reduce((acc, e) => acc + e.points, 0);

    return {
      presentCount,
      absentCount,
      filteredPoints,
      totalAppPointsInPeriod,
    };
  }, [attendance, weekSet, scopedStudentIds, rankedRows, cardEvents]);

  return (
    <div className="space-y-5 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--kam-border)]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="العودة للرئيسية"
            className="p-2 rounded-xl border border-[var(--kam-border)] bg-[var(--kam-surface)] hover:border-[var(--kam-primary)]"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-extrabold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[var(--kam-gold)]" />
              <span>التقارير ولوحة الصدارة</span>
            </h1>
            <p className="text-xs text-[var(--kam-text-muted)] font-num">
              الفترة المحددة: {selectedWeeks.length === 1 ? selectedWeeks[0] : `${selectedWeeks.length} أسابيع`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedWeeks([quick.thisWeek.weekKey])}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              selectedWeeks.length === 1 && selectedWeeks[0] === quick.thisWeek.weekKey
                ? 'bg-[var(--kam-primary)] text-white border-[var(--kam-primary)]'
                : 'bg-[var(--kam-surface)] border-[var(--kam-border)]'
            }`}
          >
            هذا الأسبوع
          </button>
          <button
            type="button"
            onClick={() => setSelectedWeeks([quick.lastWeek.weekKey])}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              selectedWeeks.length === 1 && selectedWeeks[0] === quick.lastWeek.weekKey
                ? 'bg-[var(--kam-primary)] text-white border-[var(--kam-primary)]'
                : 'bg-[var(--kam-surface)] border-[var(--kam-border)]'
            }`}
          >
            الأسبوع اللي فات
          </button>
          <button
            type="button"
            onClick={() => setSelectedWeeks([quick.twoWeeksAgo.weekKey])}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              selectedWeeks.length === 1 && selectedWeeks[0] === quick.twoWeeksAgo.weekKey
                ? 'bg-[var(--kam-primary)] text-white border-[var(--kam-primary)]'
                : 'bg-[var(--kam-surface)] border-[var(--kam-border)]'
            }`}
          >
            الأسبوع اللي قبله
          </button>
          <button
            type="button"
            onClick={() => setCalendarOpen(true)}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[var(--kam-surface)] border border-[var(--kam-border)] hover:border-[var(--kam-primary)] flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5 text-[var(--kam-primary)]" />
            <span>شجرة التقويم</span>
          </button>
        </div>
      </div>

      {/* Multi-Select Filter Panel */}
      <div className="rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-4 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--kam-text-secondary)]">
            <Filter className="w-3.5 h-3.5" />
            <span>تصفية متعددة</span>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={attendanceOnly}
              onChange={(e) => setAttendanceOnly(e.target.checked)}
              className="accent-[var(--kam-primary)]"
            />
            <span>عرض الحضور لوحده</span>
          </label>
        </div>

        {/* Blocks multi-select */}
        <div className="space-y-1.5">
          <div className="text-[0.72rem] font-semibold text-[var(--kam-text-muted)]">البلوكات:</div>
          <div className="flex flex-wrap gap-1.5">
            {blocks.map((b) => {
              const active = selectedBlockIds.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleItem(selectedBlockIds, b.id, setSelectedBlockIds)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    active
                      ? 'bg-[var(--kam-primary)] text-white border-[var(--kam-primary)]'
                      : 'bg-[var(--kam-surface-variant)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
                  }`}
                >
                  {b.servantName}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => toggleItem(selectedBlockIds, '__unassigned__', setSelectedBlockIds)}
              className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                selectedBlockIds.includes('__unassigned__')
                  ? 'bg-[var(--kam-primary)] text-white border-[var(--kam-primary)]'
                  : 'bg-[var(--kam-surface-variant)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
              }`}
            >
              بدون بلوك
            </button>
          </div>
        </div>

        {/* Card types multi-select */}
        {!attendanceOnly && (
          <div className="space-y-1.5">
            <div className="text-[0.72rem] font-semibold text-[var(--kam-text-muted)]">أنواع الكروت:</div>
            <div className="flex flex-wrap gap-1.5">
              {allCards.map((c) => {
                const active = selectedCardTypes.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleItem(selectedCardTypes, c.id, setSelectedCardTypes)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      active
                        ? 'bg-[var(--kam-primary)] text-white border-[var(--kam-primary)]'
                        : 'bg-[var(--kam-surface-variant)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
                    }`}
                  >
                    {c.icon} {c.titleAr}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Students multi-select */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[0.72rem] font-semibold text-[var(--kam-text-muted)]">
              أطفال محددون ({selectedStudentIds.length === 0 ? 'الكل' : selectedStudentIds.length}):
            </span>
            {(selectedBlockIds.length > 0 || selectedStudentIds.length > 0 || selectedCardTypes.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedBlockIds([]);
                  setSelectedStudentIds([]);
                  setSelectedCardTypes([]);
                  setAttendanceOnly(false);
                }}
                className="text-[0.72rem] font-semibold text-[var(--kam-primary)] hover:underline"
              >
                مسح كل الفلاتر
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto kam-scrollbar">
            {students.map((st) => {
              const active = selectedStudentIds.includes(st.id);
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => toggleItem(selectedStudentIds, st.id, setSelectedStudentIds)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-xl text-[0.72rem] font-semibold border transition-colors ${
                    active
                      ? 'bg-[var(--kam-primary)] text-white border-[var(--kam-primary)]'
                      : 'bg-[var(--kam-surface-variant)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
                  }`}
                >
                  #{st.studentNumber} {st.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Leaderboard Ranking Table */}
      <div className="rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--kam-border)] bg-[var(--kam-surface-variant)]/50 flex items-center justify-between text-xs font-bold">
          <span>ترتيب الأطفال ({rankedRows.length})</span>
          <span>{attendanceOnly ? 'الحضور / الغياب' : 'النقاط وتفصيل الكروت'}</span>
        </div>

        <div className="divide-y divide-[var(--kam-border)]">
          {rankedRows.map((row, idx) => {
            const rank = idx + 1;
            const medalColor =
              rank === 1
                ? 'var(--kam-gold)'
                : rank === 2
                ? 'var(--kam-silver)'
                : rank === 3
                ? 'var(--kam-bronze)'
                : 'var(--kam-text-muted)';

            return (
              <div
                key={row.student.id}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-7 text-center font-num text-sm font-extrabold shrink-0"
                    style={{ color: medalColor }}
                  >
                    {rank <= 3 ? (rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉') : `#${rank}`}
                  </span>
                  <AvatarBadge
                    studentId={row.student.id}
                    hasAvatar={row.student.hasAvatar}
                    name={row.student.name}
                    initials={row.student.avatarInitials}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">
                      <span className="font-num text-xs text-[var(--kam-text-muted)] ml-1.5">
                        #{row.student.studentNumber}
                      </span>
                      {row.student.name}
                    </div>
                    {!attendanceOnly && (
                      <div className="flex flex-wrap items-center gap-2 text-[0.72rem] text-[var(--kam-text-muted)] mt-0.5">
                        {allCards.map((c) => {
                          const pts = row.byCard[c.id];
                          if (!pts) return null;
                          return (
                            <span key={c.id} className="font-num">
                              {c.icon} {c.titleAr}: {pts}
                            </span>
                          );
                        })}
                        {row.eventsCount === 0 && <span>لا توجد كروت في الفترة</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <span className="text-xs font-num text-[var(--kam-success)]">
                    حاضر {row.presentWeeks}
                  </span>
                  <span className="text-xs font-num text-[var(--kam-danger)]">
                    غائب {row.absentWeeks}
                  </span>
                  <span className="text-base font-num font-extrabold text-[var(--kam-primary)] min-w-14 text-left">
                    {row.totalPoints}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Period Summary Card */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)]">
          <div className="text-xs text-[var(--kam-text-muted)]">عدد الحاضرين</div>
          <div className="mt-1 text-2xl font-num font-extrabold text-[var(--kam-success)]">
            {summary.presentCount}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)]">
          <div className="text-xs text-[var(--kam-text-muted)]">عدد الغائبين</div>
          <div className="mt-1 text-2xl font-num font-extrabold text-[var(--kam-danger)]">
            {summary.absentCount}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)]">
          <div className="text-xs text-[var(--kam-text-muted)]">نقاط الفترة (حسب الفلاتر)</div>
          <div className="mt-1 text-2xl font-num font-extrabold text-[var(--kam-primary)]">
            {summary.filteredPoints}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)]">
          <div className="text-xs text-[var(--kam-text-muted)]">إجمالي نقاط التطبيق بالفترة</div>
          <div className="mt-1 text-2xl font-num font-extrabold text-[var(--kam-gold)]">
            {summary.totalAppPointsInPeriod}
          </div>
        </div>
      </div>

      <CalendarTreeModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        selectedWeekKeys={selectedWeeks}
        onApply={setSelectedWeeks}
      />
    </div>
  );
};
