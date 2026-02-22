import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const isConfigValid = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Firebase를 사용할 수 없을 때 (빌드 시 환경변수 없을 때) auth mock 제공
// useAuthState가 onAuthStateChanged를 사용하므로 최소한의 구현만 필요
const mockAuth = {
  currentUser: null,
  onAuthStateChanged: (callback: (user: null) => void) => {
    if (typeof callback === 'function') callback(null);
    return () => {};
  },
  onIdTokenChanged: (callback: (user: null) => void) => {
    if (typeof callback === 'function') callback(null);
    return () => {};
  },
} as unknown as Auth;

const mockDb = {} as Firestore;

let _db: Firestore = mockDb;
let _auth: Auth = mockAuth;

if (isConfigValid) {
  try {
    const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    _db = getFirestore(app);
    _auth = getAuth(app);
  } catch (e) {
    // 빌드 환경에서 초기화 실패 시 mock 유지
  }
}

export const db = _db;
export const auth = _auth;
