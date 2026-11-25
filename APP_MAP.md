# خريطة التطبيق (APP_MAP.md) — نجم الكارت (kAM)

تطبيق ويب وتصميم موبايل-أول لإدارة فصول مدارس الأحد (الحضور الذكي، كروت النقاط، الافتقاد، الرسائل، ولوحة الصدارة) متصل بـ Firebase Auth وFirestore (`ai-studio-android-69ef64c0-fb21-4e5d-8c5b-9e185b0c9dc1`).

## الشاشات والملفات الأساسية
- `src/App.tsx` (1–270): الهيكل الرئيسي، الشريط العلوي للموبايل، القائمة الجانبية، وشريط التنقل السفلي.
- `src/pages/SignInPage.tsx` (1–135): شاشة تسجيل الدخول بحساب Google (Popup + Redirect للموبايل).
- `src/pages/GroupOnboardingPage.tsx` (1–157): شاشة الانضمام لفصل بكود دعوة يومي أو إنشاء فصل جديد.
- `src/pages/HomePage.tsx` (1–475): الشاشة الرئيسية، البلوكات، كروت الأطفال، ومنح النقاط.
- `src/pages/SmartAttendancePage.tsx` (1–390): التحضير الذكي بالسحب (`SwipeableCard`) ومقارنة التحضير.
- `src/pages/VisitationSwipePage.tsx` (1–320): الافتقاد بالسحب وإرسال تقرير الافتقاد للشات.
- `src/pages/MessagesPage.tsx` (1–780): شات الفصل، الرسائل الخاصة، التقارير التلقائية، ومعاينة الصور.
- `src/pages/ReportsLeaderboardPage.tsx` (1–430): التقارير ولوحة الصدارة وفلترة الأسابيع والبلوكات.
- `src/pages/GroupManagePage.tsx` (1–760): إدارة الفصل، كود الدعوة اليومي (للمسؤول)، البلوكات، ودليل الخدام.
- `src/pages/SettingsPage.tsx` (1–520): إعدادات الحساب، صورة الخادم، استوديو الخطوط والأحجام (`70%–165%`)، والثيمات.

## الحالة والخدمات وقاعدة البيانات
- `src/context/KamContext.tsx`: إدارة الحالة الشاملة ومزامنة Firestore اللحظية.
- `src/lib/firebase.ts` & `firebase-applet-config.json`: إعدادات الاتصال بـ Firebase (`gen-lang-client-0007824663`) مع تفعيل `experimentalForceLongPolling` لضمان استقرار اتصال Firestore على الموبايل والـ iframe.
- `src/services/authService.ts`, `groupService.ts`, `studentService.ts`, `chatService.ts`: خدمات Firebase.
- `src/hooks/useTheme.ts`: التحكم في الثيمات، حجم الواجهة، ونوع وسمك الخط العربي.

## البيلد والنشر (Build & Deploy)
- `vite.config.ts`: ضبط `base` تلقائيًا لـ GitHub Pages (`/<repo-name>/`) مع نسخ `index.html` إلى `404.html`.
- `.github/workflows/deploy.yml`: بناء ونشر تلقائي على GitHub Pages عبر GitHub Actions.
