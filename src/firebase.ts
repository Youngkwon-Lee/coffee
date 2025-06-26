import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase 설정 확인
const requiredConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 필수 환경변수 확인
const missingKeys = Object.entries(requiredConfig)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0) {
  console.warn('Missing Firebase environment variables:', missingKeys);
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCcy5cm_7diVnjW0EmbejXWzvwqsDr53gw",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "coffee-37b81.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "coffee-37b81",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "coffee-37b81.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "931541737029",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:931541737029:web:3f24a512e5c157f837cd2c",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-FGG9QFL7M9"
};

// Firebase 앱 초기화 (중복 초기화 방지)
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Firebase 서비스 초기화 및 에러 처리
let db, auth;

try {
  db = getFirestore(app);
  auth = getAuth(app);
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw new Error('Firebase 초기화에 실패했습니다. 환경변수를 확인해주세요.');
}

export { db, auth };