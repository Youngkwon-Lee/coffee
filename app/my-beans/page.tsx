"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/firebase";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
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
      <main className="kc-page kc-benefit-shell">
        <nav className="kc-dark-tabs" aria-label="보관함과 알림 탭">
          <Link href="/my-beans" aria-current="page">찜한 원두</Link>
          <Link href="/settings/alerts">알림 설정</Link>
        </nav>
        <section className="kc-benefit-panel" aria-labelledby="saved-beans-title">
          <header className="kc-page-heading">
            <p className="kc-eyebrow">MY COFFEE COLLECTION</p>
            <h1 id="saved-beans-title">나의 보관함</h1>
            <p>마음에 드는 원두를 모아 다시 살펴보세요.</p>
          </header>

          <div className="kc-benefit-account">
            {user ? (
              <>
                <span className="text-sm text-coffee-latte">{user.displayName || "로그인됨"}</span>
                <button type="button" className="kc-logout" onClick={() => signOut(auth)}>로그아웃</button>
              </>
            ) : (
              <button type="button" onClick={handleGoogleLogin}>Google로 로그인</button>
            )}
          </div>
          {loadError && <p className="kc-error mb-4" role="alert">{loadError}</p>}
          {loading ? <p role="status" className="py-9 text-center text-coffee-latte">보관함을 불러오는 중입니다.</p>
            : !user ? <div className="kc-empty"><h2>관심 원두를 저장해보세요</h2><p>로그인 후 원두를 찜하면 이곳에서 다시 확인할 수 있습니다.</p><Link href="/beans" className="kc-text-link mt-3">원두 둘러보기</Link></div>
            : beans.length === 0 ? <div className="kc-empty"><h2>아직 찜한 원두가 없습니다</h2><p>원두 탐색에서 하트 버튼을 누르면 여기에 모입니다.</p><Link href="/beans" className="kc-text-link mt-3">원두 찾기</Link></div>
            : <div className="kc-benefit-list">{beans.map(bean => (
                <article className="kc-benefit-card" key={bean.id}>
                  <div className="flex gap-4 items-start">
                    {typeof bean.image === "string" && /^https:\/\//.test(bean.image) &&
                      <img src={bean.image} alt="" className="h-24 w-24 rounded-xl object-cover bg-coffee-medium" loading="lazy" />}
                    <div className="min-w-0 flex-1">
                      <p className="kc-card-brand">{bean.brand || "로스터리 원두"}</p>
                      <h3>{bean.name}</h3>
                      <p className="kc-price">{bean.price || "가격 정보 없음"}</p>
                    </div>
                  </div>
                  {bean.flavor && <p className="mt-2 text-sm text-coffee-latte">{typeof bean.flavor === "string" ? bean.flavor : String(bean.flavor)}</p>}
                  <div className="kc-benefit-details">
                    관심 원두로 저장됨 · 판매 가능 여부는 판매처 기준
                    <div className="kc-benefit-actions">
                      <Link href={"/beans/" + encodeURIComponent(bean.id)}>원두 상세 보기</Link>
                      <button type="button" onClick={() => handleRemove(bean.id)}>찜 해제</button>
                    </div>
                  </div>
                </article>
              ))}</div>}
          <Link href="/beans" className="kc-text-link mt-6">다른 원두 찾아보기</Link>
        </section>
        <div className="kc-dark-notice">
          <span>원두 변화를 놓치고 싶지 않다면 <Link href="/settings/alerts">알림 설정</Link>을 확인하세요. 실제 발송·결제는 별도 확인이 필요합니다.</span>
        </div>
      </main>
      <AlertComponent />
    </>
  );
}
