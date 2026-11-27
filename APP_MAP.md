# خريطة التطبيق (APP_MAP.md) — نجم الكارت (kAM)

تطبيق ويب وتصميم موبايل-أول لإدارة فصول مدارس الأحد (الحضور الذكي، كروت النقاط، الافتقاد، الرسائل، ولوحة الصدارة) متصل بـ Firebase Auth وFirestore (`ai-studio-android-69ef64c0-fb21-4e5d-8c5b-9e185b0c9dc1`).

## الشاشات والملفات الأساسية
- `src/App.tsx` (1–370): الهيكل الرئيسي بحجم شاشة الموبايل (`max-w-[500px] mx-auto`)، شريط حالة الاتصال والمزامنة (`متصل • مزامنة تلقائية` / `وضع بدون إنترنت` / `جاري مزامنة التغييرات...`)، شريط التنقل السفلي العائم بـ 5 تبويبات (`الرئيسية`, `الافتقاد`, `الرسائل`, `المجموعة`, `الإعدادات`)، ومعاينة صورة الطفل المكبرة (`StudentHoldQuickPeekRootOverlay`).
- `src/pages/SignInPage.tsx` (1–135): شاشة تسجيل الدخول المطابقة لـ `AuthScreen.kt` (نجمة ذهبية، كارت المميزات ومعاينة الـ 7 كروت، وزر تسجيل الدخول بحساب Google فقط).
- `src/pages/GroupOnboardingPage.tsx` (1–180): شاشة الانضمام لمجموعة أو إنشاء مجموعة جديدة المطابقة لـ `GroupOnboardingScreen.kt`.
- `src/pages/HomePage.tsx` (1–1280): الشاشة الرئيسية المطابقة لـ `HomeScreen.kt` (كارت التحكم العلوي، تنبيهات تكرار الكروت، دمج الأسماء المتشابهة، بلوكات الخدام مع تعيين خادم سريع، صفوف الأطفال مع الكروت الملونة `CompactCardButtonsRow` وسجل المحفوظات `📖`، وزر `+ إضافة / استيراد`).
- `src/pages/SmartAttendancePage.tsx` (1–620): التحضير الذكي بالسحب المطابق لـ `SmartAttendanceScreen.kt` مع اختيار الكارت الممنوح `⭐` وشريط الكروت السريع داخل بطاقة السحب.
- `src/pages/VisitationSwipePage.tsx` (1–470): تبويب الافتقاد بالسحب المطابق لـ `VisitationSwipeScreen.kt` وإرسال التقرير التلقائي للشات.
- `src/pages/MessagesPage.tsx` (1–860): شات الفصل والمحادثات الخاصة بتصميم الموبايل (قائمة المحادثات ثم شاشة المحادثة الكاملة مع إخفاء الشريط السفلي تلقائياً) ومحرر الصور قبل الإرسال (تدوير 90° وتعليق).
- `src/pages/ReportsLeaderboardPage.tsx` (1–490): شاشة ترتيب الفصل الكامل المطابقة لـ `FullClassLeaderboardScreen.kt` (4 كروت فلترة، بحث، ترتيب، وتفصيل الكروت الملونة لكل طفل).
- `src/pages/GroupManagePage.tsx` (1–860): إدارة المجموعة المطابقة لـ `GroupAndSettingsScreens.kt` (كارت الأمين الذهبي، عداد صلاحية الرمز اليومي `⏱`، زر المشاركة الذهبي، إدارة البلوكات، ودليل الخدام).
- `src/pages/SettingsPage.tsx` (1–680): الإعدادات المطابقة للموبايل + كارت تثبيت التطبيق (PWA) وحالة المزامنة بدون إنترنت (IndexedDB) واختيار كود الدولة للهاتف والواتساب.

## الحالة والخدمات وقاعدة البيانات والعمل بدون إنترنت (Offline & PWA)
- `src/context/KamContext.tsx`: إدارة الحالة الشاملة، مزامنة Firestore مع `{ includeMetadataChanges: true }`، تتبع `hasPendingWrites` و`syncStatus`، وحفظ نسخة احتياطية فورية في `localStorage` (`kam_offline_snapshot_${groupId}`).
- `src/lib/firebase.ts` & `firebase-applet-config.json`: الاتصال بنفس مشروع وقاعدة بيانات تطبيق الموبايل (`gen-lang-client-0007824663` / `ai-studio-android-69ef64c0-fb21-4e5d-8c5b-9e185b0c9dc1`) مع تفعيل `persistentLocalCache` (IndexedDB) للعمل الكامل بدون إنترنت والمزامنة التلقائية فور عودة الاتصال.
- `public/manifest.webmanifest`, `public/sw.js`, `src/hooks/usePWAInstall.ts`: دعم تثبيت التطبيق كـ PWA والعمل أوفلاين.

## البيلد والنشر (Build & Deploy)
- `vite.config.ts`: ضبط `base: '/Wap/'` و`build.outDir: 'docs'` مع إنشاء `docs/404.html` و`docs/.nojekyll`.
