import React, { useState } from 'react';
import { KeyRound, LogOut, PlusCircle, Users } from 'lucide-react';
import { useKam } from '../context/KamContext';

export const GroupOnboardingPage: React.FC = () => {
  const { userProfile, createGroup, joinGroup, signOut, showToast } = useKam();
  const [mode, setMode] = useState<'JOIN' | 'CREATE'>('JOIN');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      showToast('أدخل اسم الفصل أولاً', 'warning');
      return;
    }
    setBusy(true);
    try {
      await createGroup(groupName.trim());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر إنشاء الفصل', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      showToast('أدخل كود الدعوة المركب أولاً', 'warning');
      return;
    }
    setBusy(true);
    try {
      await joinGroup(inviteCode.trim());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر الانضمام للفصل', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--kam-bg)] text-[var(--kam-text-primary)] flex items-center justify-center p-4 pb-safe">
      <div className="w-full max-w-lg rounded-2xl bg-[var(--kam-surface)] border border-[var(--kam-border)] p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--kam-primary)] text-white flex items-center justify-center font-num font-bold text-sm">
              kAM
            </div>
            <div>
              <h1 className="text-lg font-bold">مرحباً {userProfile?.displayName}</h1>
              <p className="text-xs text-[var(--kam-text-muted)]">انضم إلى فصل موجود أو أنشئ فصلاً جديداً</p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--kam-text-secondary)] border border-[var(--kam-border)] hover:text-[var(--kam-danger)] flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج</span>
          </button>
        </div>

        {/* Mode switch */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)]">
          <button
            type="button"
            onClick={() => setMode('JOIN')}
            className={`min-h-[44px] py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'JOIN'
                ? 'bg-[var(--kam-primary)] text-white'
                : 'text-[var(--kam-text-secondary)] hover:text-[var(--kam-text-primary)]'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>الانضمام بكود دعوة</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('CREATE')}
            className={`min-h-[44px] py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'CREATE'
                ? 'bg-[var(--kam-primary)] text-white'
                : 'text-[var(--kam-text-secondary)] hover:text-[var(--kam-text-primary)]'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>إنشاء فصل جديد</span>
          </button>
        </div>

        {mode === 'JOIN' ? (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="onboarding-invite-code" className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1.5">
                كود الدعوة اليومي من أمين الفصل
              </label>
              <input
                id="onboarding-invite-code"
                type="text"
                dir="ltr"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="KAM4X9P2-AB12"
                className="w-full px-4 py-3 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-center font-num text-base tracking-wider uppercase"
              />
              <p className="mt-1.5 text-xs text-[var(--kam-text-muted)]">
                أدخل الكود المركّب بصيغة كود الفصل متبوعاً برمز اليوم (صالح لمدة 24 ساعة).
              </p>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[48px] py-3 rounded-xl bg-[var(--kam-primary)] text-white text-sm font-bold disabled:opacity-50"
            >
              {busy ? 'جاري التحقق والانضمام...' : 'انضمام للفصل'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="onboarding-group-name" className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1.5">
                اسم الفصل / الخدمة
              </label>
              <input
                id="onboarding-group-name"
                type="text"
                required
                maxLength={100}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="مثال: فصل الأنبا كاراس — خامسة ابتدائي"
                className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] text-sm"
              />
              <p className="mt-1.5 text-xs text-[var(--kam-text-muted)]">
                سيتم إنشاء كود دعوة خاص بالفصل تلقائياً وتعيينك كأمين الفصل الأساسي.
              </p>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[48px] py-3 rounded-xl bg-[var(--kam-primary)] text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4" />
              <span>{busy ? 'جاري إنشاء الفصل...' : 'إنشاء الفصل الآن'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
