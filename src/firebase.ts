import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// (선택) import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCcy5cm_7diVnjW0EmbejXWzvwqsDr53gw",
  authDomain: "coffee-37b81.firebaseapp.com",
  projectId: "coffee-37b81",
  storageBucket: "coffee-37b81.firebasestorage.app",
  messagingSenderId: "931541737029",
  appId: "1:931541737029:web:3f24a512e5c157f837cd2c",
  measurementId: "G-FGG9QFL7M9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
// (선택) export const analytics = getAnalytics(app);