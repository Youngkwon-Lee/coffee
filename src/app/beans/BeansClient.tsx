"use client";
import Image from "next/image";
import { useState, useEffect } from "react";
import { collection, getDocs, setDoc, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "@/firebase";
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

export default function BeansClient({ beans: initialBeans }: { beans: Bean[] }) {
  const [beans] = useState<Bean[]>(initialBeans);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
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

  // 향미/배전도/브랜드 목록 추출
  // 실제 데이터에서 향미 목록 추출 (쉼표로 구분된 문자열을 분리하고 중복 제거)
  const flavors = Array.from(new Set(
    beans.flatMap(bean => 
      (bean.flavor || "").split(",").map(f => f.trim())
    ).filter(Boolean)
  )).sort();

  // 실제 데이터에서 배전도 목록 추출
  const roasts = Array.from(new Set(
    beans.map(bean => bean.roast || "").filter(Boolean)
  )).sort();

  // 실제 데이터에서 브랜드 목록 추출
  const brands = Array.from(new Set(
    beans.map(bean => bean.brand || "").filter(Boolean)
  )).sort();

  // 취향 기반 추천 필터
  const recommendedBeans = beans.filter(bean => {
    const flavorMatch = myFlavor ? (bean.flavor && bean.flavor.includes(myFlavor)) : true;
    const roastMatch = myRoast ? (bean.roast === myRoast) : true;
    const brandMatch = myBrand ? (bean.brand === myBrand) : true;
    return flavorMatch && roastMatch && brandMatch;
  });

  // 배전도 순으로 정렬
  const sortedBeans = [...recommendedBeans].sort((a, b) => {
    const roastOrder = { "Light": 1, "Medium": 2, "Medium-Dark": 3, "Dark": 4 };
    const aRoast = a.roast || "";
    const bRoast = b.roast || "";
    return (roastOrder[aRoast as keyof typeof roastOrder] || 0) - (roastOrder[bRoast as keyof typeof roastOrder] || 0);
  });

  // Fuzzy Search 적용 (Fuse.js)
  const fuse = new Fuse(sortedBeans, {
    keys: ["name", "flavor", "brand"],
    threshold: 0.3,
  });
  const fuzzyBeans = search
    ? fuse.search(search).map(result => result.item)
    : sortedBeans;

  // 브랜드 필터 추가 적용
  const filteredBeans = fuzzyBeans.filter(bean => {
    const matchesBrand = brandFilter ? bean.brand === brandFilter : true;
    return matchesBrand;
  });

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredBeans.length / itemsPerPage);
  const paginatedBeans = filteredBeans.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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

  // 카페별로 그룹화
  const beansByBrand: { [brand: string]: Bean[] } = {};
  filteredBeans.forEach(bean => {
    const brand = bean.brand || "기타";
    if (!beansByBrand[brand]) beansByBrand[brand] = [];
    beansByBrand[brand].push(bean);
  });
  const brandList = Object.keys(beansByBrand).sort();
  const [openBrand, setOpenBrand] = useState<string | null>(null);

  return (
    <main className="flex flex-col items-center min-h-screen pt-20 pb-20 bg-gradient-to-br from-amber-50 to-rose-100">
      <h1 className="text-2xl font-bold mb-6 text-espresso">🌱 감성 원두사기</h1>
      {/* 로그인/로그아웃 UI (상단에만 노출) */}
      <div className="mb-4 flex gap-2 items-center">
        {user ? (
          <>
            <span className="text-mocha font-bold">{user.displayName || user.email} 님</span>
            <button onClick={() => signOut(auth)} className="px-3 py-1 rounded-full bg-mocha text-white font-bold hover:bg-espresso transition">로그아웃</button>
          </>
        ) : (
          <button
            onClick={async () => {
              try {
                await signInWithPopup(auth, new GoogleAuthProvider());
                window.location.reload();
              } catch {
                alert("로그인에 실패했습니다. 다시 시도해 주세요.");
              }
            }}
            className="px-3 py-1 rounded-full bg-blue-500 text-white font-bold hover:bg-blue-700 transition"
          >
            구글 로그인
          </button>
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
      <div className="flex flex-wrap gap-2 mb-4 justify-center">
        <select 
          value={myFlavor} 
          onChange={e => setMyFlavor(e.target.value)} 
          className="border border-mocha rounded-full px-3 py-2 bg-caramel text-espresso font-serif text-sm focus:outline-none focus:ring-2 focus:ring-mocha"
        >
          <option value="">향미 선택</option>
          {flavors.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select 
          value={myRoast} 
          onChange={e => setMyRoast(e.target.value)} 
          className="border border-mocha rounded-full px-3 py-2 bg-caramel text-espresso font-serif text-sm focus:outline-none focus:ring-2 focus:ring-mocha"
        >
          <option value="">배전도 선택</option>
          {roasts.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select 
          value={myBrand} 
          onChange={e => setMyBrand(e.target.value)} 
          className="border border-mocha rounded-full px-3 py-2 bg-caramel text-espresso font-serif text-sm focus:outline-none focus:ring-2 focus:ring-mocha"
        >
          <option value="">브랜드 선택</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      {/* 검색/브랜드 필터 */}
      <div className="flex flex-wrap gap-2 mb-4 justify-center">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="이름/향미/브랜드 검색 (부분/오타 허용)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && setSearch(e.currentTarget.value)}
            className="border border-mocha rounded-full px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-mocha font-serif text-sm"
          />
          <button
            onClick={() => setSearch(search)}
            className="px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-500 text-white font-semibold shadow transition"
          >
            검색
          </button>
        </div>
        <select
          value={brandFilter}
          onChange={e => setBrandFilter(e.target.value)}
          className="border border-mocha rounded-full px-3 py-2 bg-caramel text-espresso font-serif text-sm focus:outline-none focus:ring-2 focus:ring-mocha"
        >
          <option value="">전체 브랜드</option>
          {brands.map(brand => (
            <option key={brand} value={brand}>{brand}</option>
          ))}
        </select>
      </div>
      {/* 카페별 아코디언 카드 UI */}
      <div className="w-full max-w-4xl flex flex-col gap-4 px-4">
        {brandList.length === 0 && (
          <div className="text-center text-mocha py-10">원두가 없습니다.</div>
        )}
        {brandList.map(brand => (
          <div key={brand} className="bg-white/90 rounded-2xl shadow border border-caramel">
            <button
              className="w-full text-left px-6 py-4 flex items-center justify-between text-xl font-bold text-espresso hover:bg-amber-50 rounded-2xl transition"
              onClick={() => setOpenBrand(openBrand === brand ? null : brand)}
            >
              <span>{brand}</span>
              <span className="text-lg">{openBrand === brand ? "▲" : "▼"}</span>
            </button>
            {openBrand === brand && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 pt-0">
                {beansByBrand[brand].map(bean => (
                  <div key={bean.id} className="bg-white/80 rounded-2xl shadow p-4 flex flex-col gap-4 border border-caramel relative">
                    {/* 찜/장바구니 버튼 */}
                    <div className="absolute top-2 right-2 flex gap-2 z-10">
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
                    <div className="flex justify-center">
                      <Image src={bean.image || "/beans/default.jpg"} alt={bean.name} width={200} height={200} className="rounded-xl object-cover w-48 h-48" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="text-lg font-bold text-espresso">{bean.name}</div>
                      <div className="text-xs text-mocha">향미: {bean.flavor}</div>
                      {bean.desc && <div className="text-xs text-brown-700">{bean.desc}</div>}
                      <div className="text-caramel font-bold">{bean.price} / 200g</div>
                      <div className="flex justify-center">
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
            )}
          </div>
        ))}
      </div>
      {/* 페이지네이션 UI */}
      {totalPages > 1 && (
        <div className="flex gap-2 mt-8">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
          >
            이전
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i + 1}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-3 py-1 rounded ${currentPage === i + 1 ? 'bg-mocha text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
          >
            다음
          </button>
        </div>
      )}
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