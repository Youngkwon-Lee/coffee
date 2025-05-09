"use client";
import { useEffect, useState } from "react";
import { db, auth } from "../../src/firebase";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from "firebase/auth";
import Image from "next/image";

interface Bean {
  id: string;
  name: string;
  flavor: string;
  price: string;
  image: string;
  desc?: string;
  roast?: string;
  brand?: string;
  link?: string;
  category?: string;
}

export default function MyBeansPage() {
  const [user, setUser] = useState<User | null>(null);
  const [beans, setBeans] = useState<Bean[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // 로그인 상태 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Firestore에서 찜한 원두 ID 목록 불러오기
  useEffect(() => {
    if (!user) {
      setWishlist([]);
      setBeans([]);
      setLoading(false);
      return;
    }
    const fetchWishlist = async () => {
      setLoading(true);
      const snap = await getDocs(collection(db, `users/${user.uid}/favorites_beans`));
      const ids = snap.docs.map(doc => doc.id);
      setWishlist(ids);
      setLoading(false);
    };
    fetchWishlist();
  }, [user]);

  // Firestore에서 beans 전체 불러오기 후, 찜한 원두만 필터링
  useEffect(() => {
    if (!user || wishlist.length === 0) {
      setBeans([]);
      return;
    }
    const fetchBeans = async () => {
      const beansCol = collection(db, "beans");
      const beanSnapshot = await getDocs(beansCol);
      const beanList = beanSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Bean[];
      setBeans(beanList.filter(bean => wishlist.includes(bean.id)));
    };
    fetchBeans();
  }, [user, wishlist]);

  // 찜 해제(삭제)
  const handleRemove = async (beanId: string) => {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/favorites_beans`, beanId));
    setWishlist(wishlist.filter(id => id !== beanId));
    setBeans(beans.filter(bean => bean.id !== beanId));
  };

  return (
    <main className="flex flex-col items-center min-h-screen pt-20 pb-20 bg-gradient-to-br from-amber-50 to-rose-100">
      <h1 className="text-2xl font-bold mb-6 text-espresso">☕ 내 원두 보관함</h1>
      {/* 로그인/로그아웃 UI */}
      <div className="mb-4 flex gap-2 items-center">
        {user ? (
          <>
            <span className="text-mocha font-bold">{user.displayName || user.email} 님</span>
            <button onClick={() => signOut(auth)} className="px-3 py-1 rounded-full bg-mocha text-white font-bold hover:bg-espresso transition">로그아웃</button>
          </>
        ) : (
          <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="px-3 py-1 rounded-full bg-blue-500 text-white font-bold hover:bg-blue-700 transition">구글 로그인</button>
        )}
      </div>
      {loading ? (
        <div className="text-center py-10">로딩 중...</div>
      ) : !user ? (
        <div className="text-center text-mocha font-bold py-10">로그인 후 내 원두 보관함을 확인할 수 있습니다.</div>
      ) : beans.length === 0 ? (
        <div className="text-center text-brown-400 py-10">찜한 원두가 없습니다.</div>
      ) : (
        <div className="w-full max-w-md flex flex-col gap-6">
          {beans.map(bean => (
            <div key={bean.id} className="bg-white/80 rounded-2xl shadow p-4 flex flex-col md:flex-row gap-4 border border-caramel items-center relative">
              <Image src={bean.image || "/beans/default.jpg"} alt={bean.name} width={100} height={100} className="rounded-xl object-cover w-24 h-24" />
              <div className="flex-1 flex flex-col gap-1">
                <div className="text-lg font-bold text-espresso">{bean.name}</div>
                <div className="text-xs text-mocha mb-1">향미: {bean.flavor}</div>
                {bean.desc && <div className="text-xs text-brown-700 mb-1">{bean.desc}</div>}
                <div className="text-caramel font-bold mb-2">{bean.price} / 200g</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => bean.link && window.open(bean.link, "_blank")}
                    className="px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-500 text-white font-semibold shadow transition text-sm"
                  >
                    구매하기
                  </button>
                  <button
                    onClick={() => handleRemove(bean.id)}
                    className="px-4 py-2 rounded-full bg-red-400 hover:bg-red-500 text-white font-semibold shadow transition text-sm"
                  >
                    찜 해제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
} 