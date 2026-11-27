import React, { useState } from 'react';
import { AlertCircle, Cloud, Star, Users, Zap } from 'lucide-react';
import { useKam } from '../context/KamContext';

export const SignInPage: React.FC = () => {
  const { signInGoogle, authError, clearAuthError } = useKam();
  const [signingIn, setSigningIn] = useState(false);

  const handleLogin = async () => {
    setSigningIn(true);
    try {
      await signInGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  const row1Cards = [
    { symbol: '✓', points: 3, label: 'الحضور', color: '#2CB578' },
    { symbol: '🤫', points: 5, label: 'الهدوء', color: '#38A3E8' },
    { symbol: '✋', points: 2, label: 'المشاركة', color: '#9D7BFF' },
    { symbol: '🎵', points: 10, label: 'التسبحة', color: '#F06A9B' },
  ];

  const row2Cards = [
    { symbol: '⭐', points: 20, label: 'الذهب', color: '#E5A436' },
    { symbol: '📖', points: 6, label: 'المحفوظات', color: '#22B8B0' },
    { symbol: '🕊️', points: 4, label: 'الاعتراف', color: '#E8854A' },
  ];

  return (
    <div className="min-h-dvh bg-[var(--kam-bg)] text-[var(--kam-text-primary)] flex justify-center">
      <div className="w-full max-w-[480px] min-h-dvh px-5 py-8 flex flex-col items-center justify-between">
        <div className="h-2" />

        {/* Hero Section */}
        <div className="w-full flex flex-col items-center text-center">
          <div
            className="w-[84px] h-[84px] rounded-[22px] border border-[var(--kam-primary)]/40 flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(108, 123, 255, 0.25), rgba(229, 164, 54, 0.20))',
            }}
          >
            <Star className="w-10 h-10 text-[var(--kam-gold)] fill-[var(--kam-gold)]" />
          </div>

          <h1 className="mt-4 text-[1.75rem] font-extrabold text-[var(--kam-text-primary)] leading-tight">
            نجم الكارت
          </h1>

          <p className="mt-1.5 text-sm text-[var(--kam-text-secondary)] leading-relaxed">
            تسجيل حضور وكروت ونقاط الأطفال بضغطة واحدة وسط الفصل
          </p>
        </div>

        {/* Highlights Card */}
        <div className="w-full my-5 rounded-[18px] bg-[var(--kam-surface)] border border-[var(--kam-border)] p-[18px] space-y-3.5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[var(--kam-primary)]/15 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-[var(--kam-primary)]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--kam-text-primary)]">
                سرعة الضغط وسط الفصل
              </div>
              <div className="text-xs text-[var(--kam-text-secondary)] leading-relaxed">
                ٧ كروت معتمدة تحت اسم كل طفل تتحدث فوراً بضغطة واحدة بدون تكرار
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[var(--kam-primary)]/15 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-[var(--kam-primary)]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--kam-text-primary)]">
                الأمين + حتى ٥٠ خادم في مجموعة واحدة
              </div>
              <div className="text-xs text-[var(--kam-text-secondary)] leading-relaxed">
                بلوك ملوّن لكل خادم + قسم بدون بلوك واستيراد الأسماء دفعة واحدة
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[var(--kam-primary)]/15 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5 text-[var(--kam-primary)]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--kam-text-primary)]">
                يعمل بدون إنترنت مع مزامنة تلقائية
              </div>
              <div className="text-xs text-[var(--kam-text-secondary)] leading-relaxed">
                سجّل في وضع الطيران وسيتم حفظ ومزامنة النقاط فور عودة الاتصال
              </div>
            </div>
          </div>

          {/* Mini Card Preview Pills (4 + 3) */}
          <div className="pt-1 space-y-1.5">
            <div className="grid grid-cols-4 gap-1.5">
              {row1Cards.map((c) => (
                <div
                  key={c.label}
                  className="py-1.5 px-1 rounded-[10px] flex flex-col items-center justify-center text-center border"
                  style={{
                    backgroundColor: `${c.color}24`,
                    borderColor: `${c.color}66`,
                  }}
                >
                  <span className="text-[11px] font-bold font-num" style={{ color: c.color }}>
                    {c.symbol} +{c.points}
                  </span>
                  <span className="text-[10px] text-[var(--kam-text-secondary)]">{c.label}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {row2Cards.map((c) => (
                <div
                  key={c.label}
                  className="py-1.5 px-1 rounded-[10px] flex flex-col items-center justify-center text-center border"
                  style={{
                    backgroundColor: `${c.color}24`,
                    borderColor: `${c.color}66`,
                  }}
                >
                  <span className="text-[11px] font-bold font-num" style={{ color: c.color }}>
                    {c.symbol} +{c.points}
                  </span>
                  <span className="text-[10px] text-[var(--kam-text-secondary)]">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sign In Section */}
        <div className="w-full flex flex-col items-center space-y-3">
          {authError && (
            <div
              role="alert"
              className="w-full rounded-xl border border-[var(--kam-danger)]/50 bg-[var(--kam-danger)]/15 p-3 text-xs flex items-start justify-between gap-2"
            >
              <div className="flex items-start gap-2 text-[var(--kam-danger)] font-semibold leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError.messageAr}</span>
              </div>
              <button
                type="button"
                onClick={clearAuthError}
                className="text-[11px] font-bold text-[var(--kam-text-muted)] hover:text-[var(--kam-text-primary)] shrink-0"
              >
                إغلاق
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            disabled={signingIn}
            className="w-full h-[54px] rounded-[14px] bg-[var(--kam-primary)] hover:opacity-95 active:scale-[0.99] text-[var(--kam-on-primary)] font-bold text-base flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 shadow-md"
          >
            {signingIn ? (
              <>
                <span className="w-5 h-5 rounded-full border-2 border-[var(--kam-on-primary)] border-t-transparent animate-spin" />
                <span>جاري تسجيل الدخول...</span>
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5 bg-white rounded-full p-0.5 shrink-0"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                <span>تسجيل الدخول بحساب Google</span>
              </>
            )}
          </button>

          <p className="text-xs text-[var(--kam-text-muted)] text-center">
            يُستخدم حساب Google لمزامنة نقاط أطفال مجموعتك بأمان
          </p>
        </div>
      </div>
    </div>
  );
};
