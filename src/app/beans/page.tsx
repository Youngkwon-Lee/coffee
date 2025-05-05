"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { collection, getDocs, setDoc, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import Fuse from "fuse.js";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";

type Bean = {
  id?: string;
  name: string;
  flavor: string;
  price: string;
  image: string;
  desc?: string;
  roast?: string;
  brand?: string;
  link?: string;
  category?: string;
};

type Recommendation = {
  name: string;
  reason: string;
};

// 장바구니(🛒) 상태 관리 훅
function useBasket() {
  const [basket, setBasket] = useState<string[]>([]);
  useEffect(() => {
    const stored = localStorage.getItem("basket_beans");
    if (stored) setBasket(JSON.parse(stored));
  }, []);
  const toggleBasket = (id: string) => {
    setBasket(prev => {
      const updated = prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id];
      localStorage.setItem("basket_beans", JSON.stringify(updated));
      return updated;
    });
  };
  return { basket, toggleBasket };
}

export default function BeansPage() {
  const [beans, setBeans] = useState<Bean[]>([]);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [loading, setLoading] = useState(true);
  // 취향 기반 추천용 상태
  const [myFlavor, setMyFlavor] = useState("");
  const [myRoast, setMyRoast] = useState("");
  const [myBrand, setMyBrand] = useState("");

  // GPT 감성 추천 상태
  const [gptInput, setGptInput] = useState("");
  const [gptLoading, setGptLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [gptError, setGptError] = useState("");

  // 로그인 상태
  const [user, setUser] = useState<User | null>(null);
  // Firestore 기반 찜 목록
  const [wishlist, setWishlist] = useState<string[]>([]);

  const { basket, toggleBasket } = useBasket();
  const router = useRouter();

  // 로그인 상태 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 로그인 시 Firestore에서 찜 목록 불러오기
  useEffect(() => {
    if (!user) {
      setWishlist([]);
      return;
    }
    const fetchWishlist = async () => {
      const snap = await getDocs(collection(db, `users/${user.uid}/favorites_beans`));
      setWishlist(snap.docs.map(doc => doc.id));
    };
    fetchWishlist();
  }, [user]);

  // 찜 토글 함수 (Firestore 연동)
  const toggleWishlist = async (beanId: string) => {
    if (!user) return;
    const ref = doc(db, `users/${user.uid}/favorites_beans`, beanId);
    if (wishlist.includes(beanId)) {
      await deleteDoc(ref);
      setWishlist(wishlist.filter(id => id !== beanId));
    } else {
      await setDoc(ref, { addedAt: new Date() });
      setWishlist([...wishlist, beanId]);
    }
  };

  useEffect(() => {
    const fetchBeans = async () => {
      const beansCol = collection(db, "beans");
      const beanSnapshot = await getDocs(beansCol);
      const beanList = beanSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Bean[];
      setBeans(beanList);
      setLoading(false);
    };
    fetchBeans();
  }, []);

  // 향미/배전도/브랜드 목록 추출
  const flavors = Array.from(new Set(beans.flatMap(b => b.flavor?.split(/[ ,·,]+/) || []).filter(Boolean)));
  const roasts = Array.from(new Set(beans.map(b => b.roast).filter(Boolean)));
  const brands = Array.from(new Set(beans.map(b => b.brand).filter(Boolean)));

  // 취향 기반 추천 필터
  const recommendedBeans = beans.filter(bean => {
    const flavorMatch = myFlavor ? (bean.flavor && bean.flavor.includes(myFlavor)) : true;
    const roastMatch = myRoast ? (bean.roast === myRoast) : true;
    const brandMatch = myBrand ? (bean.brand === myBrand) : true;
    return flavorMatch && roastMatch && brandMatch;
  });

  // Fuzzy Search 적용 (Fuse.js)
  const fuse = new Fuse(recommendedBeans, {
    keys: ["name", "flavor", "brand"],
    threshold: 0.3,
  });
  const fuzzyBeans = search
    ? fuse.search(search).map(result => result.item)
    : recommendedBeans;

  // 브랜드 필터 추가 적용
  const filteredBeans = fuzzyBeans.filter(bean => {
    const matchesBrand = brandFilter ? bean.brand === brandFilter : true;
    return matchesBrand;
  });

  // GPT 감성 추천 요청
  const handleGptRecommend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gptInput.trim()) return;
    setGptLoading(true);
    setGptError("");
    setRecommendations([]);
    try {
      const res = await fetch("http://localhost:8000/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: gptInput }),
      });
      const data = await res.json();
      if (data.recommendations) {
        setRecommendations(data.recommendations);
      } else {
        setGptError("추천 결과를 불러올 수 없습니다.");
      }
    } catch {
      setGptError("추천 서버에 연결할 수 없습니다.");
    }
    setGptLoading(false);
  };

  // Firestore 원두 데이터와 매칭
  const getBeanDetail = (name: string) => beans.find((bean) => bean.name === name);

  if (loading) return <div className="text-center py-10">로딩 중...</div>;

  return (
    <main className="flex flex-col items-center min-h-screen pt-20 pb-20 bg-gradient-to-br from-amber-50 to-rose-100">
      <h1 className="text-2xl font-bold mb-6 text-espresso">🌱 감성 원두사기</h1>
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
      {/* GPT 감성 추천 입력창 및 결과 */}
      <section className="w-full max-w-md mb-8">
        <form onSubmit={handleGptRecommend} className="flex gap-2 mb-2">
          <input
            type="text"
            value={gptInput}
            onChange={e => setGptInput(e.target.value)}
            className="flex-1 border border-caramel rounded-full px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-mocha font-serif"
            placeholder="기분/날씨/취향을 입력해보세요! (예: 오늘은 우울해요)"
            disabled={gptLoading}
          />
          <button
            type="submit"
            disabled={gptLoading || !gptInput.trim()}
            className="bg-amber-400 hover:bg-amber-500 text-white font-semibold rounded-full px-4 py-2 shadow transition"
          >
            추천받기
          </button>
        </form>
        {gptLoading && <div className="text-center text-mocha">추천 중...</div>}
        {gptError && <div className="text-center text-red-500">{gptError}</div>}
        {recommendations.length > 0 && (
          <div className="flex flex-col gap-4 mt-4">
            {recommendations.map((rec, idx) => {
              const bean = getBeanDetail(rec.name);
              return (
                <div key={idx} className="bg-white rounded-xl shadow p-4 flex gap-4 items-center">
                  <Image src={bean?.image || "/beans/default.jpg"} alt={rec.name} width={80} height={80} className="rounded-lg" />
                  <div>
                    <div className="font-bold text-lg">{rec.name}</div>
                    <div className="text-xs text-mocha mb-1">{rec.reason}</div>
                    {bean && (
                      <>
                        <div className="text-caramel font-bold">{bean.price}</div>
                        <div className="text-xs text-brown-700">{bean.flavor}</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      {/* 취향 기반 추천 UI */}
      <div className="flex gap-2 mb-4">
        <select value={myFlavor} onChange={e => setMyFlavor(e.target.value)} className="border rounded px-2 py-1">
          <option value="">향미 선택</option>
          {flavors.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={myRoast} onChange={e => setMyRoast(e.target.value)} className="border rounded px-2 py-1">
          <option value="">배전도 선택</option>
          {roasts.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={myBrand} onChange={e => setMyBrand(e.target.value)} className="border rounded px-2 py-1">
          <option value="">브랜드 선택</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      {/* 검색/브랜드 필터 */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="이름/향미/브랜드 검색 (부분/오타 허용)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <select
          value={brandFilter}
          onChange={e => setBrandFilter(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="">전체 브랜드</option>
          {brands.map(brand => (
            <option key={brand} value={brand}>{brand}</option>
          ))}
        </select>
      </div>
      <div className="w-full max-w-md flex flex-col gap-6">
        {filteredBeans.map(bean => (
          <div key={bean.id} className="bg-white/80 rounded-2xl shadow p-4 flex flex-col md:flex-row gap-4 border border-caramel items-center relative">
            {/* 찜/장바구니 버튼 */}
            <div className="absolute bottom-2 right-2 flex gap-2 z-10">
              <button
                onClick={() => user ? toggleWishlist(bean.id!) : undefined}
                aria-label="찜하기"
                className={`text-2xl ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!user}
                title={!user ? "로그인 후 이용 가능" : wishlist.includes(bean.id!) ? "찜 해제" : "찜하기"}
              >
                {wishlist.includes(bean.id!) ? "❤️" : "🤍"}
              </button>
              <button onClick={() => toggleBasket(bean.id!)} aria-label="장바구니 담기" className="text-2xl">
                {basket.includes(bean.id!) ? "🛒" : "🛍️"}
              </button>
            </div>
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
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* 오른쪽 하단 플로팅 장바구니 버튼 */}
      <button
        className="fixed bottom-6 right-6 z-50 bg-mocha text-white rounded-full shadow-lg w-16 h-16 flex items-center justify-center text-3xl hover:bg-espresso transition-all duration-200"
        onClick={() => router.push("/basket")}
        aria-label="장바구니 열기"
      >
        🛒
        {basket.length > 0 && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
            {basket.length}
          </span>
        )}
      </button>
    </main>
  );
} 