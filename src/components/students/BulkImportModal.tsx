import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, AlertTriangle, X } from 'lucide-react';
import { useKam } from '../../context/KamContext';
import { parseBulkImportNames } from '../../services/studentService';

interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ open, onClose }) => {
  const { blocks, students, bulkImportStudents, showToast } = useKam();
  const [rawText, setRawText] = useState('');
  const [blockId, setBlockId] = useState('');
  const [duplicateStrategy, setDuplicateStrategy] = useState<'SKIP' | 'UPDATE_BLOCK' | 'KEEP_BOTH'>(
    'SKIP'
  );
  const [importing, setImporting] = useState(false);

  const parsedRows = useMemo(
    () => parseBulkImportNames(rawText, students),
    [rawText, students]
  );

  const duplicatesCount = useMemo(
    () => parsedRows.filter((r) => Boolean(r.duplicateOf)).length,
    [parsedRows]
  );

  if (!open) return null;

  const handleImport = async () => {
    if (parsedRows.length === 0) {
      showToast('الصق قائمة أسماء (اسم في كل سطر) أولاً', 'warning');
      return;
    }
    setImporting(true);
    try {
      await bulkImportStudents({ rows: parsedRows, blockId, duplicateStrategy });
      setRawText('');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر الاستيراد الجماعي', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="استيراد جماعي ذكي للأطفال"
    >
      <div className="w-full max-w-lg max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[var(--kam-surface)] border-t sm:border border-[var(--kam-border)] shadow-2xl overflow-hidden pb-safe">
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <span className="w-10 h-1 rounded-full bg-[var(--kam-border-strong)]" />
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--kam-border)]">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[var(--kam-primary)]" />
            <h2 className="text-base font-bold">استيراد جماعي ذكي للأسماء</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-[var(--kam-text-muted)] hover:bg-[var(--kam-surface-variant)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto kam-scrollbar p-5 space-y-4">
          <div>
            <label htmlFor="bulk-import-block" className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1.5">
              إضافة الأطفال إلى البلوك
            </label>
            <select
              id="bulk-import-block"
              value={blockId}
              onChange={(e) => setBlockId(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm"
            >
              <option value="">بدون بلوك</option>
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.servantName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="bulk-import-textarea" className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1.5">
              الصق قائمة الأسماء (اسم واحد في كل سطر، ويمكن البدء بالرقم مثل: 15 - مارك رامي)
            </label>
            <textarea
              id="bulk-import-textarea"
              rows={6}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={'مارك رامي\n12 - يوستينا سامح\nبولا أشرف'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm leading-relaxed"
            />
          </div>

          {duplicatesCount > 0 && (
            <div className="p-3.5 rounded-xl bg-[var(--kam-warning)]/10 border border-[var(--kam-warning)]/40 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--kam-warning)]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>تم اكتشاف {duplicatesCount} اسم مطابق لأطفال موجودين بالفعل في الفصل</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['SKIP', 'تخطي المكرر'],
                    ['UPDATE_BLOCK', 'نقل المكرر للبلوك المختار'],
                    ['KEEP_BOTH', 'الاحتفاظ بالاثنين'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDuplicateStrategy(val)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      duplicateStrategy === val
                        ? 'bg-[var(--kam-primary)] text-white border-[var(--kam-primary)]'
                        : 'bg-[var(--kam-surface)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {parsedRows.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-[var(--kam-text-secondary)]">
                معاينة القائمة ({parsedRows.length} طفل)
              </div>
              <div className="max-h-40 overflow-y-auto kam-scrollbar divide-y divide-[var(--kam-border)] rounded-xl border border-[var(--kam-border)]">
                {parsedRows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="font-medium">
                      {r.explicitNumber ? `#${r.explicitNumber} · ` : ''}
                      {r.name}
                    </span>
                    <span className={r.duplicateOf ? 'text-[var(--kam-warning)] font-semibold' : 'text-[var(--kam-success)]'}>
                      {r.duplicateOf ? `مكرر (#${r.duplicateOf.studentNumber})` : 'جديد'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--kam-border)] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--kam-border)] hover:bg-[var(--kam-surface-variant)]"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={importing || parsedRows.length === 0}
            onClick={handleImport}
            className="min-h-[44px] flex-1 sm:flex-initial px-5 py-2 rounded-xl text-xs font-bold bg-[var(--kam-primary)] text-[var(--kam-on-primary)] disabled:opacity-50"
          >
            {importing ? 'جاري الاستيراد...' : `استيراد (${parsedRows.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};
