import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

function getApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
}

export function getClientAuth(): Auth {
  if (!authInstance) authInstance = getAuth(getApp());
  return authInstance;
}

export function getClientDb(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(getApp());
  return dbInstance;
}

export const googleProvider = new GoogleAuthProvider();

export { getApp as firebaseApp };
// 인증·Firestore는 모듈을 불러오는 즉시 초기화하지 않는다. 일부 WebView/개인정보
// 보호 환경에서는 Auth의 popup/redirect resolver 초기화가 실패할 수 있는데, 이때
// 로그인과 무관한 홈 화면까지 모듈 평가 단계에서 함께 멈추면 안 된다.
