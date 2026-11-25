import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  Calendar,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import { useKam } from '../context/KamContext';
import { isRunningInIframe } from '../services/authService';

export const SignInPage: React.FC = () => {
  const { signInGoogle, signInGoogleRedirect, authError, clearAuthError } = useKam();
  const [signingInMode, setSigningInMode] = useState<'NONE' | 'POPUP' | 'REDIRECT'>('NONE');

  const inIframe = useMemo(() => isRunningInIframe(), []);

  const handlePopupLogin = async () => {
    setSigningInMode('POPUP');
    try {
      await signInGoogle();
    } finally {
      setSigningInMode('NONE');
    }
  };

  const handleRedirectLogin = async () => {
    setSigningInMode('REDIRECT');
    try {
      await signInGoogleRedirect();
    } finally {
      setSigningInMode('NONE');
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--kam-bg)] text-[var(--kam-text-primary)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl border border-[var(--kam-border)] bg-[var(--kam-surface)] overflow-hidden shadow-xl">
        {/* Primary Sign-In Card (First on mobile for instant above-the-fold thumb access) */}
        <div className="lg:col-span-6 lg:order-2 p-6 sm:p-10 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full space-y-6">
            {/* Compact Mobile Brand Header */}
            <div className="flex items-center gap-3.5 lg:hidden">
              <div className="w-12 h-12 rounded-2xl bg-[var(--kam-primary)] text-white flex items-center justify-center font-num font-extrabold text-lg shrink-0 shadow-sm">
                kAM
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight">نجم الكارت</h1>
                <p className="text-xs text-[var(--kam-text-muted)]">
                  إدارة فصول مدارس الأحد وخدمة الأطفال
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-extrabold">تسجيل الدخول</h2>
              <p className="text-sm text-[var(--kam-text-secondary)] leading-relaxed">
                سجّل الدخول بحساب Google للوصول إلى فصولك ومتابعة الحضور والكروت والافتقاد.
              </p>
            </div>

            {/* Clean User-Facing Error Alert (no technical codes or project IDs) */}
            {authError && (
              <div
                role="alert"
                className="rounded-2xl border border-[var(--kam-danger)]/40 bg-[var(--kam-danger)]/10 p-3.5 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 text-[var(--kam-text-primary)] leading-relaxed">
                    <AlertCircle className="w-4 h-4 text-[var(--kam-danger)] shrink-0 mt-0.5" />
                    <span>{authError.messageAr}</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearAuthError}
                    className="text-xs font-semibold text-[var(--kam-text-muted)] hover:text-[var(--kam-text-primary)] shrink-0 px-1.5 py-0.5"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            )}

            {/* Primary & Mobile Redirect Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handlePopupLogin}
                disabled={signingInMode !== 'NONE'}
                className="w-full min-h-[50px] py-3.5 px-4 rounded-2xl bg-[var(--kam-primary)] hover:opacity-95 active:scale-[0.99] text-[var(--kam-on-primary)] font-bold text-sm flex items-center justify-center gap-3 transition-all disabled:opacity-60 shadow-sm"
              >
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
                <span>
                  {signingInMode === 'POPUP' ? 'جاري تسجيل الدخول...' : 'المتابعة باستخدام Google'}
                </span>
              </button>

              {!inIframe && (
                <button
                  type="button"
                  onClick={handleRedirectLogin}
                  disabled={signingInMode !== 'NONE'}
                  className="w-full min-h-[46px] py-2.5 px-4 rounded-2xl bg-[var(--kam-surface-variant)] hover:border-[var(--kam-primary)] border border-[var(--kam-border)] text-[var(--kam-text-primary)] font-semibold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Smartphone className="w-4 h-4 text-[var(--kam-tertiary)] shrink-0" />
                  <span>
                    {signingInMode === 'REDIRECT'
                      ? 'جاري التحويل إلى Google...'
                      : 'تسجيل الدخول بطريقة بديلة للموبايل'}
                  </span>
                </button>
              )}
            </div>

            <div className="flex items-start gap-2.5 pt-4 border-t border-[var(--kam-border)] text-xs text-[var(--kam-text-muted)] leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-[var(--kam-success)] shrink-0 mt-0.5" />
              <span>
                بيانات الفصل والأطفال والخدام محمية ومخصصة لأعضاء فصلك فقط.
              </span>
            </div>
          </div>
        </div>

        {/* Visual Brand & Highlights Panel (Second on mobile, Right side on desktop) */}
        <div className="lg:col-span-6 lg:order-1 p-6 sm:p-10 flex flex-col justify-between bg-[var(--kam-surface-variant)]/55 border-t lg:border-t-0 lg:border-l border-[var(--kam-border)]">
          <div className="space-y-5">
            <div className="hidden lg:flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[var(--kam-primary)] text-white flex items-center justify-center font-num font-extrabold text-lg">
                kAM
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight">نجم الكارت</h1>
                <p className="text-xs text-[var(--kam-text-muted)]">
                  إدارة فصول مدارس الأحد وخدمة الأطفال
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg sm:text-2xl font-extrabold leading-snug text-balance">
                متابعة الحضور، الكروت، والافتقاد بسهولة ومزامنة فورية
              </h3>
              <p className="text-xs sm:text-sm text-[var(--kam-text-secondary)] leading-relaxed">
                كل ما يحتاجه خادم مدارس الأحد في مكان واحد لمتابعة أطفال الفصل وتسجيل النقاط الأسبوعية والتواصل مع باقي الخدام.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3.5 pt-5 border-t border-[var(--kam-border)]">
            <div className="flex items-start gap-2.5">
              <Award className="w-4 h-4 text-[var(--kam-gold)] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold">كروت النقاط والأرصدة</div>
                <div className="text-[0.7rem] text-[var(--kam-text-muted)]">
                  حساب تلقائي للأرصدة الشهرية
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-[var(--kam-tertiary)] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold">تقويم السبت والقبطي</div>
                <div className="text-[0.7rem] text-[var(--kam-text-muted)]">
                  تقارير أسبوعية وشهرية دقيقة
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Users className="w-4 h-4 text-[var(--kam-success)] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold">بلوكات الخدام والافتقاد</div>
                <div className="text-[0.7rem] text-[var(--kam-text-muted)]">
                  تنظيم مرن مع متابعة لحظية
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MessageSquare className="w-4 h-4 text-[var(--kam-primary)] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold">شات جماعي ورسائل خاصة</div>
                <div className="text-[0.7rem] text-[var(--kam-text-muted)]">
                  تنسيق سريع وتقارير تحضير
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
