import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ClipboardCheck,
  HeartHandshake,
  Home,
  MessageSquare,
  RefreshCw,
  Settings,
  Trophy,
  Users,
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

type MainTab = 'HOME' | 'MESSAGES' | 'GROUP' | 'SETTINGS';
type SubView = 'NONE' | 'SMART_ATTENDANCE' | 'VISITATION' | 'LEADERBOARD';

const MainShell: React.FC = () => {
  const {
    authLoading,
    dataLoading,
    firebaseUser,
    userProfile,
    isPreviewMode,
    group,
    joinedGroups,
    members,
    isAdmin,
    chatMeta,
    dmRooms,
    switchGroup,
    refreshAllData,
  } = useKam();

  const [activeTab, setActiveTab] = useState<MainTab>('HOME');
  const [subView, setSubView] = useState<SubView>('NONE');
  const [syncingTop, setSyncingTop] = useState(false);
  const lastHomeClickRef = useRef<number>(0);

  const canSeeLeaderboard = isAdmin || group?.showLeaderboard !== false;

  useEffect(() => {
    if (subView === 'LEADERBOARD' && !canSeeLeaderboard) {
      setSubView('NONE');
    }
  }, [subView, canSeeLeaderboard]);

  if (authLoading) {
    return (
      <div className="min-h-dvh bg-[var(--kam-bg)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[var(--kam-primary)] text-white flex items-center justify-center font-num font-bold animate-pulse">
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

  const myMember = members.find((m) => m.uid === userProfile.userId);
  const myAvatar = myMember?.avatarBase64 || myMember?.avatar || '';

  const handleHomeNavClick = () => {
    const now = Date.now();
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
  };

  const handleTopSync = async () => {
    setSyncingTop(true);
    try {
      await refreshAllData();
    } finally {
      setSyncingTop(false);
    }
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
    { id: 'MESSAGES', label: 'الرسائل', icon: MessageSquare, badge: totalUnread },
    { id: 'GROUP', label: 'الفصل', icon: Users },
    { id: 'SETTINGS', label: 'الإعدادات', icon: Settings },
  ];

  const renderContent = () => {
    if (subView === 'SMART_ATTENDANCE') {
      return <SmartAttendancePage onBack={() => setSubView('NONE')} />;
    }
    if (subView === 'VISITATION') {
      return <VisitationSwipePage onBack={() => setSubView('NONE')} />;
    }
    if (subView === 'LEADERBOARD' && canSeeLeaderboard) {
      return <ReportsLeaderboardPage onBack={() => setSubView('NONE')} />;
    }

    switch (activeTab) {
      case 'HOME':
        return (
          <HomePage
            onOpenSmartAttendance={() => setSubView('SMART_ATTENDANCE')}
            onOpenVisitation={() => setSubView('VISITATION')}
            onOpenLeaderboard={() => setSubView('LEADERBOARD')}
          />
        );
      case 'MESSAGES':
        return <MessagesPage />;
      case 'GROUP':
        return <GroupManagePage />;
      case 'SETTINGS':
        return <SettingsPage />;
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--kam-bg)] text-[var(--kam-text-primary)] flex flex-col md:flex-row">
      {/* Compact Sticky Mobile Top App Bar (~52px) */}
      <header className="md:hidden sticky top-0 z-30 h-13 px-3 bg-[var(--kam-surface)]/92 backdrop-blur-md border-b border-[var(--kam-border)] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setSubView('NONE');
            setActiveTab('SETTINGS');
          }}
          aria-label="ملفي الشخصي والإعدادات"
          className="flex items-center gap-2 min-h-[44px] pr-0.5 pl-1 shrink-0"
        >
          <AvatarBadge
            directBase64={myAvatar}
            name={userProfile.displayName}
            size="xs"
            online
          />
        </button>

        <div className="flex-1 min-w-0 flex items-center justify-center">
          {joinedGroups.length > 1 ? (
            <div className="relative max-w-full">
              <select
                aria-label="تبديل الفصل النشط"
                value={group?.id || ''}
                onChange={(e) => switchGroup(e.target.value)}
                className="appearance-none bg-[var(--kam-surface-variant)] border border-[var(--kam-border)] rounded-xl pr-3 pl-7 py-1.5 text-xs font-extrabold text-[var(--kam-text-primary)] max-w-[13rem] truncate"
              >
                {joinedGroups.map((g) => (
                  <option key={g.id} value={g.id} className="bg-[var(--kam-surface)]">
                    {g.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--kam-text-muted)] pointer-events-none absolute left-2 top-1/2 -translate-y-1/2" />
            </div>
          ) : (
            <span className="text-sm font-extrabold truncate">{group?.name || 'نجم الكارت'}</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleTopSync}
          disabled={syncingTop}
          aria-label="تحديث البيانات"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--kam-text-secondary)] hover:text-[var(--kam-primary)] shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${syncingTop ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Desktop Side Rail (RTL Right) */}
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-l border-[var(--kam-border)] bg-[var(--kam-surface)] sticky top-0 h-screen">
        <div className="px-4 py-4 border-b border-[var(--kam-border)] flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setSubView('NONE');
              setActiveTab('SETTINGS');
            }}
            aria-label="الملف الشخصي والإعدادات"
            className="shrink-0"
          >
            <AvatarBadge
              directBase64={myAvatar}
              name={userProfile.displayName}
              size="sm"
              online
            />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-extrabold leading-tight truncate">نجم الكارت</div>
            <div className="text-xs text-[var(--kam-text-muted)] truncate">
              {userProfile.displayName}
            </div>
          </div>
        </div>

        <nav aria-label="التنقل الرئيسي" className="p-3 space-y-1 flex-1 overflow-y-auto kam-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = subView === 'NONE' && activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'HOME') {
                    handleHomeNavClick();
                  } else {
                    setSubView('NONE');
                    setActiveTab(item.id);
                  }
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between transition-colors ${
                  active
                    ? 'bg-[var(--kam-primary-container)] text-[var(--kam-primary)]'
                    : 'text-[var(--kam-text-secondary)] hover:bg-[var(--kam-surface-variant)] hover:text-[var(--kam-text-primary)]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.badge && item.badge > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-md bg-[var(--kam-primary)] text-white font-num text-[0.65rem]">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-[var(--kam-border)] space-y-1">
            <div className="px-3.5 pb-1 text-xs font-semibold text-[var(--kam-text-muted)]">
              أدوات الخدمة السريعة
            </div>
            <button
              type="button"
              onClick={() => setSubView('SMART_ATTENDANCE')}
              className={`w-full px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-colors ${
                subView === 'SMART_ATTENDANCE'
                  ? 'bg-[var(--kam-primary-container)] text-[var(--kam-primary)]'
                  : 'text-[var(--kam-text-secondary)] hover:bg-[var(--kam-surface-variant)]'
              }`}
            >
              <ClipboardCheck className="w-4 h-4 shrink-0" />
              <span>التحضير الذكي</span>
            </button>
            <button
              type="button"
              onClick={() => setSubView('VISITATION')}
              className={`w-full px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-colors ${
                subView === 'VISITATION'
                  ? 'bg-[var(--kam-primary-container)] text-[var(--kam-primary)]'
                  : 'text-[var(--kam-text-secondary)] hover:bg-[var(--kam-surface-variant)]'
              }`}
            >
              <HeartHandshake className="w-4 h-4 shrink-0" />
              <span>الافتقاد الذكي</span>
            </button>
            {canSeeLeaderboard && (
              <button
                type="button"
                onClick={() => setSubView('LEADERBOARD')}
                className={`w-full px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-colors ${
                  subView === 'LEADERBOARD'
                    ? 'bg-[var(--kam-primary-container)] text-[var(--kam-primary)]'
                    : 'text-[var(--kam-text-secondary)] hover:bg-[var(--kam-surface-variant)]'
                }`}
              >
                <Trophy className="w-4 h-4 shrink-0" />
                <span>التقارير والصدارة</span>
              </button>
            )}
          </div>
        </nav>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 px-3 py-3 sm:p-6 pb-20 md:pb-6 max-w-6xl w-full mx-auto">
        {dataLoading && !group ? (
          <div className="py-20 text-center text-xs text-[var(--kam-text-muted)]">
            جاري تحميل بيانات الفصل...
          </div>
        ) : (
          renderContent()
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Natural Thumb Zone, compact with pb-safe) */}
      <nav
        aria-label="التنقل السفلي"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--kam-surface)]/95 backdrop-blur-md border-t border-[var(--kam-border)] px-2 pt-1 pb-safe grid grid-cols-4 gap-1"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = subView === 'NONE' && activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'HOME') {
                  handleHomeNavClick();
                } else {
                  setSubView('NONE');
                  setActiveTab(item.id);
                }
              }}
              className={`relative min-h-[48px] py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[0.7rem] font-bold transition-colors ${
                active
                  ? 'text-[var(--kam-primary)] bg-[var(--kam-primary-container)]/40'
                  : 'text-[var(--kam-text-muted)]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="whitespace-nowrap">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="absolute top-1 left-3 px-1.5 py-0.2 rounded-full bg-[var(--kam-primary)] text-white font-num text-[0.6rem] leading-tight">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default function App() {
  return (
    <KamProvider>
      <MainShell />
      <ToastContainer />
    </KamProvider>
  );
}
