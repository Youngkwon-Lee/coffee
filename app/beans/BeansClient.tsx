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
  flavor: string | string[];
  price: string;
  image: string;
  desc?: string;
  roast?: string;
  brand?: string;
  link?: string;
  category?: string;
  createdAt?: string;
  lastUpdated?: string;
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
  const [flavorFilter, setFlavorFilter] = useState("");
  const [roastFilter, setRoastFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "price" | "popular" | "recent">("popular");
  
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

  // 챗봇 상태 추가
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatbotPosition, setChatbotPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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
    beans.flatMap(bean => {
      const flavorValue = bean.flavor;
      if (typeof flavorValue === 'string') {
        return flavorValue.split(",").map(f => f.trim());
      } else if (Array.isArray(flavorValue)) {
        return flavorValue.map((f: any) => String(f).trim());
      }
      return [] as string[];
    }).filter(Boolean)
  )).sort();

  // 표준 배전도 목록 (실제 데이터와 함께)
  const standardRoasts = ["Light", "Medium-Light", "Medium", "Medium-Dark", "Dark"];
  const actualRoasts = Array.from(new Set(
    beans.map(bean => bean.roast || "").filter(Boolean)
  )).sort();
  const roasts = [...new Set([...standardRoasts, ...actualRoasts])];

  // 실제 데이터에서 브랜드 목록 추출
  const brands = Array.from(new Set(
    beans.map(bean => bean.brand || "").filter(Boolean)
  )).sort();

  // 필터링 로직
  let filteredBeans = beans;

  // 브랜드 필터
  if (brandFilter) {
    filteredBeans = filteredBeans.filter(bean => bean.brand === brandFilter);
  }

  // 향미 필터
  if (flavorFilter) {
    filteredBeans = filteredBeans.filter(bean => {
      const flavorValue = bean.flavor;
      if (typeof flavorValue === 'string') {
        return flavorValue.includes(flavorFilter);
      } else if (Array.isArray(flavorValue)) {
        return flavorValue.some((f: any) => String(f).includes(flavorFilter));
      }
      return false;
    });
  }

  // 배전도 필터
  if (roastFilter) {
    filteredBeans = filteredBeans.filter(bean => bean.roast === roastFilter);
  }

  // 취향 기반 추천 필터
  const recommendedBeans = filteredBeans.filter(bean => {
    const flavorMatch = myFlavor ? (bean.flavor && String(bean.flavor).includes(myFlavor)) : true;
    const roastMatch = myRoast ? (bean.roast === myRoast) : true;
    const brandMatch = myBrand ? (bean.brand === myBrand) : true;
    return flavorMatch && roastMatch && brandMatch;
  });

  // 정렬 로직
  const sortedBeans = [...recommendedBeans].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "price":
        const priceA = parseInt(String(a.price || "0").replace(/[^0-9]/g, "")) || 0;
        const priceB = parseInt(String(b.price || "0").replace(/[^0-9]/g, "")) || 0;
        return priceA - priceB;
      case "recent":
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      case "popular":
      default:
        // 인기도 기준: 브랜드별 원두 개수가 많을수록 인기있다고 가정
        const brandCountA = beans.filter(bean => bean.brand === a.brand).length;
        const brandCountB = beans.filter(bean => bean.brand === b.brand).length;
        if (brandCountA !== brandCountB) {
          return brandCountB - brandCountA;
        }
        // 이름순으로 2차 정렬
        return a.name.localeCompare(b.name);
    }
  });

  // Fuzzy Search 적용 (Fuse.js)
  const fuse = new Fuse(sortedBeans, {
    keys: ["name", "flavor", "brand"],
    threshold: 0.3,
  });
  const finalBeans = search
    ? fuse.search(search).map(result => result.item)
    : sortedBeans;

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const totalPages = Math.ceil(finalBeans.length / itemsPerPage);
  const paginatedBeans = finalBeans.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // 페이지 변경 시 맨 위로 스크롤
  useEffect(() => {
    setCurrentPage(1);
  }, [search, brandFilter, flavorFilter, roastFilter, sortBy, myFlavor, myRoast, myBrand]);

  // GPT 감성 추천 요청
  const handleGptRecommend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gptInput.trim()) return;
    setGptLoading(true);
    setGptError("");
    setRecommendations([]);
    try {
      const res = await fetch("/api/gpt-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: gptInput,
          availableBeans: beans.map(bean => ({
            name: bean.name,
            flavor: bean.flavor,
            roast: bean.roast,
            brand: bean.brand
          }))
        }),
      });
      const data = await res.json();
      if (data.recommendations) {
        setRecommendations(data.recommendations);
        setGptError("");
      } else {
        setGptError("추천 결과를 불러올 수 없습니다.");
      }
    } catch {
      setGptError("추천 서버에 연결할 수 없습니다. GPT API 설정을 확인해주세요.");
    }
    setGptLoading(false);
  };

  // Firestore 원두 데이터와 매칭
  const getBeanDetail = (name: string) => beans.find((bean) => bean.name === name);

  // 드래그 핸들러
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - chatbotPosition.x,
      y: e.clientY - chatbotPosition.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    setChatbotPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-coffee-50 to-cream-100 relative overflow-hidden">
      {/* 배경 장식 요소들 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(230,188,83,0.15),transparent_70%)]"></div>
      <div className="absolute top-0 left-0 w-96 h-96 bg-coffee-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"></div>
      <div className="absolute top-0 right-0 w-80 h-80 bg-brown-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{animationDelay: '2s'}}></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-coffee-300 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-float" style={{animationDelay: '4s'}}></div>
      
      <main className="relative z-10 flex flex-col items-center min-h-screen pt-20 pb-20 px-4">
        {/* 헤더 */}
        <header className="w-full max-w-6xl text-center mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-8">
            <h1 className="text-4xl md:text-6xl font-display font-bold bg-gradient-to-r from-brown-700 via-coffee-600 to-brown-800 bg-clip-text text-transparent mb-4">
              ☕ 원두 컬렉션
            </h1>
            <p className="text-xl text-brown-600 mb-8">최고의 원두와 감성 추천을 만나보세요</p>
      </div>
        </header>

        {/* 필터 섹션 */}
        <div className="w-full max-w-6xl mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-6">
            {/* 상단 필터 바 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {/* 검색 */}
              <div className="lg:col-span-2">
          <input
            type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-white border border-coffee-200 rounded-button px-4 py-3 text-brown-700 placeholder-brown-400 focus:outline-none focus:ring-2 focus:ring-coffee-400"
                  placeholder="🔍 원두명, 브랜드, 향미 검색..."
                />
              </div>

              {/* 브랜드 필터 */}
              <select 
                value={brandFilter} 
                onChange={e => setBrandFilter(e.target.value)} 
                className="bg-white border border-coffee-200 rounded-button px-4 py-3 text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400"
          >
                <option value="">모든 브랜드</option>
                {brands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
              </select>

              {/* 향미 필터 */}
              <select 
                value={flavorFilter} 
                onChange={e => setFlavorFilter(e.target.value)} 
                className="bg-white border border-coffee-200 rounded-button px-4 py-3 text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400"
              >
                <option value="">모든 향미</option>
                {flavors.map(flavor => <option key={flavor} value={flavor}>{flavor}</option>)}
              </select>

              {/* 배전도 필터 */}
              <select 
                value={roastFilter} 
                onChange={e => setRoastFilter(e.target.value)} 
                className="bg-white border border-coffee-200 rounded-button px-4 py-3 text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400"
              >
                <option value="">모든 배전도</option>
                {roasts.map(roast => <option key={roast} value={roast}>{roast}</option>)}
              </select>
            </div>

            {/* 정렬 및 결과 표시 */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
              <div className="flex items-center gap-4">
                <span className="text-brown-700 font-medium">정렬:</span>
                <select 
                  value={sortBy} 
                  onChange={e => setSortBy(e.target.value as "name" | "price" | "popular" | "recent")} 
                  className="bg-white border border-coffee-200 rounded-button px-4 py-2 text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400"
                >
                  <option value="popular">인기순</option>
                  <option value="name">이름순</option>
                  <option value="price">가격순</option>
                  <option value="recent">최신순</option>
                </select>
              </div>
              
              <div className="text-brown-600">
                총 <span className="font-bold text-coffee-600">{finalBeans.length}</span>개 원두
                  </div>
                </div>

            {/* 취향 기반 필터 (간소화) */}
            <details className="mb-6">
              <summary className="cursor-pointer text-coffee-600 font-medium mb-3">🎯 취향 맞춤 추천</summary>
              <div className="flex flex-wrap gap-3">
        <select 
          value={myFlavor} 
          onChange={e => setMyFlavor(e.target.value)} 
                  className="bg-white border border-coffee-200 rounded-button px-4 py-2 text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400"
        >
                  <option value="">원하는 향미</option>
          {flavors.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select 
          value={myRoast} 
          onChange={e => setMyRoast(e.target.value)} 
                  className="bg-white border border-coffee-200 rounded-button px-4 py-2 text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400"
        >
                  <option value="">원하는 배전도</option>
          {roasts.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select 
          value={myBrand} 
          onChange={e => setMyBrand(e.target.value)} 
                  className="bg-white border border-coffee-200 rounded-button px-4 py-2 text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400"
        >
                  <option value="">원하는 브랜드</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
                {(myFlavor || myRoast || myBrand) && (
          <button
                    onClick={() => {
                      setMyFlavor("");
                      setMyRoast("");
                      setMyBrand("");
                    }}
                    className="px-4 py-2 rounded-button bg-brown-200 text-brown-700 hover:bg-brown-300 transition-colors duration-200"
          >
                    초기화
          </button>
                )}
              </div>
            </details>
          </div>
        </div>

        {/* 원두 그리드 */}
        <div className="w-full max-w-6xl">
          {paginatedBeans.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-12 text-center">
              <div className="text-6xl mb-4">☕</div>
              <h3 className="text-xl font-bold text-brown-800 mb-2">검색 결과가 없습니다</h3>
              <p className="text-brown-600">다른 조건으로 검색해보세요</p>
      </div>
          ) : (
            <>
              {/* 원두 카드 그리드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {paginatedBeans.map((bean) => (
                  <div
                    key={bean.id || bean.name}
                    className="group bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-6 hover:shadow-hover hover:scale-[1.02] transition-all duration-300"
            >
                    {/* 이미지 */}
                    <div className="relative mb-4">
                      <Image
                        src={bean.image || "/beans/default.jpg"}
                        alt={bean.name}
                        width={200}
                        height={200}
                        className="w-full h-48 object-cover rounded-card"
                      />
                      
                      {/* 찜하기 버튼 */}
                      {user && (
                      <button
                          onClick={() => toggleWishlist(bean.id || bean.name)}
                          className={`absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                            wishlist.includes(bean.id || bean.name)
                              ? "bg-red-500 text-white"
                              : "bg-white/80 text-brown-600 hover:bg-red-50"
                          }`}
                      >
                          {wishlist.includes(bean.id || bean.name) ? "❤️" : "🤍"}
                      </button>
                      )}
                    </div>

                    {/* 원두 정보 */}
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-bold text-lg text-brown-800 leading-tight mb-1 group-hover:text-coffee-600 transition-colors duration-200">
                          {bean.name}
                        </h3>
                        {bean.brand && (
                          <p className="text-sm text-brown-500 font-medium">{bean.brand}</p>
                        )}
                      </div>

                      {/* 향미 태그 */}
                      <div className="flex flex-wrap gap-1">
                        {(typeof bean.flavor === 'string' ? bean.flavor.split(',') : bean.flavor || [])
                          .slice(0, 3)
                          .map((flavor, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-coffee-100 text-coffee-700 text-xs rounded-button font-medium"
                          >
                            {flavor.trim()}
                          </span>
                        ))}
                      </div>

                      {/* 배전도 */}
                      {bean.roast && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-brown-600">배전도:</span>
                          <span className="px-2 py-1 bg-brown-100 text-brown-700 text-xs rounded-button font-medium">
                            {bean.roast}
                          </span>
                        </div>
                      )}

                      {/* 가격 */}
                      <div className="text-xl font-bold text-coffee-600">
                        {bean.price}
                    </div>

                      {/* 액션 버튼들 */}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => toggleBasket(bean.id || bean.name)}
                          className={`flex-1 px-4 py-2 rounded-button font-medium transition-all duration-200 ${
                            basket.includes(bean.id || bean.name)
                              ? "bg-orange-500 text-white hover:bg-orange-600"
                              : "bg-coffee-500 text-white hover:bg-coffee-600"
                          }`}
                        >
                          {basket.includes(bean.id || bean.name) ? "🛒 담김" : "🛒 담기"}
                        </button>
                        
                        {bean.link && (
                          <button
                            onClick={() => window.open(bean.link, "_blank")}
                            className="px-4 py-2 bg-brown-500 text-white rounded-button font-medium hover:bg-brown-600 transition-all duration-200"
                          >
                            구매
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 페이지네이션 */}
      {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2">
          <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
                    className="px-4 py-2 bg-white/80 backdrop-blur-sm rounded-button text-brown-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-coffee-100 transition-all duration-200"
          >
            이전
          </button>
                  
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = i + 1;
                      return (
            <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-10 h-10 rounded-button font-medium transition-all duration-200 ${
                            currentPage === page
                              ? "bg-coffee-500 text-white"
                              : "bg-white/80 text-brown-700 hover:bg-coffee-100"
                          }`}
            >
                          {page}
            </button>
                      );
                    })}
                  </div>
                  
          <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-white/80 backdrop-blur-sm rounded-button text-brown-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-coffee-100 transition-all duration-200"
          >
            다음
          </button>
        </div>
      )}
            </>
          )}
        </div>
      </main>

      {/* 플로팅 장바구니 */}
      {basket.length > 0 && (
      <button
          onClick={() => router.push('/cart')}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 z-50"
      >
          <span className="text-2xl">🛒</span>
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
            {basket.length}
          </span>
        </button>
      )}

      {/* 드래그 가능한 플로팅 챗봇 */}
      <div
        style={{
          position: 'fixed',
          left: chatbotPosition.x || (basket.length > 0 ? 'calc(100vw - 100px)' : 'calc(100vw - 100px)'),
          top: chatbotPosition.y || (basket.length > 0 ? 'calc(100vh - 180px)' : 'calc(100vh - 100px)'),
          zIndex: 50,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        <button
          onClick={() => !isDragging && setShowChatbot(true)}
          onMouseDown={handleMouseDown}
          className="relative w-20 h-20 bg-gradient-to-br from-amber-600 via-orange-500 to-amber-700 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 group"
        >
          {/* 커피 머그컵 디자인 */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 opacity-80"></div>
          
          {/* 머그컵 몸체 */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-8 bg-gradient-to-b from-brown-600 to-brown-800 rounded-md shadow-inner">
            {/* 커피 표면 */}
            <div className="absolute top-1 left-1 right-1 h-1.5 bg-gradient-to-r from-amber-900 to-brown-900 rounded-full"></div>
            
            {/* 김 */}
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
              <div className="w-0.5 h-2 bg-white opacity-60 rounded-full animate-pulse"></div>
            </div>
            <div className="absolute -top-1.5 left-1/2 transform -translate-x-1/2 translate-x-1">
              <div className="w-0.5 h-1.5 bg-white opacity-40 rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
            </div>
            <div className="absolute -top-1.5 left-1/2 transform -translate-x-1/2 -translate-x-1">
              <div className="w-0.5 h-1.5 bg-white opacity-40 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
            </div>
          </div>
          
          {/* 머그컵 손잡이 */}
          <div className="absolute top-1/2 right-2 transform -translate-y-1/2 w-2 h-4 border-2 border-brown-700 rounded-r-full"></div>
          
          {/* AI 표시 */}
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
            AI
          </div>
          
          {/* 호버 효과 */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
        </button>
        
        {/* 안내 텍스트 */}
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-brown-600 text-center whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          드래그하여 이동
        </div>
      </div>

      {/* 챗봇 모달 */}
      {showChatbot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-card shadow-xl max-w-lg w-full max-h-[600px] overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-blue-600 text-white p-4 flex justify-between items-center">
              <h3 className="text-xl font-bold">🤖 AI 감성 추천</h3>
              <button 
                onClick={() => setShowChatbot(false)}
                className="text-white hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleGptRecommend} className="flex gap-3 mb-4">
                <input
                  type="text"
                  value={gptInput}
                  onChange={e => setGptInput(e.target.value)}
                  className="flex-1 bg-white border border-coffee-200 rounded-button px-4 py-3 text-brown-700 placeholder-brown-400 focus:outline-none focus:ring-2 focus:ring-coffee-400 focus:border-transparent"
                  placeholder="기분/날씨/취향을 입력해보세요!"
                  disabled={gptLoading}
                />
                <button
                  type="submit"
                  disabled={gptLoading || !gptInput.trim()}
                  className="px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-600 rounded-button text-white font-medium shadow-lg hover:shadow-hover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✨
                </button>
              </form>
              
              {gptLoading && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent mx-auto mb-2"></div>
                  <p className="text-brown-600">AI가 생각 중...</p>
                </div>
              )}
              {gptError && <div className="text-center text-red-600 py-4">{gptError}</div>}
              
              <div className="max-h-96 overflow-y-auto">
                {recommendations.length > 0 && (
                  <div className="space-y-4">
                    {recommendations.map((rec, idx) => {
                      const bean = getBeanDetail(rec.name);
                      return (
                        <div 
                          key={idx} 
                          className="bg-coffee-50 rounded-card p-4 border border-coffee-100 hover:shadow-lg transition-all duration-300"
                        >
                          <div className="flex gap-4 items-center">
                            <Image 
                              src={bean?.image || "/beans/default.jpg"} 
                              alt={rec.name} 
                              width={60} 
                              height={60} 
                              className="rounded-card object-cover" 
                            />
                            <div className="flex-1">
                              <h4 className="font-bold text-base text-brown-800 mb-1">{rec.name}</h4>
                              <p className="text-sm text-brown-600 mb-2">{rec.reason}</p>
                              {bean && (
                                <p className="text-coffee-600 font-bold text-sm">{bean.price}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
} 