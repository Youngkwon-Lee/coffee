"use client";
import { useState, useEffect } from "react";
import LazyImage from "../components/LazyImage";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { getBeanImageByOrigin } from "../utils/imageService";
import { collection, getDocs, setDoc, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "@/firebase";
import Fuse from "fuse.js";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { Coffee, Search, SlidersHorizontal, Heart, ShoppingCart, RefreshCw, Sparkles, Filter, ChevronDown } from "lucide-react";

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

  // 무한 스크롤 적용
  const { displayedItems: displayedBeans, hasMore, isLoading, resetItems } = useInfiniteScroll({
    items: finalBeans,
    initialItemsPerPage: 12
  });

  // 필터 변경 시 무한 스크롤 초기화
  useEffect(() => {
    resetItems();
  }, [search, brandFilter, flavorFilter, roastFilter, sortBy, myFlavor, myRoast, myBrand, resetItems]);

  return (
    <div className="min-h-screen bg-coffee-dark relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-[#c5a880]/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-[#a88c74]/5 rounded-full blur-3xl"></div>
      </div>

      <main className="relative z-10 container mx-auto px-4 py-8 max-w-7xl pb-24">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#c5a880]/10 border border-[#c5a880]/20 mb-3">
            <Coffee className="w-6 h-6 text-[#c5a880]" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-[#f8f6f3] mb-2 tracking-tight">
            원두 컬렉션
          </h1>
          <p className="text-coffee-light/60 text-sm font-medium">전 세계의 다양한 원두를 탐색해보세요</p>
        </div>

        {!user && (
          <div className="mb-6 bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-coffee-light/90">비회원 모드로 둘러보는 중</div>
              <div className="text-xs text-coffee-light/60 mt-0.5">저장/찜/개인화 추천은 로그인 후 사용할 수 있어요.</div>
            </div>
            <Link href="/login" className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#c5a880]/10 border border-[#c5a880]/20 text-[#c5a880] hover:bg-[#c5a880]/20 transition-all">
              로그인하고 이어서 사용
            </Link>
          </div>
        )}

        {/* Search and Filters */}
        <div className="card-coffee p-6 mb-8">
          {/* Search Bar */}
          <div className="search-bar mb-4">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input"
              placeholder="원두명, 브랜드, 향미 검색..."
            />
            <Search className="search-icon w-5 h-5" strokeWidth={1.5} />
          </div>

          {/* Collapsible Filters */}
          <details className="mb-4 group">
            <summary className="cursor-pointer text-[#c5a880] font-semibold mb-3 bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all px-4 py-3 rounded-xl flex items-center justify-between list-none">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
                <span>상세 필터</span>
              </div>
              <ChevronDown className="w-4 h-4 transition-transform duration-300 group-open:rotate-180" strokeWidth={1.8} />
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-1">
              {/* Brand Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-coffee-light/50 font-medium ml-1">브랜드</label>
                <select 
                  value={brandFilter} 
                  onChange={e => setBrandFilter(e.target.value)} 
                  className="input-coffee w-full text-sm"
                >
                  <option value="">모든 브랜드</option>
                  {brands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                </select>
              </div>

              {/* Flavor Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-coffee-light/50 font-medium ml-1">향미</label>
                <select 
                  value={flavorFilter} 
                  onChange={e => setFlavorFilter(e.target.value)} 
                  className="input-coffee w-full text-sm"
                >
                  <option value="">모든 향미</option>
                  {flavors.map(flavor => <option key={flavor} value={flavor}>{flavor}</option>)}
                </select>
              </div>

              {/* Roast Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-coffee-light/50 font-medium ml-1">배전도</label>
                <select 
                  value={roastFilter} 
                  onChange={e => setRoastFilter(e.target.value)} 
                  className="input-coffee w-full text-sm"
                >
                  <option value="">모든 배전도</option>
                  {roasts.map(roast => <option key={roast} value={roast}>{roast}</option>)}
                </select>
              </div>
            </div>
          </details>

          {/* Sort and Results */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2 border-t border-white/5">
            <div className="flex items-center gap-4">
              <span className="text-coffee-light/60 text-sm font-medium">정렬:</span>
              <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value as "name" | "price" | "popular" | "recent")} 
                className="input-coffee text-sm py-1.5"
              >
                <option value="popular">인기순</option>
                <option value="name">이름순</option>
                <option value="price">가격순</option>
                <option value="recent">최신순</option>
              </select>
            </div>
            
            <div className="text-coffee-light/60 text-sm">
              총 <span className="font-bold text-[#c5a880]">{finalBeans.length}</span>개 원두
              {displayedBeans.length < finalBeans.length && (
                <span className="text-coffee-light/40 ml-2">
                  ({displayedBeans.length}개 표시 중)
                </span>
              )}
            </div>
          </div>

          {/* Preference Filters */}
          <details className="mt-4 group">
            <summary className="cursor-pointer text-[#c5a880] font-semibold flex items-center justify-between py-2 border-t border-white/5 list-none">
              <div className="flex items-center gap-2 mt-2">
                <Sparkles className="w-4 h-4 text-[#c5a880]" strokeWidth={1.5} />
                <span>취향 맞춤 추천</span>
              </div>
              <ChevronDown className="w-4 h-4 mt-2 transition-transform duration-300 group-open:rotate-180" strokeWidth={1.8} />
            </summary>
            <div className="flex flex-wrap gap-3 pt-3 p-1">
              <select 
                value={myFlavor} 
                onChange={e => setMyFlavor(e.target.value)} 
                className="input-coffee text-sm"
              >
                <option value="">원하는 향미</option>
                {flavors.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <select 
                value={myRoast} 
                onChange={e => setMyRoast(e.target.value)} 
                className="input-coffee text-sm"
              >
                <option value="">원하는 배전도</option>
                {roasts.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select 
                value={myBrand} 
                onChange={e => setMyBrand(e.target.value)} 
                className="input-coffee text-sm"
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
                  className="btn-secondary px-4 py-2 text-xs"
                >
                  필터 초기화
                </button>
              )}
            </div>
          </details>
        </div>

        {/* Beans Grid */}
        <div className="w-full">
          {displayedBeans.length === 0 ? (
            <div className="card-coffee p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                <Coffee className="w-6 h-6 text-coffee-light/30" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-[#f8f6f3] mb-2">검색 결과가 없습니다</h3>
              <p className="text-coffee-light/60 text-sm font-medium">다른 조건으로 검색해보세요</p>
            </div>
          ) : (
            <>
              {/* Bean Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {displayedBeans.map((bean) => (
                  <motion.div
                    key={bean.id || bean.name}
                    whileHover={{ scale: 1.01, y: -4 }}
                    className="card-coffee p-5 group flex flex-col justify-between"
                  >
                    <div>
                      {/* Image */}
                      <div className="relative mb-4 overflow-hidden rounded-xl bg-white/[0.01] border border-white/5">
                        <LazyImage
                          src={bean.image && bean.image.startsWith('http') 
                            ? bean.image 
                            : bean.image 
                              ? `/beans/${bean.image}` 
                              : getBeanImageByOrigin(bean.name, bean.brand)
                          }
                          alt={bean.name}
                          width={200}
                          height={200}
                          className="w-full h-48 object-cover group-hover:scale-[1.03] transition-transform duration-500"
                        />
                        
                        {/* Wishlist Button */}
                        {user && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWishlist(bean.id || bean.name);
                            }}
                            className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-sm border transition-all duration-300 ${
                              wishlist.includes(bean.id || bean.name)
                                ? "bg-red-500/20 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                                : "bg-[#1c1816]/80 border-white/5 text-coffee-light/60 hover:text-red-400 hover:border-red-400/30"
                            }`}
                          >
                            <Heart className="w-4 h-4" fill={wishlist.includes(bean.id || bean.name) ? "currentColor" : "none"} strokeWidth={1.8} />
                          </button>
                        )}
                      </div>

                      {/* Bean Info */}
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-bold text-lg text-[#f8f6f3] leading-tight mb-1 group-hover:text-[#c5a880] transition-colors duration-300 truncate">
                            {bean.name}
                          </h3>
                          {bean.brand && (
                            <p className="text-xs text-coffee-light/50 font-semibold uppercase tracking-wider">{bean.brand}</p>
                          )}
                        </div>

                        {/* Flavor Tags */}
                        <div className="flex flex-wrap gap-1">
                          {(typeof bean.flavor === 'string' ? bean.flavor.split(',') : bean.flavor || [])
                            .slice(0, 3)
                            .map((flavor, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-white/5 border border-white/10 text-coffee-light/80 text-[10px] rounded-md font-semibold"
                            >
                              {flavor.trim()}
                            </span>
                          ))}
                        </div>

                        {/* Roast Level */}
                        {bean.roast && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-coffee-light/45 font-medium">배전도</span>
                            <span className="px-2 py-0.5 bg-[#c5a880]/10 border border-[#c5a880]/15 text-[#c5a880] text-[10px] rounded-md font-semibold">
                              {bean.roast}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 mt-4 pt-3 border-t border-white/5">
                      {/* Price */}
                      <div className="text-xl font-bold text-[#c5a880] tracking-tight">
                        {bean.price}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBasket(bean.id || bean.name);
                          }}
                          className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-1.5 ${
                            basket.includes(bean.id || bean.name)
                              ? "bg-[#c5a880]/20 border border-[#c5a880]/30 text-[#c5a880]"
                              : "bg-white/5 border border-white/10 text-[#f8f6f3] hover:bg-[#c5a880]/15 hover:border-[#c5a880]/30 hover:text-[#c5a880]"
                          }`}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" strokeWidth={1.5} />
                          <span>{basket.includes(bean.id || bean.name) ? "담김 (제거)" : "장바구니"}</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Infinite Scroll Loading Indicator */}
              {isLoading && (
                <div className="flex justify-center items-center py-8">
                  <div className="flex items-center gap-3 text-coffee-light/60">
                    <RefreshCw className="animate-spin w-5 h-5 text-[#c5a880]" strokeWidth={1.8} />
                    <span className="text-sm font-medium">더 많은 원두를 불러오는 중...</span>
                  </div>
                </div>
              )}
              
              {/* End of list indicator */}
              {!hasMore && displayedBeans.length > 0 && (
                <div className="flex justify-center items-center py-10">
                  <div className="text-center text-coffee-light/40">
                    <Coffee className="w-8 h-8 text-[#c5a880]/40 mx-auto mb-2" strokeWidth={1.2} />
                    <p className="text-xs font-semibold">모든 원두를 다 보여드렸어요!</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
} 