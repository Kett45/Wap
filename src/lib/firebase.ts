import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  persistentSingleTabManager,
  setLogLevel,
  type Firestore,
} from 'firebase/firestore';
import firebaseAppletConfig from '../../firebase-applet-config.json';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId,
};

// Critical: Named Firestore database shared with the kAM Android mobile app
export const FIRESTORE_DATABASE_ID =
  import.meta.env.VITE_FIRESTORE_DATABASE_ID || firebaseAppletConfig.firestoreDatabaseId;

export const isPlaceholderWebAppId = firebaseConfig.appId.includes('REPLACE_WITH_YOUR_WEB_APP_ID');

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Silence internal Firestore WebChannel timeout noise and force Long Polling
// for reliable connections inside mobile browsers, WebViews, and proxied iframes.
setLogLevel('silent');

function createFirestoreInstance(): Firestore {
  // 1. Try multi-tab IndexedDB persistent cache so offline mutations and reads survive reloads and offline mode
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
        experimentalForceLongPolling: true,
      },
      FIRESTORE_DATABASE_ID
    );
  } catch {
    // 2. Fallback to single-tab IndexedDB cache
    try {
      return initializeFirestore(
        app,
        {
          localCache: persistentLocalCache({
            tabManager: persistentSingleTabManager({ forceOwnership: true }),
          }),
          experimentalForceLongPolling: true,
        },
        FIRESTORE_DATABASE_ID
      );
    } catch {
      // 3. Fallback to memory cache or existing instance if already initialized
      try {
        return initializeFirestore(
          app,
          {
            localCache: memoryLocalCache(),
            experimentalForceLongPolling: true,
          },
          FIRESTORE_DATABASE_ID
        );
      } catch {
        return getFirestore(app, FIRESTORE_DATABASE_ID);
      }
    }
  }
}

export const db = createFirestoreInstance();
