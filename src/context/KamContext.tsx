import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { getMonthKey, getWeekKey } from '../lib/calendar';
import {
  ALL_STANDARD_CARD_IDS,
  buildAttendanceDocId,
  buildDmChatId,
  buildMonthlyBalanceDocId,
  computeFractionalPosition,
  getCardDefinition,
  getEffectiveStudentPosition,
  isGroupAdmin,
  isGroupPrimaryAdmin,
  validateCardAward,
} from '../lib/kamRules';
import {
  buildAttendanceDiffV3Text,
  buildAttendanceV3Text,
  computeCrossServantDiff,
  parseAttendanceReport,
  type AttendanceSessionEntry,
} from '../lib/reportFormats';
import { extractInitials, generateDailyToken, generateInviteCode, toMillis } from '../lib/arabic';
import { createLocalPreviewDataset, isPreviewAutostartEnabled } from '../lib/previewSeed';
import * as authSvc from '../services/authService';
import * as groupSvc from '../services/groupService';
import * as studentSvc from '../services/studentService';
import * as cardSvc from '../services/cardAttendanceService';
import * as chatSvc from '../services/chatService';
import { useThemeEffect } from '../hooks/useTheme';
import type {
  AttendanceRecord,
  AttendanceStatus,
  CardEvent,
  CardTypeId,
  ChildNote,
  ChildNoteType,
  CustomCardColorKey,
  CustomCardFrequency,
  Group,
  GroupInvitation,
  GroupMemberProfile,
  MonthlyBalance,
  ServantBlock,
  Student,
  UserProfile,
  VisitationStatus,
} from '../types/kam';
import type { ChatMessage, ChatMessageType, DmRoom, GroupChatMeta, NotificationCategory } from '../types/chat';

export interface ToastItem {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info' | 'warning';
}

export interface KamContextValue {
  // Auth & loading
  authLoading: boolean;
  dataLoading: boolean;
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  isPreviewMode: boolean;
  authError: authSvc.AuthErrorInfo | null;
  clearAuthError: () => void;

  // Group & domain data
  group: Group | null;
  joinedGroups: Group[];
  blocks: ServantBlock[];
  students: Student[];
  cardEvents: CardEvent[];
  monthlyBalances: MonthlyBalance[];
  attendance: AttendanceRecord[];
  childNotes: ChildNote[];
  members: GroupMemberProfile[];
  invitations: GroupInvitation[];
  chatMeta: GroupChatMeta | null;
  groupMessages: ChatMessage[];
  hasMoreGroupMessages: boolean;
  dmRooms: DmRoom[];
  avatarCache: Record<string, string>; // studentId -> packed avatarBase64

  // Period selection
  selectedWeekKey: string;
  selectedMonthKey: string;
  setSelectedWeekKey: (weekKey: string) => void;
  setSelectedMonthKey: (monthKey: string) => void;

  // Role helpers
  isAdmin: boolean;
  isPrimaryAdmin: boolean;
  getServantDisplayName: (uid: string, fallbackName?: string) => string;

  // Toast notifications
  toasts: ToastItem[];
  showToast: (message: string, tone?: ToastItem['tone']) => void;
  dismissToast: (id: string) => void;

  // Sync & Avatars
  refreshAllData: () => Promise<void>;
  ensureStudentAvatarLoaded: (studentId: string) => Promise<string>;

  // Auth actions
  signInGoogle: () => Promise<void>;
  signInGoogleRedirect: () => Promise<void>;
  signInGoogleToken: (token: string) => Promise<void>;
  enterPreviewMode: () => void;
  signOut: () => Promise<void>;
  updateProfile: (patch: Parameters<typeof authSvc.updateUserProfileFields>[1]) => Promise<void>;

  // Group actions
  createGroup: (name: string) => Promise<void>;
  joinGroup: (rawCode: string) => Promise<void>;
  switchGroup: (groupId: string) => Promise<void>;
  regenerateInviteToken: () => Promise<void>;
  updatePolicies: (patch: Parameters<typeof groupSvc.updateGroupPolicies>[1]) => Promise<void>;
  setAssistantAdmin: (targetUid: string, makeAssistant: boolean) => Promise<void>;
  banServant: (targetUid: string, targetName: string) => Promise<void>;
  unbanServant: (targetUid: string) => Promise<void>;
  leaveActiveGroup: () => Promise<void>;
  deleteActiveGroup: () => Promise<void>;
  createInvitation: (inviteeName: string) => Promise<void>;
  deleteInvitation: (invitationId: string) => Promise<void>;
  createBlock: (params: { servantId: string; servantName: string; colorHex: string }) => Promise<void>;
  updateBlock: (
    blockId: string,
    patch: Partial<Pick<ServantBlock, 'servantId' | 'servantName' | 'colorHex' | 'sortOrder'>>
  ) => Promise<void>;
  deleteBlock: (blockId: string, deleteChildren: boolean) => Promise<void>;
  saveOwnMemberProfile: (
    patch: Parameters<typeof groupSvc.upsertOwnMemberProfile>[0]['patch']
  ) => Promise<void>;

  // Student & Notes actions
  addStudent: (params: { name: string; studentNumber: number; blockId: string }) => Promise<void>;
  editStudent: (
    studentId: string,
    patch: Partial<Pick<Student, 'name' | 'studentNumber' | 'blockId' | 'sortOrder' | 'position'>>
  ) => Promise<void>;
  reorderStudent: (params: {
    studentId: string;
    prevStudent?: Student | null;
    nextStudent?: Student | null;
    targetBlockId?: string;
  }) => Promise<void>;
  removeStudent: (studentId: string) => Promise<void>;
  bulkImportStudents: (params: {
    rows: studentSvc.BulkImportParsedRow[];
    blockId: string;
    duplicateStrategy: 'SKIP' | 'UPDATE_BLOCK' | 'KEEP_BOTH';
  }) => Promise<{ added: number; updated: number; skipped: number }>;
  saveStudentAvatarList: (studentId: string, rawBase64List: string[]) => Promise<void>;
  createChildNote: (params: {
    student: Student;
    type: ChildNoteType;
    text: string;
    status?: VisitationStatus | string;
  }) => Promise<void>;
  removeChildNote: (noteId: string) => Promise<void>;

  // Cards & Attendance actions
  awardCard: (student: Student, cardType: CardTypeId, weekKeyOverride?: string) => Promise<string>;
  undoCard: (event: CardEvent) => Promise<void>;
  saveAttendance: (params: {
    student: Student;
    status: AttendanceStatus;
    weekKey: string;
    note?: string;
  }) => Promise<void>;
  removeAttendance: (weekKey: string, studentId: string) => Promise<void>;
  publishSmartAttendanceReport: (params: {
    weekKey: string;
    reportTypeKey: 'ATTENDANCE_ONLY' | CardTypeId;
    entries: AttendanceSessionEntry[];
  }) => Promise<{ outcome: 'FULL_SENT' | 'DIFF_SENT' | 'IDENTICAL_SKIPPED'; messageId?: string }>;

  // Chat & DM actions
  sendGroupChatMessage: (params: {
    type: ChatMessageType;
    text: string;
    mediaBase64?: string;
    mediaMimeType?: string;
    imageWidth?: number;
    imageHeight?: number;
    audioDurationSec?: number;
    notificationCategory?: NotificationCategory;
    childId?: string;
    childName?: string;
    childBlockName?: string;
    forwardedFromName?: string;
  }) => Promise<string>;
  updateLiveSystemReport: (messageId: string, newText: string) => Promise<void>;
  softDeleteGroupMsg: (messageId: string) => Promise<void>;
  loadOlderGroupMessages: () => Promise<void>;
  startDmWithUser: (otherUid: string, otherName: string) => Promise<string>;
  startDmByEmail: (email: string) => Promise<{ chatId: string; otherName: string }>;
  subscribeDmMessages: (
    chatId: string,
    callback: (msgs: ChatMessage[], lastDoc: QueryDocumentSnapshot<DocumentData> | null) => void
  ) => () => void;
  sendDmChatMessage: (params: {
    chatId: string;
    participants: string[];
    participantNames?: Record<string, string>;
    type: ChatMessageType;
    text: string;
    mediaBase64?: string;
    mediaMimeType?: string;
    imageWidth?: number;
    imageHeight?: number;
    audioDurationSec?: number;
    forwardedFromName?: string;
  }) => Promise<string>;
  softDeleteDmMsg: (chatId: string, messageId: string) => Promise<void>;
  loadOlderDmMessages: (
    chatId: string,
    cursorDoc: QueryDocumentSnapshot<DocumentData>
  ) => Promise<{ messages: ChatMessage[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }>;
}

const KamContext = createContext<KamContextValue | null>(null);

export const KamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [previewMode, setPreviewMode] = useState<boolean>(() => isPreviewAutostartEnabled());
  const previewInit = useMemo(() => (previewMode ? createLocalPreviewDataset() : null), [previewMode]);

  const [authLoading, setAuthLoading] = useState(!previewMode);
  const [dataLoading, setDataLoading] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(previewInit?.userProfile ?? null);
  const [authError, setAuthError] = useState<authSvc.AuthErrorInfo | null>(null);

  const [group, setGroup] = useState<Group | null>(previewInit?.group ?? null);
  const [joinedGroups, setJoinedGroups] = useState<Group[]>(previewInit?.joinedGroups ?? []);
  const [blocks, setBlocks] = useState<ServantBlock[]>(previewInit?.blocks ?? []);
  const [students, setStudents] = useState<Student[]>(previewInit?.students ?? []);
  const [cardEvents, setCardEvents] = useState<CardEvent[]>(previewInit?.cardEvents ?? []);
  const [monthlyBalances, setMonthlyBalances] = useState<MonthlyBalance[]>(
    previewInit?.monthlyBalances ?? []
  );
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(previewInit?.attendance ?? []);
  const [childNotes, setChildNotes] = useState<ChildNote[]>(previewInit?.childNotes ?? []);
  const [members, setMembers] = useState<GroupMemberProfile[]>(previewInit?.members ?? []);
  const [invitations, setInvitations] = useState<GroupInvitation[]>(previewInit?.invitations ?? []);
  const [chatMeta, setChatMeta] = useState<GroupChatMeta | null>(previewInit?.chatMeta ?? null);
  const [groupMessages, setGroupMessages] = useState<ChatMessage[]>(previewInit?.groupMessages ?? []);
  const [olderGroupMessages, setOlderGroupMessages] = useState<ChatMessage[]>([]);
  const [groupMsgCursor, setGroupMsgCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreGroupMessages, setHasMoreGroupMessages] = useState(false);
  const [dmRooms, setDmRooms] = useState<DmRoom[]>(previewInit?.dmRooms ?? []);
  const [previewDmMsgs, setPreviewDmMsgs] = useState<Record<string, ChatMessage[]>>(
    previewInit?.dmMessagesByRoom ?? {}
  );
  const [avatarCache, setAvatarCache] = useState<Record<string, string>>({});
  const loadingAvatarsRef = useRef<Set<string>>(new Set());

  const [selectedWeekKey, setSelectedWeekKeyState] = useState<string>(() => getWeekKey(new Date()));
  const [selectedMonthKey, setSelectedMonthKeyState] = useState<string>(() => getMonthKey(new Date()));

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const showToast = useCallback((message: string, tone: ToastItem['tone'] = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => {
      if (prev.some((t) => t.message === message && t.tone === tone)) {
        return prev;
      }
      return [...prev.slice(-2), { id, message, tone }];
    });
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  // Apply theme & scale globally
  useThemeEffect(userProfile?.themeId ?? 'DARK', userProfile?.uiScaleMode, userProfile?.uiScaleFactor);

  const setSelectedWeekKey = useCallback((wk: string) => {
    setSelectedWeekKeyState(wk);
    const mk = cardSvc.getMonthKeyFromWeekKey(wk);
    setSelectedMonthKeyState(mk);
  }, []);

  const setSelectedMonthKey = useCallback((mk: string) => {
    setSelectedMonthKeyState(mk);
  }, []);

  // Auth listener & Redirect result completion (real Firebase mode)
  useEffect(() => {
    if (previewMode) return;
    let active = true;
    let unsubProfile: (() => void) | null = null;
    let redirectDone = false;
    let authStateReceived = false;

    const finishLoadingIfReady = () => {
      if (active && redirectDone && authStateReceived) {
        setAuthLoading(false);
      }
    };

    authSvc
      .completeGoogleRedirectSignIn()
      .catch((err: unknown) => {
        if (!active) return;
        const info = authSvc.mapFirebaseAuthError(err);
        setAuthError(info);
      })
      .finally(() => {
        redirectDone = true;
        finishLoadingIfReady();
      });

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!user) {
        setFirebaseUser(null);
        setUserProfile(null);
        setGroup(null);
        setJoinedGroups([]);
        authStateReceived = true;
        finishLoadingIfReady();
        return;
      }

      setAuthError(null);
      setFirebaseUser(user);
      setAuthLoading(true);
      try {
        const profile = await authSvc.ensureUserProfile(user);
        if (!active) return;
        setUserProfile(profile);
        await authSvc.syncEmailDirectory(user, profile.displayName);

        unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
          if (snap.exists()) {
            setUserProfile(snap.data() as UserProfile);
          }
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'تعذر تحميل ملف المستخدم';
        showToast(msg, 'error');
      } finally {
        authStateReceived = true;
        finishLoadingIfReady();
      }
    });

    return () => {
      active = false;
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, [previewMode, showToast]);

  // Fetch joined groups summary list
  useEffect(() => {
    if (previewMode || !userProfile) return;
    const ids = Array.from(
      new Set([...(userProfile.joinedGroupIds ?? []), ...(userProfile.groupId ? [userProfile.groupId] : [])])
    ).filter(Boolean);
    if (ids.length === 0) {
      setJoinedGroups([]);
      return;
    }
    let cancelled = false;
    groupSvc.fetchJoinedGroups(ids).then((list) => {
      if (!cancelled) setJoinedGroups(list);
    });
    return () => {
      cancelled = true;
    };
  }, [previewMode, userProfile?.groupId, userProfile?.joinedGroupIds?.join(','), refreshNonce]);

  // Real-time Firestore subscriptions for active group
  const activeGroupId = userProfile?.groupId || '';

  useEffect(() => {
    if (previewMode) return;
    if (!firebaseUser || !activeGroupId) {
      setGroup(null);
      setBlocks([]);
      setStudents([]);
      setCardEvents([]);
      setMonthlyBalances([]);
      setAttendance([]);
      setChildNotes([]);
      setMembers([]);
      setInvitations([]);
      setChatMeta(null);
      setGroupMessages([]);
      setOlderGroupMessages([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setOlderGroupMessages([]);

    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'groups', activeGroupId),
        (snap) => {
          if (snap.exists()) {
            setGroup({ id: snap.id, ...snap.data() } as Group);
          } else {
            setGroup(null);
          }
          setDataLoading(false);
        },
        () => setDataLoading(false)
      )
    );

    unsubs.push(
      onSnapshot(collection(db, 'groups', activeGroupId, 'blocks'), (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as ServantBlock)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setBlocks(list);
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'groups', activeGroupId, 'students'), (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Student);
        setStudents(list);
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'groups', activeGroupId, 'cardEvents'), (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CardEvent)
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setCardEvents(list);
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'groups', activeGroupId, 'monthlyBalances'), (snap) => {
        setMonthlyBalances(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MonthlyBalance));
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'groups', activeGroupId, 'attendance'), (snap) => {
        setAttendance(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AttendanceRecord));
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'groups', activeGroupId, 'childNotes'), (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as ChildNote)
          .sort((a, b) => (b.clientCreatedAtMillis ?? toMillis(b.createdAt)) - (a.clientCreatedAtMillis ?? toMillis(a.createdAt)));
        setChildNotes(list);
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'groups', activeGroupId, 'members'), (snap) => {
        setMembers(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as GroupMemberProfile));
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'groups', activeGroupId, 'invitations'), (snap) => {
        setInvitations(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GroupInvitation));
      })
    );

    unsubs.push(
      onSnapshot(doc(db, 'groups', activeGroupId, 'chatMeta', 'main'), (snap) => {
        setChatMeta(snap.exists() ? (snap.data() as GroupChatMeta) : null);
      })
    );

    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'groups', activeGroupId, 'messages'),
          orderBy('createdAt', 'desc'),
          limit(chatSvc.CHAT_PAGE_SIZE)
        ),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage);
          setGroupMessages(list);
          setGroupMsgCursor(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null);
          setHasMoreGroupMessages(snap.docs.length === chatSvc.CHAT_PAGE_SIZE);
        }
      )
    );

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [previewMode, firebaseUser?.uid, activeGroupId, refreshNonce]);

  // DM Rooms subscription (real Firebase mode)
  useEffect(() => {
    if (previewMode || !firebaseUser) return;
    const q = query(
      collection(db, 'dms'),
      where('participants', 'array-contains', firebaseUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as DmRoom)
        .sort((a, b) => toMillis(b.lastMessageAt ?? b.updatedAt) - toMillis(a.lastMessageAt ?? a.updatedAt));
      setDmRooms(list);
    });
    return () => unsub();
  }, [previewMode, firebaseUser?.uid, refreshNonce]);

  // Online presence heartbeat every 90 seconds
  useEffect(() => {
    if (previewMode || !firebaseUser || !group || !userProfile) return;
    const sendBeat = () => {
      const exists = members.some((m) => m.uid === firebaseUser.uid);
      groupSvc
        .updateMemberHeartbeat(group, firebaseUser.uid, userProfile.displayName, userProfile.email, exists)
        .catch(() => {
          // ignore transient network errors
        });
    };
    sendBeat();
    const timer = window.setInterval(sendBeat, 90000);
    return () => window.clearInterval(timer);
  }, [previewMode, firebaseUser?.uid, group?.id, userProfile?.displayName, members.length > 0]);

  const combinedGroupMessages = useMemo(() => {
    if (olderGroupMessages.length === 0) return groupMessages;
    const seen = new Set(groupMessages.map((m) => m.id));
    const extras = olderGroupMessages.filter((m) => !seen.has(m.id));
    return [...groupMessages, ...extras];
  }, [groupMessages, olderGroupMessages]);

  const isAdmin = useMemo(
    () => isGroupAdmin(group, userProfile?.userId),
    [group, userProfile?.userId]
  );
  const isPrimaryAdmin = useMemo(
    () => isGroupPrimaryAdmin(group, userProfile?.userId),
    [group, userProfile?.userId]
  );

  const getServantDisplayName = useCallback(
    (uid: string, fallbackName?: string) => {
      const alias = userProfile?.servantAliases?.[uid]?.trim();
      if (alias) return alias;
      const member = members.find((m) => m.uid === uid);
      if (member?.displayName) return member.displayName;
      return fallbackName || 'خادم';
    },
    [userProfile?.servantAliases, members]
  );

  const refreshAllData = useCallback(async () => {
    setRefreshNonce((n) => n + 1);
    showToast('تمت مزامنة البيانات مع السحابة', 'success');
  }, [showToast]);

  const ensureStudentAvatarLoaded = useCallback(
    async (studentId: string): Promise<string> => {
      if (avatarCache[studentId] !== undefined) return avatarCache[studentId];
      const st = students.find((s) => s.id === studentId);
      if (st?.avatarBase64) {
        setAvatarCache((prev) => ({ ...prev, [studentId]: st.avatarBase64 || '' }));
        return st.avatarBase64;
      }
      if (previewMode || !group || !st?.hasAvatar) return '';
      if (loadingAvatarsRef.current.has(studentId)) return '';
      loadingAvatarsRef.current.add(studentId);
      try {
        const packed = (await studentSvc.fetchStudentAvatarPacked(group.id, studentId)) || '';
        setAvatarCache((prev) => ({ ...prev, [studentId]: packed }));
        return packed;
      } catch {
        return '';
      } finally {
        loadingAvatarsRef.current.delete(studentId);
      }
    },
    [avatarCache, students, previewMode, group]
  );

  // ---- Action Handlers ----
  const handleAuthActionError = useCallback(
    (err: unknown) => {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        showToast('تم إلغاء نافذة تسجيل الدخول.', 'info');
        return;
      }
      const info = authSvc.mapFirebaseAuthError(err);
      setAuthError(info);
    },
    [showToast]
  );

  const signInGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await authSvc.signInWithGoogle();
    } catch (err: unknown) {
      handleAuthActionError(err);
    }
  }, [handleAuthActionError]);

  const signInGoogleRedirect = useCallback(async () => {
    setAuthError(null);
    try {
      await authSvc.signInWithGoogleRedirect();
    } catch (err: unknown) {
      handleAuthActionError(err);
    }
  }, [handleAuthActionError]);

  const signInGoogleToken = useCallback(
    async (token: string) => {
      setAuthError(null);
      try {
        await authSvc.signInWithGoogleToken(token);
      } catch (err: unknown) {
        handleAuthActionError(err);
      }
    },
    [handleAuthActionError]
  );

  const enterPreviewMode = useCallback(() => {
    const dataset = createLocalPreviewDataset();
    setAuthError(null);
    setPreviewMode(true);
    setAuthLoading(false);
    setUserProfile(dataset.userProfile);
    setGroup(dataset.group);
    setJoinedGroups(dataset.joinedGroups);
    setBlocks(dataset.blocks);
    setStudents(dataset.students);
    setCardEvents(dataset.cardEvents);
    setMonthlyBalances(dataset.monthlyBalances);
    setAttendance(dataset.attendance);
    setChildNotes(dataset.childNotes);
    setMembers(dataset.members);
    setInvitations(dataset.invitations);
    setChatMeta(dataset.chatMeta);
    setGroupMessages(dataset.groupMessages);
    setDmRooms(dataset.dmRooms);
    setPreviewDmMsgs(dataset.dmMessagesByRoom);
    showToast('تم فتح التطبيق في الوضع التجريبي التفاعلي الكامل', 'success');
  }, [showToast]);

  const signOut = useCallback(async () => {
    if (previewMode) {
      setPreviewMode(false);
      setUserProfile(null);
      setGroup(null);
      setJoinedGroups([]);
      showToast('تم الخروج من الوضع التجريبي', 'info');
      return;
    }
    await authSvc.signOutUser();
  }, [previewMode, showToast]);

  const updateProfile = useCallback(
    async (patch: Parameters<typeof authSvc.updateUserProfileFields>[1]) => {
      if (!userProfile) return;
      if (previewMode) {
        setUserProfile((prev) => (prev ? { ...prev, ...patch } : prev));
        return;
      }
      await authSvc.updateUserProfileFields(userProfile.userId, patch);
    },
    [previewMode, userProfile]
  );

  const createGroup = useCallback(
    async (name: string) => {
      if (!userProfile) return;
      if (previewMode) {
        const code = generateInviteCode();
        const newG: Group = {
          id: code,
          inviteCode: code,
          name: name.trim(),
          adminId: userProfile.userId,
          adminName: userProfile.displayName,
          assistantAdminIds: [],
          memberUids: [userProfile.userId],
          allowServantUndo: true,
          enforceWeeklyCardLimit: false,
          maxMonthlyPoints: 0,
          attendanceIsCardOnly: false,
          showLeaderboard: true,
          autoStudentNumber: true,
          dailyInviteToken: generateDailyToken(),
          inviteCodeUpdatedAtMillis: Date.now(),
          customCardEnabled: false,
          customCardName: 'كارت القمداء',
          customCardPoints: 15,
          customCardIcon: '🏅',
          customCardColorKey: 'GOLD',
          customCardFrequency: 'WEEKLY',
        };
        setGroup(newG);
        setJoinedGroups((prev) => [...prev, newG]);
        setUserProfile((prev) =>
          prev
            ? { ...prev, groupId: code, joinedGroupIds: [...(prev.joinedGroupIds ?? []), code] }
            : prev
        );
        showToast(`تم إنشاء الفصل "${newG.name}"`, 'success');
        return;
      }
      const created = await groupSvc.createGroup({ name, user: userProfile });
      showToast(`تم إنشاء الفصل "${created.name}" بكود ${created.inviteCode}`, 'success');
    },
    [previewMode, userProfile, showToast]
  );

  const joinGroup = useCallback(
    async (rawCode: string) => {
      if (!userProfile) return;
      if (previewMode) {
        showToast('الانضمام عبر كود الدعوة يعمل مع حساب Firebase الحقيقي.', 'info');
        return;
      }
      const joined = await groupSvc.joinGroupByInviteCode({ rawCodeInput: rawCode, user: userProfile });
      showToast(`تم الانضمام إلى "${joined.name}" بنجاح`, 'success');
    },
    [previewMode, userProfile, showToast]
  );

  const switchGroup = useCallback(
    async (groupId: string) => {
      if (!userProfile) return;
      if (previewMode) {
        const target = joinedGroups.find((g) => g.id === groupId);
        if (target) setGroup(target);
        setUserProfile((prev) => (prev ? { ...prev, groupId } : prev));
        return;
      }
      await authSvc.updateUserProfileFields(userProfile.userId, { groupId });
      showToast('تم التبديل بين الفصول', 'success');
    },
    [previewMode, userProfile, joinedGroups, showToast]
  );

  const regenerateInviteToken = useCallback(async () => {
    if (!group) return;
    if (previewMode) {
      const tok = generateDailyToken();
      setGroup((prev) =>
        prev ? { ...prev, dailyInviteToken: tok, inviteCodeUpdatedAtMillis: Date.now() } : prev
      );
      showToast('تم تجديد كود الدعوة اليومي لمدة 24 ساعة', 'success');
      return;
    }
    await groupSvc.regenerateDailyInviteToken(group.id);
    showToast('تم تجديد كود الدعوة اليومي لمدة 24 ساعة', 'success');
  }, [previewMode, group, showToast]);

  const updatePolicies = useCallback(
    async (patch: Parameters<typeof groupSvc.updateGroupPolicies>[1]) => {
      if (!group) return;
      if (previewMode) {
        setGroup((prev) => (prev ? { ...prev, ...patch } : prev));
        showToast('تم حفظ إعدادات الفصل', 'success');
        return;
      }
      await groupSvc.updateGroupPolicies(group.id, patch);
      showToast('تم حفظ إعدادات الفصل', 'success');
    },
    [previewMode, group, showToast]
  );

  const setAssistantAdmin = useCallback(
    async (targetUid: string, makeAssistant: boolean) => {
      if (!group) return;
      if (previewMode) {
        setGroup((prev) => {
          if (!prev) return prev;
          const set = new Set(prev.assistantAdminIds ?? []);
          if (makeAssistant) set.add(targetUid);
          else set.delete(targetUid);
          return { ...prev, assistantAdminIds: Array.from(set) };
        });
        showToast(makeAssistant ? 'تم التعيين كمساعد أمين' : 'تم إلغاء صلاحية مساعد الأمين', 'success');
        return;
      }
      await groupSvc.toggleAssistantAdmin(group, targetUid, makeAssistant);
      showToast(makeAssistant ? 'تم التعيين كمساعد أمين' : 'تم إلغاء صلاحية مساعد الأمين', 'success');
    },
    [previewMode, group, showToast]
  );

  const banServant = useCallback(
    async (targetUid: string, targetName: string) => {
      if (!group) return;
      if (previewMode) {
        setGroup((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            memberUids: prev.memberUids.filter((u) => u !== targetUid),
            assistantAdminIds: (prev.assistantAdminIds ?? []).filter((u) => u !== targetUid),
            bannedUids: Array.from(new Set([...(prev.bannedUids ?? []), targetUid])),
            bannedServantEntries: [
              ...(prev.bannedServantEntries ?? []).filter((e) => !e.startsWith(`${targetUid}|`)),
              `${targetUid}|${targetName}`,
            ],
          };
        });
        showToast(`تم حظر ${targetName} من الفصل`, 'warning');
        return;
      }
      await groupSvc.banServantFromGroup(group, targetUid, targetName);
      showToast(`تم حظر ${targetName} من الفصل`, 'warning');
    },
    [previewMode, group, showToast]
  );

  const unbanServant = useCallback(
    async (targetUid: string) => {
      if (!group) return;
      if (previewMode) {
        setGroup((prev) =>
          prev
            ? {
                ...prev,
                bannedUids: (prev.bannedUids ?? []).filter((u) => u !== targetUid),
                bannedServantEntries: (prev.bannedServantEntries ?? []).filter(
                  (e) => !e.startsWith(`${targetUid}|`)
                ),
              }
            : prev
        );
        showToast('تم فك الحظر عن الخادم', 'success');
        return;
      }
      await groupSvc.unbanServantFromGroup(group, targetUid);
      showToast('تم فك الحظر عن الخادم', 'success');
    },
    [previewMode, group, showToast]
  );

  const leaveActiveGroup = useCallback(async () => {
    if (!group || !userProfile) return;
    if (previewMode) {
      showToast('لا يمكن للأمين الأساسي مغادرة الفصل', 'warning');
      return;
    }
    await groupSvc.leaveGroup(group, userProfile);
    showToast('تمت مغادرة الفصل', 'info');
  }, [previewMode, group, userProfile, showToast]);

  const deleteActiveGroup = useCallback(async () => {
    if (!group || !userProfile) return;
    if (previewMode) {
      showToast('تم إلغاء حذف الفصل في وضع المعاينة', 'info');
      return;
    }
    await groupSvc.deleteGroupCompletely(group.id, userProfile);
    showToast('تم حذف الفصل بالكامل', 'warning');
  }, [previewMode, group, userProfile, showToast]);

  const createInvitation = useCallback(
    async (inviteeName: string) => {
      if (!group) return;
      if (previewMode) {
        setInvitations((prev) => [
          {
            id: `inv_${Date.now()}`,
            groupId: group.id,
            groupName: group.name,
            adminId: group.adminId,
            inviteeName: inviteeName.trim(),
            inviteCode: group.id,
            status: 'PENDING',
            acceptedByUid: '',
            createdAt: Date.now(),
          },
          ...prev,
        ]);
        showToast('تم إنشاء الدعوة بنجاح', 'success');
        return;
      }
      await groupSvc.createInvitation({ group, inviteeName });
      showToast('تم إنشاء الدعوة بنجاح', 'success');
    },
    [previewMode, group, showToast]
  );

  const deleteInvitation = useCallback(
    async (invitationId: string) => {
      if (!group) return;
      if (previewMode) {
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
        return;
      }
      await groupSvc.deleteInvitation(group.id, invitationId);
    },
    [previewMode, group]
  );

  const createBlock = useCallback(
    async (params: { servantId: string; servantName: string; colorHex: string }) => {
      if (!group) return;
      const nextSort = blocks.reduce((acc, b) => Math.max(acc, b.sortOrder), 0) + 1;
      if (previewMode) {
        setBlocks((prev) => [
          ...prev,
          {
            id: `blk_${Date.now()}`,
            groupId: group.id,
            servantId: params.servantId,
            servantName: params.servantName.trim(),
            colorHex: params.colorHex,
            sortOrder: nextSort,
            memberUids: group.memberUids,
          },
        ]);
        showToast('تم إنشاء البلوك بنجاح', 'success');
        return;
      }
      await groupSvc.createServantBlock({
        group,
        servantId: params.servantId,
        servantName: params.servantName,
        colorHex: params.colorHex,
        sortOrder: nextSort,
      });
      showToast('تم إنشاء البلوك بنجاح', 'success');
    },
    [previewMode, group, blocks, showToast]
  );

  const updateBlock = useCallback(
    async (
      blockId: string,
      patch: Partial<Pick<ServantBlock, 'servantId' | 'servantName' | 'colorHex' | 'sortOrder'>>
    ) => {
      if (!group) return;
      if (previewMode) {
        setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, ...patch } : b)));
        showToast('تم تحديث البلوك', 'success');
        return;
      }
      await groupSvc.updateServantBlock({ groupId: group.id, blockId, isAdmin, patch });
      showToast('تم تحديث البلوك', 'success');
    },
    [previewMode, group, isAdmin, showToast]
  );

  const deleteBlock = useCallback(
    async (blockId: string, deleteChildren: boolean) => {
      if (!group) return;
      const inBlock = students.filter((s) => s.blockId === blockId);
      if (previewMode) {
        setBlocks((prev) => prev.filter((b) => b.id !== blockId));
        if (deleteChildren) {
          setStudents((prev) => prev.filter((s) => s.blockId !== blockId));
        } else {
          setStudents((prev) =>
            prev.map((s) => (s.blockId === blockId ? { ...s, blockId: '' } : s))
          );
        }
        showToast('تم حذف البلوك', 'info');
        return;
      }
      await groupSvc.deleteServantBlock({
        groupId: group.id,
        blockId,
        studentsInBlock: inBlock,
        deleteChildren,
      });
      showToast('تم حذف البلوك', 'info');
    },
    [previewMode, group, students, showToast]
  );

  const saveOwnMemberProfile = useCallback(
    async (patch: Parameters<typeof groupSvc.upsertOwnMemberProfile>[0]['patch']) => {
      if (!group || !userProfile) return;
      const existing = members.find((m) => m.uid === userProfile.userId);
      if (previewMode) {
        setMembers((prev) =>
          prev.map((m) =>
            m.uid === userProfile.userId ? { ...m, ...patch, phoneVerified: false } : m
          )
        );
        if (patch.displayName) {
          setUserProfile((prev) => (prev ? { ...prev, displayName: patch.displayName! } : prev));
        }
        showToast('تم تحديث بيانات ملفك الشخصي', 'success');
        return;
      }
      await groupSvc.upsertOwnMemberProfile({
        group,
        uid: userProfile.userId,
        existing,
        patch,
      });
      if (patch.displayName && patch.displayName !== userProfile.displayName) {
        await authSvc.updateUserProfileFields(userProfile.userId, { displayName: patch.displayName });
      }
      showToast('تم تحديث بيانات ملفك الشخصي', 'success');
    },
    [previewMode, group, userProfile, members, showToast]
  );

  const addStudent = useCallback(
    async (params: { name: string; studentNumber: number; blockId: string }) => {
      if (!group || !userProfile) return;
      if (previewMode) {
        const nextSort = students.reduce((a, s) => Math.max(a, s.sortOrder), 0) + 1;
        const newStudent: Student = {
          id: `st_${Date.now()}`,
          groupId: group.id,
          name: params.name.trim(),
          studentNumber: params.studentNumber,
          blockId: params.blockId,
          sortOrder: nextSort,
          position: nextSort * 1000 + params.studentNumber,
          avatarInitials: extractInitials(params.name),
          createdByUid: userProfile.userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setStudents((prev) => [...prev, newStudent]);
        showToast(`تمت إضافة "${newStudent.name}"`, 'success');
        return;
      }
      await studentSvc.createStudent({
        group,
        name: params.name,
        studentNumber: params.studentNumber,
        blockId: params.blockId,
        createdByUid: userProfile.userId,
        existingStudents: students,
      });
      showToast(`تمت إضافة "${params.name.trim()}"`, 'success');
    },
    [previewMode, group, userProfile, students, showToast]
  );

  const editStudent = useCallback(
    async (
      studentId: string,
      patch: Partial<Pick<Student, 'name' | 'studentNumber' | 'blockId' | 'sortOrder' | 'position'>>
    ) => {
      if (!group) return;
      if (previewMode) {
        setStudents((prev) =>
          prev.map((s) =>
            s.id === studentId
              ? {
                  ...s,
                  ...patch,
                  avatarInitials: patch.name ? extractInitials(patch.name) : s.avatarInitials,
                }
              : s
          )
        );
        showToast('تم حفظ تعديلات الطفل', 'success');
        return;
      }
      await studentSvc.updateStudent({ groupId: group.id, studentId, patch });
      showToast('تم حفظ تعديلات الطفل', 'success');
    },
    [previewMode, group, showToast]
  );

  const reorderStudent = useCallback(
    async (params: {
      studentId: string;
      prevStudent?: Student | null;
      nextStudent?: Student | null;
      targetBlockId?: string;
    }) => {
      if (!group) return;
      if (previewMode) {
        const prevPos = params.prevStudent ? getEffectiveStudentPosition(params.prevStudent) : null;
        const nextPos = params.nextStudent ? getEffectiveStudentPosition(params.nextStudent) : null;
        const pos = computeFractionalPosition(prevPos, nextPos);
        setStudents((prev) =>
          prev.map((s) =>
            s.id === params.studentId
              ? { ...s, position: pos, ...(params.targetBlockId !== undefined ? { blockId: params.targetBlockId } : {}) }
              : s
          )
        );
        return;
      }
      await studentSvc.reorderStudentFractionally({
        groupId: group.id,
        ...params,
      });
    },
    [previewMode, group]
  );

  const removeStudent = useCallback(
    async (studentId: string) => {
      if (!group) return;
      if (previewMode) {
        setStudents((prev) => prev.filter((s) => s.id !== studentId));
        showToast('تم حذف الطفل', 'info');
        return;
      }
      await studentSvc.deleteStudent(group.id, studentId);
      showToast('تم حذف الطفل', 'info');
    },
    [previewMode, group, showToast]
  );

  const bulkImportStudents = useCallback(
    async (params: {
      rows: studentSvc.BulkImportParsedRow[];
      blockId: string;
      duplicateStrategy: 'SKIP' | 'UPDATE_BLOCK' | 'KEEP_BOTH';
    }) => {
      if (!group || !userProfile) return { added: 0, updated: 0, skipped: 0 };
      if (previewMode) {
        let nextNum = studentSvc.getNextStudentNumber(students);
        let nextSort = students.reduce((acc, s) => Math.max(acc, s.sortOrder), 0) + 1;
        let added = 0;
        let updated = 0;
        let skipped = 0;
        const addedList: Student[] = [];
        const updatedMap = new Map<string, string>();

        for (const row of params.rows) {
          if (row.duplicateOf) {
            if (params.duplicateStrategy === 'SKIP') {
              skipped += 1;
              continue;
            }
            if (params.duplicateStrategy === 'UPDATE_BLOCK') {
              updatedMap.set(row.duplicateOf.id, params.blockId);
              updated += 1;
              continue;
            }
          }
          const num = row.explicitNumber ?? nextNum++;
          const sortOrder = nextSort++;
          addedList.push({
            id: `st_${Date.now()}_${added}`,
            groupId: group.id,
            name: row.name,
            studentNumber: num,
            blockId: params.blockId,
            sortOrder,
            position: sortOrder * 1000 + num,
            avatarInitials: extractInitials(row.name),
            createdByUid: userProfile.userId,
          });
          added += 1;
        }

        setStudents((prev) => [
          ...prev.map((s) => (updatedMap.has(s.id) ? { ...s, blockId: updatedMap.get(s.id)! } : s)),
          ...addedList,
        ]);
        showToast(`تم استيراد ${added} طفل (تحديث: ${updated}، تخطي: ${skipped})`, 'success');
        return { added, updated, skipped };
      }

      const res = await studentSvc.executeBulkImport({
        group,
        rows: params.rows,
        blockId: params.blockId,
        createdByUid: userProfile.userId,
        existingStudents: students,
        duplicateStrategy: params.duplicateStrategy,
      });
      showToast(`تم استيراد ${res.added} طفل (تحديث: ${res.updated}، تخطي: ${res.skipped})`, 'success');
      return res;
    },
    [previewMode, group, userProfile, students, showToast]
  );

  const saveStudentAvatarList = useCallback(
    async (studentId: string, rawBase64List: string[]) => {
      if (!group || !userProfile) return;
      if (previewMode) {
        const packed = rawBase64List.join('|||');
        setAvatarCache((prev) => ({ ...prev, [studentId]: packed }));
        setStudents((prev) =>
          prev.map((s) => (s.id === studentId ? { ...s, hasAvatar: Boolean(packed) } : s))
        );
        showToast('تم حفظ صور الطفل', 'success');
        return;
      }
      const { packed } = await studentSvc.saveStudentAvatars({
        group,
        studentId,
        rawBase64List,
        updatedByUid: userProfile.userId,
      });
      setAvatarCache((prev) => ({ ...prev, [studentId]: packed }));
      showToast('تم حفظ صور الطفل', 'success');
    },
    [previewMode, group, userProfile, showToast]
  );

  const createChildNote = useCallback(
    async (params: {
      student: Student;
      type: ChildNoteType;
      text: string;
      status?: VisitationStatus | string;
    }) => {
      if (!group || !userProfile) return;
      if (previewMode) {
        const now = Date.now();
        const note: ChildNote = {
          id: `note_${now}_${Math.random().toString(36).slice(2, 5)}`,
          groupId: group.id,
          studentId: params.student.id,
          studentName: params.student.name,
          type: params.type,
          text: params.text.trim(),
          status: params.status,
          authorUid: userProfile.userId,
          authorName: userProfile.displayName,
          clientCreatedAtMillis: now,
          createdAt: now,
        };
        setChildNotes((prev) => [note, ...prev]);
        if (params.type === 'MEMORIZATION') {
          setStudents((prev) =>
            prev.map((s) =>
              s.id === params.student.id
                ? {
                    ...s,
                    lastMemorizedText: note.text,
                    lastMemorizedBy: userProfile.displayName,
                    lastMemorizedAtMillis: now,
                  }
                : s
            )
          );
        }
        return;
      }
      await studentSvc.addChildNote({
        group,
        student: params.student,
        type: params.type,
        text: params.text,
        status: params.status,
        authorUid: userProfile.userId,
        authorName: userProfile.displayName,
      });
    },
    [previewMode, group, userProfile]
  );

  const removeChildNote = useCallback(
    async (noteId: string) => {
      if (!group) return;
      if (previewMode) {
        setChildNotes((prev) => prev.filter((n) => n.id !== noteId));
        return;
      }
      await studentSvc.deleteChildNote(group.id, noteId);
    },
    [previewMode, group]
  );

  const awardCard = useCallback(
    async (student: Student, cardType: CardTypeId, weekKeyOverride?: string): Promise<string> => {
      if (!group || !userProfile) throw new Error('لا يوجد فصل نشط');
      const wk = weekKeyOverride ?? selectedWeekKey;
      const mk = cardSvc.getMonthKeyFromWeekKey(wk);
      const balanceId = buildMonthlyBalanceDocId(mk, student.id);
      const currentMonthPoints =
        monthlyBalances.find((b) => b.id === balanceId)?.totalPoints ?? 0;

      if (previewMode) {
        const def = getCardDefinition(cardType, group);
        const check = validateCardAward({
          group,
          studentId: student.id,
          cardType,
          points: def.points,
          weekKey: wk,
          monthKey: mk,
          existingEvents: cardEvents,
          currentMonthPoints,
        });
        if (!check.allowed) throw new Error(check.reasonAr || 'غير مسموح');

        const evId = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        const newEv: CardEvent = {
          id: evId,
          groupId: group.id,
          studentId: student.id,
          studentName: student.name,
          cardType,
          points: def.points,
          servantId: userProfile.userId,
          servantName: userProfile.displayName,
          monthKey: mk,
          weekKey: wk,
          createdAt: Date.now(),
        };
        setCardEvents((prev) => [newEv, ...prev]);
        setMonthlyBalances((prev) => {
          const exists = prev.find((b) => b.id === balanceId);
          if (exists) {
            return prev.map((b) =>
              b.id === balanceId
                ? { ...b, totalPoints: b.totalPoints + def.points, eventsCount: b.eventsCount + 1 }
                : b
            );
          }
          return [
            ...prev,
            {
              id: balanceId,
              groupId: group.id,
              studentId: student.id,
              studentName: student.name,
              monthKey: mk,
              totalPoints: def.points,
              eventsCount: 1,
              lastUpdatedByUid: userProfile.userId,
            },
          ];
        });
        return evId;
      }

      return cardSvc.awardCardToStudent({
        group,
        student,
        cardType,
        servantId: userProfile.userId,
        servantName: userProfile.displayName,
        weekKey: wk,
        monthKey: mk,
        existingEvents: cardEvents,
        currentMonthPoints,
      });
    },
    [previewMode, group, userProfile, selectedWeekKey, monthlyBalances, cardEvents]
  );

  const undoCard = useCallback(
    async (event: CardEvent) => {
      if (!group || !userProfile) return;
      if (previewMode) {
        const balanceId = buildMonthlyBalanceDocId(event.monthKey, event.studentId);
        setCardEvents((prev) => prev.filter((e) => e.id !== event.id));
        setMonthlyBalances((prev) =>
          prev.map((b) =>
            b.id === balanceId
              ? {
                  ...b,
                  totalPoints: Math.max(0, b.totalPoints - event.points),
                  eventsCount: Math.max(0, b.eventsCount - 1),
                }
              : b
          )
        );
        return;
      }
      await cardSvc.undoCardEvent({ group, event, actorUid: userProfile.userId });
    },
    [previewMode, group, userProfile]
  );

  const saveAttendance = useCallback(
    async (params: {
      student: Student;
      status: AttendanceStatus;
      weekKey: string;
      note?: string;
    }) => {
      if (!group || !userProfile) return;
      if (previewMode) {
        const id = buildAttendanceDocId(params.weekKey, params.student.id);
        const rec: AttendanceRecord = {
          id,
          groupId: group.id,
          studentId: params.student.id,
          studentName: params.student.name,
          status: params.status,
          weekKey: params.weekKey,
          servantId: userProfile.userId,
          servantName: userProfile.displayName,
          note: params.note || '',
          memberUids: group.memberUids,
          createdAt: Date.now(),
        };
        setAttendance((prev) => {
          const rest = prev.filter((a) => a.id !== id);
          return [...rest, rec];
        });
        return;
      }
      await cardSvc.saveWeeklyAttendanceRecord({
        group,
        student: params.student,
        status: params.status,
        weekKey: params.weekKey,
        servantId: userProfile.userId,
        servantName: userProfile.displayName,
        note: params.note,
      });
    },
    [previewMode, group, userProfile]
  );

  const removeAttendance = useCallback(
    async (weekKey: string, studentId: string) => {
      if (!group) return;
      if (previewMode) {
        const id = buildAttendanceDocId(weekKey, studentId);
        setAttendance((prev) => prev.filter((a) => a.id !== id));
        return;
      }
      await cardSvc.deleteWeeklyAttendanceRecord(group.id, weekKey, studentId);
    },
    [previewMode, group]
  );

  const sendGroupChatMessage = useCallback(
    async (params: {
      type: ChatMessageType;
      text: string;
      mediaBase64?: string;
      mediaMimeType?: string;
      imageWidth?: number;
      imageHeight?: number;
      audioDurationSec?: number;
      notificationCategory?: NotificationCategory;
      childId?: string;
      childName?: string;
      childBlockName?: string;
      forwardedFromName?: string;
    }): Promise<string> => {
      if (!group || !userProfile) throw new Error('لا يوجد فصل نشط');
      if (previewMode) {
        const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        const newMsg: ChatMessage = {
          id,
          chatId: group.id,
          groupId: group.id,
          senderUid: userProfile.userId,
          senderName: userProfile.displayName,
          type: params.type,
          text: params.text,
          mediaBase64: params.mediaBase64,
          mediaMimeType: params.mediaMimeType,
          imageWidth: params.imageWidth,
          imageHeight: params.imageHeight,
          audioDurationSec: params.audioDurationSec,
          notificationCategory: params.notificationCategory,
          childId: params.childId,
          childName: params.childName,
          childBlockName: params.childBlockName,
          forwardedFromName: params.forwardedFromName,
          isDeleted: false,
          memberUids: group.memberUids,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setGroupMessages((prev) => [newMsg, ...prev]);
        setChatMeta((prev) => ({
          groupId: group.id,
          memberUids: group.memberUids,
          lastMessageId: id,
          lastMessageText: params.type === 'IMAGE' ? '📷 صورة' : params.type === 'AUDIO' ? '🎤 رسالة صوتية' : params.text.slice(0, 100),
          lastMessageType: params.type,
          lastMessageSenderUid: userProfile.userId,
          lastMessageSenderName: userProfile.displayName,
          lastMessageAt: Date.now(),
          totalMessagesCount: (prev?.totalMessagesCount ?? 0) + 1,
          updatedAt: Date.now(),
        }));
        return id;
      }

      return chatSvc.sendGroupMessage({
        group,
        senderUid: userProfile.userId,
        senderName: userProfile.displayName,
        ...params,
      });
    },
    [previewMode, group, userProfile]
  );

  const publishSmartAttendanceReport = useCallback(
    async (params: {
      weekKey: string;
      reportTypeKey: 'ATTENDANCE_ONLY' | CardTypeId;
      entries: AttendanceSessionEntry[];
    }) => {
      if (!group || !userProfile) throw new Error('لا يوجد فصل نشط');
      if (previewMode) {
        // Check baseline from another servant in preview groupMessages
        const baseline = combinedGroupMessages
          .filter((m) => m.type === 'SYSTEM' && !m.isDeleted && m.senderUid !== userProfile.userId)
          .map((m) => ({ msg: m, parsed: parseAttendanceReport(m.text) }))
          .find(
            (x) =>
              x.parsed &&
              !x.parsed.diffAgainstServant &&
              x.parsed.reportTypeKey === params.reportTypeKey
          );

        if (baseline && baseline.parsed) {
          const diffs = computeCrossServantDiff({
            baselineReport: baseline.parsed,
            secondEntries: params.entries,
          });
          if (diffs.length === 0) {
            return { outcome: 'IDENTICAL_SKIPPED' as const };
          }
          const diffText = buildAttendanceDiffV3Text({
            servantName: userProfile.displayName,
            firstServantName: baseline.parsed.servantName || baseline.msg.senderName,
            reportTypeKey: params.reportTypeKey,
            diffs,
            group,
          });
          const messageId = await sendGroupChatMessage({
            type: 'SYSTEM',
            text: diffText,
            notificationCategory: 'CONFLICT',
          });
          return { outcome: 'DIFF_SENT' as const, messageId };
        }

        const fullText = buildAttendanceV3Text({
          servantName: userProfile.displayName,
          reportTypeKey: params.reportTypeKey,
          entries: params.entries,
          group,
        });
        const messageId = await sendGroupChatMessage({
          type: 'SYSTEM',
          text: fullText,
          notificationCategory: params.reportTypeKey === 'ATTENDANCE_ONLY' ? 'SYSTEM' : 'CARD',
        });
        return { outcome: 'FULL_SENT' as const, messageId };
      }

      return cardSvc.sendSmartAttendanceReportWithDiff({
        group,
        servantUid: userProfile.userId,
        servantName: userProfile.displayName,
        ...params,
      });
    },
    [previewMode, group, userProfile, combinedGroupMessages, sendGroupChatMessage]
  );

  const updateLiveSystemReport = useCallback(
    async (messageId: string, newText: string) => {
      if (!group) return;
      if (previewMode) {
        setGroupMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, text: newText, updatedAt: Date.now() } : m))
        );
        return;
      }
      await chatSvc.updateLiveSystemReportMessage(group.id, messageId, newText);
    },
    [previewMode, group]
  );

  const softDeleteGroupMsg = useCallback(
    async (messageId: string) => {
      if (!group) return;
      if (previewMode) {
        setGroupMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, isDeleted: true, text: 'تم حذف الرسالة', mediaBase64: '' }
              : m
          )
        );
        return;
      }
      await chatSvc.softDeleteGroupMessage(group.id, messageId);
    },
    [previewMode, group]
  );

  const loadOlderGroupMessages = useCallback(async () => {
    if (previewMode || !group || !groupMsgCursor) return;
    const { messages, lastDoc } = await chatSvc.fetchOlderGroupMessages(group.id, groupMsgCursor);
    setOlderGroupMessages((prev) => [...prev, ...messages]);
    setGroupMsgCursor(lastDoc);
    setHasMoreGroupMessages(messages.length === chatSvc.CHAT_PAGE_SIZE);
  }, [previewMode, group, groupMsgCursor]);

  const startDmWithUser = useCallback(
    async (otherUid: string, otherName: string): Promise<string> => {
      if (!userProfile) throw new Error('يجب تسجيل الدخول أولاً');
      if (otherUid === userProfile.userId) throw new Error('لا يمكنك بدء محادثة خاصة مع نفسك.');
      const chatId = buildDmChatId(userProfile.userId, otherUid);
      if (previewMode) {
        setDmRooms((prev) => {
          if (prev.some((r) => r.id === chatId)) return prev;
          return [
            {
              id: chatId,
              chatId,
              groupId: group?.id,
              participants: [userProfile.userId, otherUid].sort(),
              participantNames: {
                [userProfile.userId]: userProfile.displayName,
                [otherUid]: otherName,
              },
              totalMessagesCount: 0,
              updatedAt: Date.now(),
            },
            ...prev,
          ];
        });
        return chatId;
      }
      return chatSvc.ensureDmRoom({
        currentUid: userProfile.userId,
        currentName: userProfile.displayName,
        otherUid,
        otherName,
        groupId: group?.id,
      });
    },
    [previewMode, userProfile, group?.id]
  );

  const startDmByEmail = useCallback(
    async (email: string): Promise<{ chatId: string; otherName: string }> => {
      if (!userProfile) throw new Error('يجب تسجيل الدخول أولاً');
      if (previewMode) {
        const match = members.find(
          (m) => m.email?.toLowerCase() === email.trim().toLowerCase()
        );
        if (!match) throw new Error('لم يتم العثور على مستخدم مسجل بهذا البريد الإلكتروني.');
        const chatId = await startDmWithUser(match.uid, match.displayName);
        return { chatId, otherName: match.displayName };
      }
      const entry = await authSvc.lookupUserByEmail(email);
      if (!entry) {
        throw new Error('لم يتم العثور على خادم مسجل بهذا البريد الإلكتروني.');
      }
      if (entry.uid === userProfile.userId) {
        throw new Error('هذا هو بريدك الإلكتروني الشخصي.');
      }
      const chatId = await startDmWithUser(entry.uid, entry.displayName);
      return { chatId, otherName: entry.displayName };
    },
    [previewMode, userProfile, members, startDmWithUser]
  );

  const subscribeDmMessages = useCallback(
    (
      chatId: string,
      callback: (msgs: ChatMessage[], lastDoc: QueryDocumentSnapshot<DocumentData> | null) => void
    ) => {
      if (previewMode) {
        callback(previewDmMsgs[chatId] ?? [], null);
        return () => {};
      }
      const q = query(
        collection(db, 'dms', chatId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(chatSvc.CHAT_PAGE_SIZE)
      );
      return onSnapshot(q, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage);
        const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
        callback(list, lastDoc);
      });
    },
    [previewMode, previewDmMsgs]
  );

  const sendDmChatMessage = useCallback(
    async (params: {
      chatId: string;
      participants: string[];
      participantNames?: Record<string, string>;
      type: ChatMessageType;
      text: string;
      mediaBase64?: string;
      mediaMimeType?: string;
      imageWidth?: number;
      imageHeight?: number;
      audioDurationSec?: number;
      forwardedFromName?: string;
    }): Promise<string> => {
      if (!userProfile) throw new Error('يجب تسجيل الدخول أولاً');
      if (previewMode) {
        const id = `dm_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        const msg: ChatMessage = {
          id,
          chatId: params.chatId,
          groupId: group?.id,
          senderUid: userProfile.userId,
          senderName: userProfile.displayName,
          type: params.type,
          text: params.text,
          mediaBase64: params.mediaBase64,
          mediaMimeType: params.mediaMimeType,
          imageWidth: params.imageWidth,
          imageHeight: params.imageHeight,
          audioDurationSec: params.audioDurationSec,
          forwardedFromName: params.forwardedFromName,
          isDeleted: false,
          participants: params.participants,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setPreviewDmMsgs((prev) => ({
          ...prev,
          [params.chatId]: [msg, ...(prev[params.chatId] ?? [])],
        }));
        setDmRooms((prev) =>
          prev.map((r) =>
            r.id === params.chatId
              ? {
                  ...r,
                  lastMessageText: params.text.slice(0, 120),
                  lastMessageType: params.type,
                  lastMessageAt: Date.now(),
                  totalMessagesCount: (r.totalMessagesCount ?? 0) + 1,
                }
              : r
          )
        );
        return id;
      }

      return chatSvc.sendDmMessage({
        ...params,
        groupId: group?.id,
        senderUid: userProfile.userId,
        senderName: userProfile.displayName,
      });
    },
    [previewMode, userProfile, group?.id]
  );

  const softDeleteDmMsg = useCallback(
    async (chatId: string, messageId: string) => {
      if (previewMode) {
        setPreviewDmMsgs((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] ?? []).map((m) =>
            m.id === messageId
              ? { ...m, isDeleted: true, text: 'تم حذف الرسالة', mediaBase64: '' }
              : m
          ),
        }));
        return;
      }
      await chatSvc.softDeleteDmMessage(chatId, messageId);
    },
    [previewMode]
  );

  const loadOlderDmMessages = useCallback(
    async (chatId: string, cursorDoc: QueryDocumentSnapshot<DocumentData>) => {
      if (previewMode) return { messages: [], lastDoc: null };
      return chatSvc.fetchOlderDmMessages(chatId, cursorDoc);
    },
    [previewMode]
  );

  const value: KamContextValue = {
    authLoading,
    dataLoading,
    firebaseUser,
    userProfile,
    isPreviewMode: previewMode,
    authError,
    clearAuthError,
    group,
    joinedGroups,
    blocks,
    students,
    cardEvents,
    monthlyBalances,
    attendance,
    childNotes,
    members,
    invitations,
    chatMeta,
    groupMessages: combinedGroupMessages,
    hasMoreGroupMessages,
    dmRooms,
    avatarCache,
    selectedWeekKey,
    selectedMonthKey,
    setSelectedWeekKey,
    setSelectedMonthKey,
    isAdmin,
    isPrimaryAdmin,
    getServantDisplayName,
    toasts,
    showToast,
    dismissToast,
    refreshAllData,
    ensureStudentAvatarLoaded,
    signInGoogle,
    signInGoogleRedirect,
    signInGoogleToken,
    enterPreviewMode,
    signOut,
    updateProfile,
    createGroup,
    joinGroup,
    switchGroup,
    regenerateInviteToken,
    updatePolicies,
    setAssistantAdmin,
    banServant,
    unbanServant,
    leaveActiveGroup,
    deleteActiveGroup,
    createInvitation,
    deleteInvitation,
    createBlock,
    updateBlock,
    deleteBlock,
    saveOwnMemberProfile,
    addStudent,
    editStudent,
    reorderStudent,
    removeStudent,
    bulkImportStudents,
    saveStudentAvatarList,
    createChildNote,
    removeChildNote,
    awardCard,
    undoCard,
    saveAttendance,
    removeAttendance,
    publishSmartAttendanceReport,
    sendGroupChatMessage,
    updateLiveSystemReport,
    softDeleteGroupMsg,
    loadOlderGroupMessages,
    startDmWithUser,
    startDmByEmail,
    subscribeDmMessages,
    sendDmChatMessage,
    softDeleteDmMsg,
    loadOlderDmMessages,
  };

  return <KamContext.Provider value={value}>{children}</KamContext.Provider>;
};

export function useKam(): KamContextValue {
  const ctx = useContext(KamContext);
  if (!ctx) throw new Error('useKam must be used inside KamProvider');
  return ctx;
}
