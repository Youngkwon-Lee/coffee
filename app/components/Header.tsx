"use client";
import { useEffect, useState } from "react";
import { auth } from "../../src/firebase";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import Link from "next/link";
import { ShoppingBagIcon, HeartIcon } from "@heroicons/react/24/outline";

export default function Header() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };
  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full flex justify-end items-center gap-4 p-4 bg-white/90 backdrop-blur-sm shadow-card border-b border-coffee-200">
      <Link href="/my-beans" className="flex items-center gap-1 text-sm text-brown-700 font-medium hover:text-coffee-600 transition-all duration-200 hover:scale-105">
        <HeartIcon className="w-5 h-5" /> 내 원두 보관함
      </Link>
      <Link href="/basket" className="flex items-center gap-1 text-sm text-brown-700 font-medium hover:text-coffee-600 transition-all duration-200 hover:scale-105">
        <ShoppingBagIcon className="w-5 h-5" /> 장바구니
      </Link>
      {user ? (
        <button onClick={handleLogout} className="text-sm text-brown-700 font-medium ml-2 hover:text-coffee-600 transition-all duration-200 px-4 py-2 rounded-button bg-coffee-100 border border-coffee-200 hover:bg-coffee-200">
          로그아웃 ({user.displayName})
        </button>
      ) : (
        <button onClick={handleLogin} className="text-sm text-white font-medium ml-2 hover:shadow-lg transition-all duration-200 px-4 py-2 rounded-button bg-gradient-to-r from-coffee-500 to-coffee-600">
          구글 로그인
        </button>
      )}
    </header>
  );
} 