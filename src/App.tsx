import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  HeartHandshake,
  Home,
  MessageSquare,
  RefreshCw,
  Settings,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { KamProvider, useKam } from './context/KamContext';
import { ToastContainer } from './components/ui/ToastContainer';
import { AvatarBadge } from './components/ui/AvatarBadge';
import { SignInPage } from './pages/SignInPage';
import { GroupOnboardingPage } from './pages/GroupOnboardingPage';
import { HomePage } from './pages/HomePage';
import { SmartAttendancePage } from './pages/SmartAttendancePage';
import { VisitationSwipePage } from './pages/VisitationSwipePage';
import { ReportsLeaderboardPage } from './pages/ReportsLeaderboardPage';
import { MessagesPage } from './pages/MessagesPage';
import { GroupManagePage } from './pages/GroupManagePage';
import { SettingsPage } from './pages/SettingsPage';
import { getLocalReadCount } from './services/chatService';
import { buildMonthlyBalanceDocId } from './lib/kamRules';
import { usePWAInstall } from './hooks/usePWAInstall';

type MainTab = 'HOME' | 'VISITATION' | 'MESSAGES' | 'GROUP' | 'SETTINGS';
type SubView = 'NONE' | 'SMART_ATTENDANCE' | 'LEADERBOARD';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      errorMsg: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-[#07080D] text-[#F4F6FB] flex items-center justify-center p-6">
          <div className="max-w-sm w-full rounded-2xl bg-[#11131C] border border-[#23283B] p-6 text-center space-y-4">
            <div className="text-lg font-extrabold text-[#EF5350]">حدث خطأ أثناء تحميل الشاشة</div>
            <p className="text-xs text-[#9AA2BC] break-words">{this.state.errorMsg}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full h-11 rounded-xl bg-[#6C7BFF] text-white font-bold text-xs"
            >
              إعادة تحميل التطبيق
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const StudentHoldQuickPeekRootOverlay: React.FC = () => {
  const {
    quickPeekStudent,
    setQuickPeekStudent,
    blocks,
    monthlyBalances,
    selectedMonthKey,
    avatarCache,
  } = useKam();

  if (!quickPeekStudent) return null;

  const block = blocks.find((b) => b.id === quickPeekStudent.blockId);
  const blockColor = block?.colorHex || '#6C7BFF';
  const blockName = block ? `بلوك ${block.servantName}` : 'بدون بلوك';
  const balId = buildMonthlyBalanceDocId(selectedMonthKey, quickPeekStudent.id);
  const monthPts = monthlyBalances.find((b) => b.id === balId)?.totalPoints ?? 0;
  const packedAvatar = avatarCache[quickPeekStudent.id] || quickPeekStudent.avatarBase64;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => setQuickPeekStudent(null)}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[330px] rounded-[24px] bg-[var(--kam-surface)] border-2 p-5 flex flex-col items-center text-center shadow-2xl space-y-3"
        style={{ borderColor: blockColor }}
      >
        <div className="w-full flex items-center justify-between">
          <span
            className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold"
            style={{ backgroundColor: `${blockColor}24`, color: blockColor }}
          >
            {blockName}
          </span>
          <button
            type="button"
            onClick={() => setQuickPeekStudent(null)}
            className="w-7 h-7 rounded-full bg-[var(--kam-surface-variant)] flex items-center justify-center text-[var(--kam-text-muted)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <AvatarBadge
          studentId={quickPeekStudent.id}
          directBase64={packedAvatar}
          name={quickPeekStudent.name}
          initials={quickPeekStudent.avatarInitials}
          accentHex={blockColor}
          size="xl"
        />

        <div className="space-y-1">
          <div className="text-lg font-extrabold text-[var(--kam-text-primary)] leading-snug">
            {quickPeekStudent.name}
          </div>
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="font-num font-bold text-[var(--kam-text-secondary)]">
              رقم #{quickPeekStudent.studentNumber}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-[var(--kam-gold)]/20 text-[var(--kam-gold)] font-num font-bold">
              {monthPts} نقطة هذا الشهر
            </span>
          </div>
        </div>

        {quickPeekStudent.lastMemorizedText && (
          <div className="w-full rounded-xl bg-[#22B8B0]/12 border border-[#22B8B0]/35 px-3 py-2 text-right">
            <div className="text-[10px] font-bold text-[#22B8B0]">📖 آخر تسميع محفوظات:</div>
            <div className="text-xs font-semibold text-[var(--kam-text-primary)] mt-0.5">
              {quickPeekStudent.lastMemorizedText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MainShell: React.FC = () => {
  const {
    authLoading,
    dataLoading,
    firebaseUser,
    userProfile,
    isPreviewMode,
    group,
    isAdmin,
    chatMeta,
    dmRooms,
    syncStatus,
    isInsideActiveChatRoom,
    setIsInsideActiveChatRoom,
    refreshAllData,
  } = useKam();

  const { isInstallable, isInstalled, triggerInstall } = usePWAInstall();

  const [activeTab, setActiveTab] = useState<MainTab>('HOME');
  const [subView, setSubView] = useState<SubView>('NONE');
  const lastHomeClickRef = useRef<number>(0);

  const canSeeLeaderboard = isAdmin || group?.showLeaderboard !== false;

  useEffect(() => {
    if (subView === 'LEADERBOARD' && !canSeeLeaderboard) {
      setSubView('NONE');
    }
  }, [subView, canSeeLeaderboard]);

  useEffect(() => {
    if (activeTab !== 'MESSAGES' && isInsideActiveChatRoom) {
      setIsInsideActiveChatRoom(false);
    }
  }, [activeTab, isInsideActiveChatRoom, setIsInsideActiveChatRoom]);

  if (authLoading) {
    return (
      <div className="min-h-dvh bg-[var(--kam-bg)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--kam-primary)] text-white flex items-center justify-center font-num font-bold animate-pulse">
            kAM
          </div>
          <span className="text-xs text-[var(--kam-text-muted)]">جاري التحميل...</span>
        </div>
      </div>
    );
  }

  if (!isPreviewMode && !firebaseUser) {
    return <SignInPage />;
  }

  if (!userProfile?.groupId || (!dataLoading && !group)) {
    return <GroupOnboardingPage />;
  }

  const handleTabSelect = (tab: MainTab) => {
    const now = Date.now();
    if (tab === 'HOME') {
      if (subView !== 'NONE') {
        setSubView('NONE');
        setActiveTab('HOME');
        lastHomeClickRef.current = now;
        return;
      }
      if (activeTab === 'HOME' && now - lastHomeClickRef.current < 450) {
        refreshAllData();
      }
      setActiveTab('HOME');
      lastHomeClickRef.current = now;
      return;
    }
    setSubView('NONE');
    setActiveTab(tab);
  };

  // Unread total for Messages badge
  const groupUnread =
    group && chatMeta?.totalMessagesCount !== undefined
      ? Math.max(0, chatMeta.totalMessagesCount - getLocalReadCount(`grp_${group.id}`))
      : 0;
  const dmUnread = dmRooms.reduce(
    (acc, r) => acc + Math.max(0, (r.totalMessagesCount ?? 0) - getLocalReadCount(`dm_${r.id}`)),
    0
  );
  const totalUnread = activeTab === 'MESSAGES' ? 0 : groupUnread + dmUnread;

  const navItems: Array<{
    id: MainTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'HOME', label: 'الرئيسية', icon: Home },
    { id: 'VISITATION', label: 'الافتقاد', icon: HeartHandshake },
    { id: 'MESSAGES', label: 'الرسائل', icon: MessageSquare, badge: totalUnread },
    { id: 'GROUP', label: 'المجموعة', icon: Users },
    { id: 'SETTINGS', label: 'الإعدادات', icon: Settings },
  ];

  const showBottomBar =
    subView === 'NONE' && !(activeTab === 'MESSAGES' && isInsideActiveChatRoom);

  const renderContent = () => {
    if (subView === 'SMART_ATTENDANCE') {
      return <SmartAttendancePage onBack={() => setSubView('NONE')} />;
    }
    if (subView === 'LEADERBOARD' && canSeeLeaderboard) {
      return <ReportsLeaderboardPage onBack={() => setSubView('NONE')} />;
    }

    switch (activeTab) {
      case 'HOME':
        return (
          <HomePage
            onOpenSmartAttendance={() => setSubView('SMART_ATTENDANCE')}
            onOpenVisitation={() => setActiveTab('VISITATION')}
            onOpenLeaderboard={() => setSubView('LEADERBOARD')}
          />
        );
      case 'VISITATION':
        return <VisitationSwipePage onBack={() => setActiveTab('HOME')} />;
      case 'MESSAGES':
        return <MessagesPage />;
      case 'GROUP':
        return <GroupManagePage />;
      case 'SETTINGS':
        return <SettingsPage />;
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--kam-bg)] text-[var(--kam-text-primary)] flex justify-center">
      {/* Phone-sized container centered even on desktop browsers */}
      <div className="w-full max-w-[500px] min-h-dvh bg-[var(--kam-bg)] sm:border-x sm:border-[var(--kam-border)]/50 relative flex flex-col">
        {/* Compact Connectivity & Offline Sync Indicator Bar */}
        <div className="sticky top-0 z-30 px-3 py-1 bg-[var(--kam-surface)]/95 backdrop-blur-md border-b border-[var(--kam-border)]/70 flex items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0">
            {syncStatus === 'OFFLINE' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#E5A436] shrink-0" />
                <WifiOff className="w-3.5 h-3.5 text-[#E5A436] shrink-0" />
                <span className="font-bold text-[#E5A436] truncate">
                  وضع بدون إنترنت — يتم حفظ التغييرات محلياً
                </span>
              </>
            ) : syncStatus === 'SYNCING' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-[var(--kam-primary)] animate-spin shrink-0" />
                <span className="font-bold text-[var(--kam-primary)] truncate">
                  جاري مزامنة التغييرات...
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-[#2CB578] shrink-0" />
                <Wifi className="w-3 h-3 text-[#2CB578] shrink-0" />
                <span className="font-semibold text-[var(--kam-text-secondary)] truncate">
                  متصل • مزامنة تلقائية
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isInstallable && !isInstalled && (
              <button
                type="button"
                onClick={() => triggerInstall()}
                className="px-2 py-0.5 rounded-md bg-[var(--kam-primary)]/18 border border-[var(--kam-primary)]/40 text-[var(--kam-primary)] font-bold text-[10px] flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>تثبيت</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => refreshAllData()}
              title="مزامنة الآن"
              className="p-1 rounded-md text-[var(--kam-text-muted)] hover:text-[var(--kam-primary)] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Main Screen Viewport */}
        <main className={`flex-1 min-w-0 px-3 pt-2.5 ${showBottomBar ? 'pb-24' : 'pb-4'}`}>
          {dataLoading && !group ? (
            <div className="py-20 text-center text-xs text-[var(--kam-text-muted)]">
              جاري تحميل بيانات الفصل...
            </div>
          ) : (
            renderContent()
          )}
        </main>

        {/* Floating Capsule 5-Tab Bottom Navigation Bar (Matching KamBottomNavigationBar.kt) */}
        {showBottomBar && (
          <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none flex justify-center px-3.5 pb-2.5 pt-1">
            <nav
              aria-label="التنقل السفلي"
              className="pointer-events-auto w-full max-w-[475px] h-[66px] rounded-[28px] bg-[var(--kam-surface)]/95 backdrop-blur-md border border-[var(--kam-border)]/85 shadow-2xl px-1.5 py-1.5 grid grid-cols-5 gap-0.5"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const selected = activeTab === item.id;
                const badgeCount = item.badge ?? 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTabSelect(item.id)}
                    className={`relative h-full rounded-[22px] flex flex-col items-center justify-center transition-all select-none ${
                      selected
                        ? 'bg-[var(--kam-primary)]/18 border border-[var(--kam-primary)]/40 text-[var(--kam-primary)]'
                        : 'text-[var(--kam-text-muted)] hover:text-[var(--kam-text-secondary)]'
                    }`}
                  >
                    {/* Top Glow Accent Bar */}
                    <span
                      className={`h-[3px] rounded-full transition-all duration-200 mb-0.5 ${
                        selected ? 'w-4 bg-[var(--kam-primary)]' : 'w-0 bg-transparent'
                      }`}
                    />

                    <div className="relative flex items-center justify-center">
                      <Icon
                        className={`transition-transform duration-200 ${
                          selected ? 'w-[21px] h-[21px] scale-105' : 'w-[19px] h-[19px]'
                        }`}
                      />
                      {badgeCount > 0 && (
                        <span className="absolute -top-1.5 -left-2.5 min-w-[16px] h-[15px] px-1 rounded-full bg-[var(--kam-danger)] text-white font-num font-extrabold text-[9px] flex items-center justify-center leading-none">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                    </div>

                    <span
                      className={`mt-0.5 text-[10px] leading-tight truncate max-w-full px-0.5 ${
                        selected
                          ? 'font-extrabold text-[var(--kam-text-primary)]'
                          : 'font-medium text-[var(--kam-text-muted)]'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        <StudentHoldQuickPeekRootOverlay />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppErrorBoundary>
      <KamProvider>
        <MainShell />
        <ToastContainer />
      </KamProvider>
    </AppErrorBoundary>
  );
}
