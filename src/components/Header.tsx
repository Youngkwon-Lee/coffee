"use client";
import { useEffect, useState } from "react";
import { auth } from "../firebase";
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
    <header className="fixed top-0 left-0 right-0 z-50 w-full flex justify-end items-center gap-4 p-4 bg-white/80 shadow backdrop-blur-md">
      <Link href="/my-beans" className="flex items-center gap-1 text-xs text-mocha font-bold hover:text-espresso transition">
        <HeartIcon className="w-5 h-5" /> 내 원두 보관함
      </Link>
      <Link href="/basket" className="flex items-center gap-1 text-xs text-mocha font-bold hover:text-espresso transition">
        <ShoppingBagIcon className="w-5 h-5" /> 장바구니
      </Link>
      {user ? (
        <button onClick={handleLogout} className="text-xs text-mocha font-bold ml-2">
          로그아웃 ({user.displayName})
        </button>
      ) : (
        <button onClick={handleLogin} className="text-xs text-mocha font-bold ml-2">
          구글 로그인
        </button>
      )}
    </header>
  );
} 