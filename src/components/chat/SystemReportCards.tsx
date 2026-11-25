import React from 'react';
import { AvatarBadge } from '../ui/AvatarBadge';
import { COLOR_KEY_PALETTE } from '../../lib/kamRules';
import {
  groupItemsByBlock,
  parseAttendanceReport,
  parseVisitationReport,
  type BlockSummaryGroup,
} from '../../lib/reportFormats';
import type { ChatMessage } from '../../types/chat';
import type { CustomCardColorKey, ServantBlock, Student } from '../../types/kam';

interface SystemReportProps {
  message: ChatMessage;
  students: Student[];
  blocks: ServantBlock[];
  onSelectStudent?: (studentId: string) => void;
}

const BlockSummaryFooter: React.FC<{ groups: BlockSummaryGroup[]; totalLabel: string; total: number }> = ({
  groups,
  totalLabel,
  total,
}) => {
  if (total === 0) return null;
  return (
    <div className="pt-2.5 mt-2.5 border-t border-[var(--kam-border)] space-y-1.5 text-[0.72rem]">
      {groups.map((g) => (
        <div key={g.blockId} className="flex flex-wrap items-center gap-1.5 text-[var(--kam-text-secondary)]">
          <span className="font-bold" style={{ color: g.colorHex }}>
            {g.blockName}
          </span>
          <span className="font-num text-[var(--kam-text-muted)]">({g.count})</span>
          {g.numbers.length > 0 && (
            <span className="font-num text-[var(--kam-text-muted)]">
              : {g.numbers.map((n) => `#${n}`).join('، ')}
            </span>
          )}
        </div>
      ))}
      <div className="pt-1 font-bold text-[var(--kam-text-primary)] font-num">
        {totalLabel}: {total}
      </div>
    </div>
  );
};

export const SystemReportCard: React.FC<SystemReportProps> = ({
  message,
  students,
  blocks,
  onSelectStudent,
}) => {
  const studentMap = React.useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  // 1. Check [VISITATION_V1]
  const visitation = React.useMemo(() => parseVisitationReport(message.text), [message.text]);
  if (visitation) {
    const attentionItems = [
      ...visitation.followup.map((f) => ({ ...f, kind: 'FOLLOWUP' as const })),
      ...visitation.notVisited.map((u) => ({ ...u, kind: 'NOT_VISITED' as const })),
    ];
    const blockSummary = groupItemsByBlock(attentionItems, students, blocks);

    return (
      <div className="w-full max-w-xl rounded-2xl border border-[#8B5CF6]/40 bg-[var(--kam-surface)] overflow-hidden">
        <div className="px-4 py-3 bg-[#8B5CF6]/15 border-b border-[#8B5CF6]/25 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span aria-hidden="true">🏠</span>
            <span className="text-sm font-bold text-[var(--kam-text-primary)] truncate">
              تقرير الافتقاد
            </span>
          </div>
          <span className="text-[0.72rem] text-[var(--kam-text-secondary)] truncate">
            {visitation.servantName} · {visitation.scopeLabel}
          </span>
        </div>

        <div className="p-3.5 space-y-3">
          {/* Visited names as compact vertical list without photos */}
          {visitation.visited.length > 0 && (
            <div className="space-y-1">
              <div className="text-[0.72rem] font-bold text-[var(--kam-success)]">
                تم افتقادهم ({visitation.visited.length})
              </div>
              <ul className="space-y-0.5 text-xs text-[var(--kam-text-secondary)]">
                {visitation.visited.map((v) => (
                  <li key={v.studentId} className="flex items-center gap-1.5">
                    <span className="font-num text-[0.72rem] text-[var(--kam-text-muted)]">
                      #{v.studentNumber}
                    </span>
                    <span>{v.studentName}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 3-column photo grid ONLY for followup / not visited */}
          {attentionItems.length > 0 && (
            <div className="space-y-2">
              <div className="text-[0.72rem] font-bold text-[var(--kam-warning)]">
                يحتاج متابعة / لم يتم افتقاده ({attentionItems.length})
              </div>
              <div className="grid grid-cols-3 gap-2">
                {attentionItems.map((item) => {
                  const st = studentMap.get(item.studentId);
                  return (
                    <button
                      key={`${item.kind}_${item.studentId}`}
                      type="button"
                      onClick={() => onSelectStudent?.(item.studentId)}
                      className="flex flex-col items-center text-center p-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] hover:border-[var(--kam-primary)] transition-colors"
                    >
                      <AvatarBadge
                        studentId={item.studentId}
                        hasAvatar={st?.hasAvatar}
                        name={item.studentName}
                        initials={st?.avatarInitials}
                        size="sm"
                        accentColor={item.kind === 'FOLLOWUP' ? '#F59E0B' : '#E55353'}
                      />
                      <span className="mt-1 text-[0.65rem] font-num text-[var(--kam-text-muted)]">
                        #{item.studentNumber}
                      </span>
                      <span className="text-[0.72rem] font-semibold leading-tight line-clamp-1">
                        {item.studentName}
                      </span>
                      {item.note && (
                        <span className="mt-0.5 text-[0.65rem] text-[var(--kam-warning)] line-clamp-2">
                          {item.note}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <BlockSummaryFooter
            groups={blockSummary}
            totalLabel="إجمالي المتابعة / غير المفتقدين"
            total={attentionItems.length}
          />
        </div>
      </div>
    );
  }

  // 2. Check [ATTENDANCE_V3] / [ATTENDANCE_V2]
  const att = React.useMemo(() => parseAttendanceReport(message.text), [message.text]);
  if (att) {
    const palette =
      COLOR_KEY_PALETTE[(att.colorKey as CustomCardColorKey) || 'EMERALD'] ??
      COLOR_KEY_PALETTE.EMERALD;

    // Cross-servant DIFF report
    if (att.diffAgainstServant) {
      return (
        <div className="w-full max-w-xl rounded-2xl border border-[#F59E0B]/45 bg-[var(--kam-surface)] overflow-hidden">
          <div className="px-4 py-3 bg-[#F59E0B]/15 border-b border-[#F59E0B]/25 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span aria-hidden="true">🔄</span>
              <span className="text-sm font-bold truncate">
                اختلافات {att.title}
              </span>
            </div>
            <span className="text-[0.72rem] text-[var(--kam-text-secondary)] truncate">
              {att.servantName} مقابل {att.diffAgainstServant}
            </span>
          </div>

          <div className="p-3.5 divide-y divide-[var(--kam-border)]">
            {att.diffItems.map((d) => (
              <div key={d.studentId} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <span className="font-num text-[var(--kam-text-muted)] ml-1.5">
                    #{d.studentNumber}
                  </span>
                  <span className="font-bold">{d.studentName}</span>
                  {d.note && (
                    <p className="text-[0.72rem] text-[var(--kam-warning)] mt-0.5">{d.note}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[0.72rem]">
                  <span className="text-[var(--kam-text-muted)]">{d.firstStatus}</span>
                  <span aria-hidden="true">←</span>
                  <span className="font-bold text-[var(--kam-warning)]">{d.secondStatus}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const negativeItems = [
      ...att.absentItems.map((a) => ({ ...a, badge: 'غائب', color: '#E55353' })),
      ...att.noCardItems.map((n) => ({ ...n, badge: n.extra || 'لم يأخذ', color: '#E55353' })),
      ...att.issueItems.map((i) => ({ ...i, badge: i.extra || 'مشكلة', color: '#F59E0B' })),
    ];
    const blockSummary = groupItemsByBlock(negativeItems, students, blocks);

    return (
      <div
        className="w-full max-w-xl rounded-2xl border bg-[var(--kam-surface)] overflow-hidden"
        style={{ borderColor: `${palette.darkHex}55` }}
      >
        <div
          className="px-4 py-3 border-b flex items-center justify-between gap-2"
          style={{
            backgroundColor: `${palette.darkHex}1A`,
            borderColor: `${palette.darkHex}33`,
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span aria-hidden="true">{att.icon}</span>
            <span className="text-sm font-bold truncate">{att.title}</span>
          </div>
          <span className="text-[0.72rem] text-[var(--kam-text-secondary)] truncate">
            {att.servantName}
          </span>
        </div>

        <div className="p-3.5 space-y-3">
          {negativeItems.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {negativeItems.map((item) => {
                const st = studentMap.get(item.studentId);
                return (
                  <button
                    key={`${item.studentId}_${item.badge}`}
                    type="button"
                    onClick={() => onSelectStudent?.(item.studentId)}
                    className="flex flex-col items-center text-center p-2 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] hover:border-[var(--kam-primary)] transition-colors"
                  >
                    <AvatarBadge
                      studentId={item.studentId}
                      hasAvatar={st?.hasAvatar}
                      name={item.studentName}
                      initials={st?.avatarInitials}
                      size="sm"
                      accentColor={item.color}
                    />
                    <span className="mt-1 text-[0.65rem] font-num text-[var(--kam-text-muted)]">
                      #{item.studentNumber}
                    </span>
                    <span className="text-[0.72rem] font-semibold leading-tight line-clamp-1">
                      {item.studentName}
                    </span>
                    <span
                      className="mt-0.5 text-[0.65rem] font-semibold line-clamp-1"
                      style={{ color: item.color }}
                    >
                      {item.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {att.presentNames.length > 0 && (
            <div className="px-3 py-2 rounded-xl bg-[var(--kam-surface-variant)]/70 text-[0.72rem] text-[var(--kam-text-secondary)] leading-relaxed">
              <span className="font-bold text-[var(--kam-success)] ml-1.5">
                {att.reportTypeKey === 'ATTENDANCE_ONLY' ? 'الحاضرون' : 'حصلوا على الكارت'} (
                {att.presentNames.length}):
              </span>
              {att.presentNames.join(' • ')}
            </div>
          )}

          <BlockSummaryFooter
            groups={blockSummary}
            totalLabel={att.reportTypeKey === 'ATTENDANCE_ONLY' ? 'إجمالي الغائبين والمشاكل' : 'إجمالي غير الحاصلين والمشاكل'}
            total={negativeItems.length}
          />
        </div>
      </div>
    );
  }

  // 3. Individual child notification card colored by notificationCategory
  const categoryStyles: Record<string, { hex: string; label: string }> = {
    CONFLICT: { hex: '#F97316', label: 'تنبيه تكرار / تعارض' },
    ABSENT: { hex: '#E55353', label: 'إشعار غياب' },
    COMMENT: { hex: '#38BDF8', label: 'ملاحظة طفل' },
    VISITATION: { hex: '#8B5CF6', label: 'إشعار افتقاد' },
    MEMORIZATION: { hex: '#2DD4BF', label: 'تقدم محفوظات' },
    CARD: { hex: '#22C57E', label: 'إشعار كارت' },
    SYSTEM: { hex: '#5E6AD2', label: 'إشعار الفصل' },
  };
  const cat = categoryStyles[message.notificationCategory || 'SYSTEM'] ?? categoryStyles.SYSTEM;

  return (
    <div
      className="w-full max-w-lg rounded-2xl border bg-[var(--kam-surface)] p-3.5 space-y-1.5"
      style={{ borderColor: `${cat.hex}55` }}
    >
      <div className="flex items-center justify-between gap-2 text-[0.72rem]">
        <span className="font-bold" style={{ color: cat.hex }}>
          {cat.label}
        </span>
        <span className="text-[var(--kam-text-muted)]">{message.senderName}</span>
      </div>
      {message.childName && (
        <div className="text-xs font-bold text-[var(--kam-text-primary)]">
          {message.childName}
          {message.childBlockName ? (
            <span className="font-normal text-[var(--kam-text-muted)]"> · {message.childBlockName}</span>
          ) : null}
        </div>
      )}
      <p className="text-xs text-[var(--kam-text-secondary)] leading-relaxed whitespace-pre-wrap">
        {message.text}
      </p>
    </div>
  );
};
