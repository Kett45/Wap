import React, { useState } from 'react';
import { ArrowRight, KeyRound, LogOut, Plus, Star, Users } from 'lucide-react';
import { useKam } from '../context/KamContext';

export const GroupOnboardingPage: React.FC = () => {
  const {
    userProfile,
    joinedGroups,
    createGroup,
    joinGroup,
    switchGroup,
    updateProfile,
    signOut,
    showToast,
  } = useKam();

  const [isCreatingGroup, setIsCreatingGroup] = useState(true);
  const [servantNameInput, setServantNameInput] = useState(userProfile?.displayName || '');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanServant = servantNameInput.trim();
    if (!cleanServant) {
      showToast('يرجى إدخال اسمك أولاً', 'warning');
      return;
    }
    if (isCreatingGroup && !groupName.trim()) {
      showToast('يرجى إدخال اسم الفصل / المجموعة', 'warning');
      return;
    }
    if (!isCreatingGroup && !inviteCode.trim()) {
      showToast('يرجى إدخال رمز المجموعة اليومي', 'warning');
      return;
    }

    setBusy(true);
    try {
      if (userProfile && cleanServant !== userProfile.displayName) {
        await updateProfile({ displayName: cleanServant });
      }
      if (isCreatingGroup) {
        await createGroup(groupName.trim());
      } else {
        await joinGroup(inviteCode.trim().toUpperCase());
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'حدث خطأ أثناء العملية', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--kam-bg)] text-[var(--kam-text-primary)] flex justify-center">
      <div className="w-full max-w-[500px] min-h-dvh px-5 py-6 flex flex-col items-center overflow-y-auto">
        {joinedGroups.length > 0 && (
          <div className="w-full flex justify-start mb-1">
            <button
              type="button"
              onClick={() => switchGroup(joinedGroups[0].id)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-[var(--kam-text-secondary)] hover:text-[var(--kam-text-primary)] flex items-center gap-1.5"
            >
              <ArrowRight className="w-[18px] h-[18px]" />
              <span>رجوع للمجموعة السابقة</span>
            </button>
          </div>
        )}

        <div className="h-3" />

        {/* Header */}
        <div
          className="w-[72px] h-[72px] rounded-full border border-[var(--kam-primary)]/40 flex items-center justify-center"
          style={{
            background:
              'linear-gradient(135deg, rgba(108, 123, 255, 0.25), rgba(229, 164, 54, 0.25))',
          }}
        >
          <Users className="w-9 h-9 text-[var(--kam-gold)]" />
        </div>

        <div className="mt-2.5 text-sm font-bold text-[var(--kam-gold)]">نجم الكارت</div>
        <h1 className="mt-0.5 text-[1.45rem] font-extrabold text-[var(--kam-text-primary)]">
          إعداد مجموعة الفصل
        </h1>
        <p className="mt-1 text-xs text-[var(--kam-text-secondary)] text-center leading-relaxed">
          اختر دورك للبدء: الأمين ينشئ المجموعة ويستخرج الرمز، والخادم ينضم بالرمز فوراً
        </p>

        {/* Role Switcher Chips */}
        <div className="w-full grid grid-cols-2 gap-2.5 mt-5">
          <button
            type="button"
            onClick={() => setIsCreatingGroup(true)}
            className={`py-3 px-2.5 rounded-[14px] border flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
              isCreatingGroup
                ? 'bg-[var(--kam-primary)]/20 border-[var(--kam-primary)] text-[var(--kam-primary)]'
                : 'bg-[var(--kam-surface)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
            }`}
          >
            <Star className="w-4 h-4 shrink-0" />
            <span>أنا الأمين (إنشاء مجموعة)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreatingGroup(false)}
            className={`py-3 px-2.5 rounded-[14px] border flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
              !isCreatingGroup
                ? 'bg-[var(--kam-primary)]/20 border-[var(--kam-primary)] text-[var(--kam-primary)]'
                : 'bg-[var(--kam-surface)] border-[var(--kam-border)] text-[var(--kam-text-secondary)]'
            }`}
          >
            <KeyRound className="w-4 h-4 shrink-0" />
            <span>أنا خادم (لدي رمز)</span>
          </button>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="w-full mt-5 rounded-[18px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-[18px] space-y-3.5"
        >
          <div>
            <label className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1.5">
              {isCreatingGroup ? 'اسم الأمين' : 'اسم الخادم'}
            </label>
            <input
              type="text"
              required
              value={servantNameInput}
              onChange={(e) => setServantNameInput(e.target.value)}
              placeholder="مثال: أ. مينا جرجس"
              className="w-full h-12 px-3.5 rounded-xl bg-[var(--kam-bg)] border border-[var(--kam-border)] focus:border-[var(--kam-primary)] outline-none text-sm text-[var(--kam-text-primary)]"
            />
          </div>

          {isCreatingGroup ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1.5">
                  اسم الفصل / المجموعة
                </label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="مثال: أسرة الأنبا أنطونيوس - رابعة وخامسة"
                  className="w-full h-12 px-3.5 rounded-xl bg-[var(--kam-bg)] border border-[var(--kam-border)] focus:border-[var(--kam-primary)] outline-none text-sm text-[var(--kam-text-primary)]"
                />
              </div>

              <div className="text-xs text-[var(--kam-text-secondary)] leading-relaxed space-y-0.5">
                <div>• سيتم توليد رمز للمجموعة لمشاركته مع حتى ٥٠ خادم.</div>
                <div>• سيتم إنشاء بلوك خاص بك وتفعل صلاحية الأمين تلقائياً.</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-[var(--kam-text-secondary)] mb-1.5">
                  رمز المجموعة اليومي (مثال: KAMHX3RK-482)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="KAMXXXX-XXX"
                  className="w-full h-12 px-3.5 rounded-xl bg-[var(--kam-bg)] border border-[var(--kam-border)] focus:border-[var(--kam-primary)] outline-none text-sm font-num tracking-wider uppercase text-center text-[var(--kam-text-primary)]"
                />
              </div>

              <div className="text-xs text-[var(--kam-text-secondary)] leading-relaxed space-y-0.5">
                <div>• اطلب رمز المجموعة من الأمين (يتجدد تلقائياً كل ٢٤ ساعة للأمان).</div>
                <div>• بمجرد الانضمام سيتم إنشاء بلوك ملوّن باسمك داخل المجموعة.</div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-[54px] rounded-[14px] bg-[var(--kam-primary)] hover:opacity-95 text-[var(--kam-on-primary)] font-bold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
          >
            {busy ? (
              <span className="w-5 h-5 rounded-full border-2 border-[var(--kam-on-primary)] border-t-transparent animate-spin" />
            ) : (
              <>
                {isCreatingGroup ? (
                  <Plus className="w-5 h-5 shrink-0" />
                ) : (
                  <KeyRound className="w-5 h-5 shrink-0" />
                )}
                <span>
                  {isCreatingGroup ? 'إنشاء المجموعة وتوليد الرمز' : 'انضمام للمجموعة وإنشاء بلوكي'}
                </span>
              </>
            )}
          </button>
        </form>

        <div className="flex-1 min-h-4" />

        {/* Bottom Switch Account / Logout */}
        <button
          type="button"
          onClick={signOut}
          className="w-full h-[46px] mt-4 rounded-xl border border-[var(--kam-border)] bg-transparent hover:bg-[var(--kam-surface)] text-xs font-semibold text-[var(--kam-text-secondary)] flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4 text-[var(--kam-text-muted)]" />
          <span>تبديل الحساب / تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
};
