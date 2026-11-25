import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { ALL_STANDARD_CARD_IDS } from '../lib/kamRules';
import { buildEmailDirectoryKey } from '../lib/media';
import type { EmailDirectoryEntry, UserProfile } from '../types/kam';

const PENDING_REDIRECT_KEY = 'kam_pending_google_redirect';
let redirectCheckPromise: Promise<User | null> | null = null;
let activePopupPromise: Promise<User | null> | null = null;

export interface AuthErrorInfo {
  code: string;
  messageAr: string;
  isUnauthorizedDomain: boolean;
  isPopupBlocked: boolean;
  isMissingInitialState: boolean;
}

export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function readPendingRedirectFlag(): boolean {
  try {
    return window.sessionStorage.getItem(PENDING_REDIRECT_KEY) === '1';
  } catch {
    return false;
  }
}

function writePendingRedirectFlag(pending: boolean): void {
  try {
    if (pending) {
      window.sessionStorage.setItem(PENDING_REDIRECT_KEY, '1');
    } else {
      window.sessionStorage.removeItem(PENDING_REDIRECT_KEY);
    }
  } catch {
    // Ignore storage errors in restricted WebViews
  }
}

export function mapFirebaseAuthError(err: unknown): AuthErrorInfo {
  const code = (err as { code?: string })?.code ?? 'auth/unknown';
  const rawMessage = err instanceof Error ? err.message : '';

  if (code === 'auth/unauthorized-domain') {
    return {
      code,
      messageAr:
        'تعذر التحقق من رابط الدخول الحالي. يرجى فتح التطبيق من الرابط الرسمي أو التواصل مع مسؤول الخدمة.',
      isUnauthorizedDomain: true,
      isPopupBlocked: false,
      isMissingInitialState: false,
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      code,
      messageAr:
        'المتصفح حظر نافذة تسجيل الدخول. اسمح بالنوافذ المنبثقة أو استخدم خيار «تسجيل الدخول بطريقة بديلة للموبايل» بالأسفل.',
      isUnauthorizedDomain: false,
      isPopupBlocked: true,
      isMissingInitialState: false,
    };
  }

  if (code === 'auth/operation-not-allowed') {
    return {
      code,
      messageAr: 'خدمة الدخول بحساب Google غير مفعّلة حالياً. يرجى المحاولة لاحقاً.',
      isUnauthorizedDomain: false,
      isPopupBlocked: false,
      isMissingInitialState: false,
    };
  }

  if (code === 'auth/missing-initial-state' || code === 'auth/web-storage-unsupported') {
    return {
      code,
      messageAr:
        'متصفح الموبايل منع حفظ جلسة إعادة التوجيه (الكوكيز أو التخزين المؤقت محظور). جرّب الزر الأساسي أو افتح الرابط في متصفح Chrome.',
      isUnauthorizedDomain: false,
      isPopupBlocked: false,
      isMissingInitialState: true,
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      code,
      messageAr: 'تعذر الاتصال بخوادم Google. تأكد من اتصالك بالإنترنت ثم حاول مجدداً.',
      isUnauthorizedDomain: false,
      isPopupBlocked: false,
      isMissingInitialState: false,
    };
  }

  if (code === 'auth/iframe-redirect-unsupported') {
    return {
      code,
      messageAr:
        'خيار إعادة التوجيه لا يعمل داخل إطار معاينة مضمّن. افتح رابط التطبيق مباشرة في المتصفح أو استخدم زر الدخول الأساسي.',
      isUnauthorizedDomain: false,
      isPopupBlocked: false,
      isMissingInitialState: false,
    };
  }

  if (rawMessage.includes('INTERNAL ASSERTION FAILED') || code === 'auth/internal-error') {
    return {
      code: code === 'auth/unknown' ? 'auth/internal-error' : code,
      messageAr:
        'تعذر فتح نافذة تسجيل الدخول داخل هذا المتصفح أو الإطار. أعد المحاولة أو افتح رابط المشاركة مباشرة في متصفح Chrome.',
      isUnauthorizedDomain: false,
      isPopupBlocked: false,
      isMissingInitialState: false,
    };
  }

  return {
    code,
    messageAr: rawMessage || 'تعذر تسجيل الدخول بـ Google. حاول مرة أخرى.',
    isUnauthorizedDomain: false,
    isPopupBlocked: false,
    isMissingInitialState: false,
  };
}

export function completeGoogleRedirectSignIn(): Promise<User | null> {
  if (typeof window === 'undefined' || isRunningInIframe() || !readPendingRedirectFlag()) {
    return Promise.resolve(null);
  }
  if (!redirectCheckPromise) {
    redirectCheckPromise = (async () => {
      try {
        await auth.authStateReady();
        const result = await getRedirectResult(auth);
        return result?.user ?? null;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('Pending promise was never set')) {
          return null;
        }
        throw err;
      } finally {
        writePendingRedirectFlag(false);
      }
    })();
  }
  return redirectCheckPromise;
}

export async function signInWithGoogle(): Promise<User | null> {
  if (activePopupPromise) {
    return activePopupPromise;
  }

  // Invoke signInWithPopup synchronously inside the click handler (no prior awaits)
  // to preserve browser user-gesture allowance and prevent Firebase Auth internal promise races.
  const run = (async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      if (
        !isRunningInIframe() &&
        (code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment')
      ) {
        writePendingRedirectFlag(true);
        try {
          await signInWithRedirect(auth, googleProvider);
          return null;
        } catch (redirectErr) {
          writePendingRedirectFlag(false);
          throw redirectErr;
        }
      }
      throw err;
    } finally {
      activePopupPromise = null;
    }
  })();

  activePopupPromise = run;
  return run;
}

export async function signInWithGoogleRedirect(): Promise<void> {
  if (isRunningInIframe()) {
    const err = new Error('Iframe redirect unsupported') as Error & { code?: string };
    err.code = 'auth/iframe-redirect-unsupported';
    throw err;
  }
  writePendingRedirectFlag(true);
  try {
    await signInWithRedirect(auth, googleProvider);
  } catch (err) {
    writePendingRedirectFlag(false);
    throw err;
  }
}

export async function signOutUser(): Promise<void> {
  writePendingRedirectFlag(false);
  await firebaseSignOut(auth);
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);

  const safeName = (user.displayName || user.email?.split('@')[0] || 'خادم').trim().slice(0, 80);
  const safeEmail = (user.email || '').trim().slice(0, 150);

  if (!snap.exists()) {
    const newProfile: Record<string, unknown> = {
      userId: user.uid,
      displayName: safeName,
      email: safeEmail,
      groupId: '',
      joinedGroupIds: [],
      enabledCards: [...ALL_STANDARD_CARD_IDS],
      collapsedBlockIds: [],
      hiddenBlockIds: [],
      compactViewMode: false,
      themeId: 'DARK',
      uiScaleMode: 'AUTO',
      uiScaleFactor: 1.0,
      showFloatingAddButton: true,
      servantAliases: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(userRef, newProfile);
    const createdSnap = await getDoc(userRef);
    return (createdSnap.data() as UserProfile) ?? (newProfile as unknown as UserProfile);
  }

  const existing = snap.data() as UserProfile;
  // Sync email if missing
  if (!existing.email && safeEmail) {
    await updateDoc(userRef, {
      email: safeEmail,
      updatedAt: serverTimestamp(),
    });
  }
  return existing;
}

export async function syncEmailDirectory(user: User, displayNameOverride?: string): Promise<void> {
  const normalizedEmail = (user.email || '').trim().toLowerCase();
  if (!normalizedEmail) return;
  const emailKey = await buildEmailDirectoryKey(normalizedEmail);
  const safeName = (displayNameOverride || user.displayName || normalizedEmail.split('@')[0] || 'خادم')
    .trim()
    .slice(0, 80);

  // Strictly matches isValidEmailDirectoryEntry: ONLY email, uid, displayName, updatedAt
  await setDoc(doc(db, 'emailDirectory', emailKey), {
    email: normalizedEmail.slice(0, 150),
    uid: user.uid,
    displayName: safeName,
    updatedAt: serverTimestamp(),
  });
}

export async function lookupUserByEmail(email: string): Promise<EmailDirectoryEntry | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return null;
  const emailKey = await buildEmailDirectoryKey(normalized);
  const snap = await getDoc(doc(db, 'emailDirectory', emailKey));
  if (!snap.exists()) return null;
  return snap.data() as EmailDirectoryEntry;
}

export async function updateUserProfileFields(
  uid: string,
  patch: Partial<
    Pick<
      UserProfile,
      | 'displayName'
      | 'groupId'
      | 'joinedGroupIds'
      | 'enabledCards'
      | 'collapsedBlockIds'
      | 'hiddenBlockIds'
      | 'compactViewMode'
      | 'themeId'
      | 'uiScaleMode'
      | 'uiScaleFactor'
      | 'showFloatingAddButton'
      | 'servantAliases'
    >
  >
): Promise<void> {
  const cleanPatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.displayName !== undefined) {
    const trimmed = patch.displayName.trim().slice(0, 80);
    if (trimmed) cleanPatch.displayName = trimmed;
  }
  if (patch.groupId !== undefined) cleanPatch.groupId = patch.groupId.slice(0, 40);
  if (patch.joinedGroupIds !== undefined) cleanPatch.joinedGroupIds = patch.joinedGroupIds.slice(0, 25);
  if (patch.enabledCards !== undefined) cleanPatch.enabledCards = patch.enabledCards.slice(0, 8);
  if (patch.collapsedBlockIds !== undefined)
    cleanPatch.collapsedBlockIds = patch.collapsedBlockIds.slice(0, 50);
  if (patch.hiddenBlockIds !== undefined)
    cleanPatch.hiddenBlockIds = patch.hiddenBlockIds.slice(0, 50);
  if (patch.compactViewMode !== undefined) cleanPatch.compactViewMode = patch.compactViewMode;
  if (patch.themeId !== undefined) cleanPatch.themeId = patch.themeId.slice(0, 40);
  if (patch.uiScaleMode !== undefined) cleanPatch.uiScaleMode = patch.uiScaleMode.slice(0, 20);
  if (patch.uiScaleFactor !== undefined) {
    cleanPatch.uiScaleFactor = Math.max(0.5, Math.min(2.0, patch.uiScaleFactor));
  }
  if (patch.showFloatingAddButton !== undefined) {
    cleanPatch.showFloatingAddButton = patch.showFloatingAddButton;
  }
  if (patch.servantAliases !== undefined) {
    const entries = Object.entries(patch.servantAliases).slice(0, 100);
    cleanPatch.servantAliases = Object.fromEntries(entries);
  }

  await updateDoc(doc(db, 'users', uid), cleanPatch);
}
