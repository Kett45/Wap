import React, { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { useKam } from '../../context/KamContext';
import { getNextStudentNumber } from '../../services/studentService';

interface AddEditStudentModalProps {
  open: boolean;
  onClose: () => void;
  defaultBlockId?: string;
}

export const AddEditStudentModal: React.FC<AddEditStudentModalProps> = ({
  open,
  onClose,
  defaultBlockId = '',
}) => {
  const { blocks, students, group, addStudent, showToast } = useKam();
  const [name, setName] = useState('');
  const [studentNumber, setStudentNumber] = useState<number>(() => getNextStudentNumber(students));
  const [blockId, setBlockId] = useState(defaultBlockId);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) {
      setName('');
      setStudentNumber(getNextStudentNumber(students));
      setBlockId(defaultBlockId);
    }
  }, [open, students, defaultBlockId]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('يرجى إدخال اسم الطفل', 'warning');
      return;
    }
    setSaving(true);
    try {
      await addStudent({
        name: name.trim(),
        studentNumber: Math.max(1, Math.min(2000, Number(studentNumber) || 1)),
        blockId,
      });
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر إضافة الطفل', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="إضافة طفل جديد"
    >
      <div className="w-full max-w-md max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[var(--kam-surface)] border-t sm:border border-[var(--kam-border)] shadow-2xl overflow-hidden pb-safe">
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <span className="w-10 h-1 rounded-full bg-[var(--kam-border-strong)]" />
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--kam-border)]">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[var(--kam-primary)]" />
            <h2 className="text-base font-bold">إضافة طفل جديد</h2>
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto kam-scrollbar">
          <div>
            <label htmlFor="add-student-name" className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1.5">
              اسم الطفل بالكامل
            </label>
            <input
              id="add-student-name"
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: كيرلس هاني"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm text-[var(--kam-text-primary)] placeholder:text-[var(--kam-text-muted)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="add-student-num" className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1.5">
                رقم الطفل {group?.autoStudentNumber ? '(تلقائي)' : ''}
              </label>
              <input
                id="add-student-num"
                type="number"
                min={1}
                max={2000}
                value={studentNumber}
                onChange={(e) => setStudentNumber(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm font-num text-[var(--kam-text-primary)]"
              />
            </div>

            <div>
              <label htmlFor="add-student-block" className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1.5">
                البلوك / المجموعة
              </label>
              <select
                id="add-student-block"
                value={blockId}
                onChange={(e) => setBlockId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm text-[var(--kam-text-primary)]"
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

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--kam-border)] hover:bg-[var(--kam-surface-variant)]"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] flex-1 sm:flex-initial px-5 py-2 rounded-xl text-xs font-bold bg-[var(--kam-primary)] text-[var(--kam-on-primary)] disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ...' : 'إضافة الطفل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
