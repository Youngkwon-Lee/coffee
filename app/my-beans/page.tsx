"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/firebase";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import Image from "next/image";
import Link from "next/link";
import { useCustomAlert } from "../components/CustomAlert";
import { createGoogleSignInProvider, getGoogleSignInErrorMessage } from "@/utils/firebaseAuth";

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const { showAlert, AlertComponent } = useCustomAlert();

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
      setLoadError(null);
      setLoading(false);
      return;
    }
    const fetchWishlist = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const snap = await getDocs(collection(db, `users/${user.uid}/favorites_beans`));
        setWishlist(snap.docs.map(doc => doc.id));
      } catch (error) {
        console.error("원두 보관함 불러오기 실패:", error);
        setWishlist([]);
        setLoadError("원두 보관함을 불러오지 못했습니다. 로그인과 연결 상태를 확인하고 다시 접속해주세요.");
      } finally {
        setLoading(false);
      }
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
      try {
        const beanSnapshot = await getDocs(collection(db, "beans"));
        // 문서 ID를 우선하며 데이터의 다른 ID로 덮어쓰지 않는다.
        const beanList = beanSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Bean[];
        setBeans(beanList.filter(bean => wishlist.includes(bean.id)));
      } catch (error) {
        console.error("찜한 원두 정보 불러오기 실패:", error);
        setBeans([]);
        setLoadError("저장한 원두 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    };
    fetchBeans();
  }, [user, wishlist]);

  // 찜 해제(삭제)
  const handleRemove = async (beanId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/favorites_beans`, beanId));
      setWishlist(wishlist.filter(id => id !== beanId));
      setBeans(beans.filter(bean => bean.id !== beanId));
    } catch (error) {
      console.error("원두 찜 해제 실패:", error);
      showAlert({ type: "error", title: "찜 해제 실패", message: "연결을 확인한 뒤 다시 시도해주세요.", confirmText: "확인" });
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, createGoogleSignInProvider());
    } catch (error) {
      console.error("내 원두 보관함 로그인 오류:", error);
      showAlert({
        type: "error",
        title: "로그인 실패",
        message: getGoogleSignInErrorMessage(error),
        confirmText: "확인",
      });
    }
  };

  return (
    <>
      <main className="flex flex-col items-center min-h-screen pt-20 pb-20">
        <h1 className="text-2xl font-bold mb-3 text-coffee-light">내 원두 보관함</h1>
        <Link href="/beans" className="mb-5 inline-flex min-h-11 items-center text-sm text-coffee-gold underline underline-offset-4">
          원두 찾기로 돌아가기
        </Link>
        {/* 로그인/로그아웃 UI */}
        <div className="mb-4 flex gap-2 items-center">
          {user ? (
            <>
              <span className="text-mocha font-bold">{user.displayName || user.email} 님</span>
              <button onClick={() => signOut(auth)} className="px-3 py-1 rounded-full bg-mocha text-white font-bold hover:bg-espresso transition">로그아웃</button>
            </>
          ) : (
            <button onClick={handleGoogleLogin} className="px-3 py-1 rounded-full bg-blue-500 text-white font-bold hover:bg-blue-700 transition">구글 로그인</button>
          )}
        </div>
        {/* 재입고/가격 알림 설정 */}
        <Link href="/settings/alerts" className="mb-4 text-sm text-mocha underline">
          🔔 재입고 · 가격 알림 설정
        </Link>
        {loadError && <p role="alert" className="mb-4 max-w-md px-4 text-sm text-red-300">{loadError}</p>}
        {loading ? (
          <div className="text-center py-10">로딩 중...</div>
        ) : !user ? (
          <div className="text-center text-coffee-light/80 py-10">Google 로그인 후 관심 원두를 저장할 수 있습니다. 로그인한 뒤 원두 찾기로 돌아가 찜해주세요.</div>
        ) : beans.length === 0 ? (
          <div className="text-center text-coffee-light/70 py-10">찜한 원두가 없습니다. 원두 찾기에서 하트를 눌러보세요.</div>
        ) : (
          <div className="w-full max-w-md flex flex-col gap-6">
            {beans.map(bean => (
              <div key={bean.id} className="card-coffee p-4 flex flex-col md:flex-row gap-4 border border-caramel items-center relative">
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
      <AlertComponent />
    </>
  );
}
