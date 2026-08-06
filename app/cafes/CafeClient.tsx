"use client";
import { useState, useEffect, useMemo, memo } from "react";
import { db, auth } from "@/firebase";
import LazyImage from "../components/LazyImage";
import CafeDetailModal from "../components/CafeDetailModal";
import { getCafeImageByLocation } from "../utils/imageService";
import { collection, setDoc, deleteDoc, doc, getDocs } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import MapModal from '../components/MapModal';
import Link from "next/link";
import { Heart, Star, Search, SlidersHorizontal, MapPin, Sparkles, Compass, Store, ChevronRight, ChevronDown, Map as MapIcon } from "lucide-react";

// Cafe 인터페이스
interface Cafe {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  tags?: string[];
  flavor?: string;
  menu?: string;
  imageUrl?: string;
  rating?: number;
  signature_menu?: string[];
  flavor_tags?: string[];
  flavor_main?: string;
  description?: string;
  phone?: string;
  website?: string;
  /** Google Places ID. 정책상 무기한 저장이 허용되는 유일한 값이라 이것만 담는다. */
  googlePlaceId?: string;
  operatingHours?: string;
  features?: {
    laptop_friendly?: boolean;
    quiet?: boolean;
    sunny?: boolean;
    dessert?: boolean;
    instagrammable?: boolean;
  };
  crawlConfig?: {
    enabled: boolean;
    successRate: number;
    crawlInterval: number;
    lastCrawled?: string;
  };
  createdAt?: string;
  lastUpdated?: string;
}

const BRAND_PHOTO_MAP: { keyword: string; imageUrl: string }[] = [
  { keyword: "블루보틀", imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1600&h=1100&fit=crop&auto=format&q=85" },
  { keyword: "bluebottle", imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1600&h=1100&fit=crop&auto=format&q=85" },
  { keyword: "앤쓰러사이트", imageUrl: "https://images.unsplash.com/photo-1461988625982-7e46a099bf4f?w=1600&h=1100&fit=crop&auto=format&q=85" },
  { keyword: "anthracite", imageUrl: "https://images.unsplash.com/photo-1461988625982-7e46a099bf4f?w=1600&h=1100&fit=crop&auto=format&q=85" },
  { keyword: "커피리브레", imageUrl: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=1600&h=1100&fit=crop&auto=format&q=85" },
  { keyword: "coffeelibre", imageUrl: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=1600&h=1100&fit=crop&auto=format&q=85" },
  { keyword: "센터커피", imageUrl: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1600&h=1100&fit=crop&auto=format&q=85" },
  { keyword: "centercoffee", imageUrl: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1600&h=1100&fit=crop&auto=format&q=85" },
  { keyword: "디폴트밸류", imageUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1600&h=1100&fit=crop&auto=format&q=85" },
  { keyword: "디폴트벨류", imageUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1600&h=1100&fit=crop&auto=format&q=85" },
  { keyword: "defaultvalue", imageUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1600&h=1100&fit=crop&auto=format&q=85" },
];

function getBrandPhotoUrl(cafe: Cafe): string | null {
  const source = `${cafe.name} ${cafe.website || ""}`.toLowerCase();
  const found = BRAND_PHOTO_MAP.find((item) => source.includes(item.keyword));
  return found?.imageUrl || null;
}

const FLAVOR_OPTIONS = ["Floral", "Chocolate", "Nutty", "Fruity", "Earthy", "Sweet"];
const TAGS_ICON: { [key: string]: string } = { "조용함": "🔇", "채광 좋음": "☀️", "노트북 가능": "💻", "로스터리": "🔥", "테이스팅룸": "🧑‍🔬", "한옥": "🏯", "모던": "🏢", "빈티지": "📻", "공장 리모델링": "🏭", "포토존": "📸", "베이커리": "🥐", "성당 느낌": "⛪" };
const MENU_ICON: { [key: string]: string } = { "에스프레소": "☕", "드립커피": "🫖", "콜드브루": "🧊", "플로럴 블렌드": "🌸", "프렌치프레스": "🥄", "크루아상": "🥐", "베이커리 플래터": "🍞", "티라미수": "🍰", "라떼": "🥛", "시그니처 음료": "⭐" };
const FLAVOR_ICON: { [key: string]: string } = { "Floral": "🌸", "Fruity": "🍑", "Sweet": "🍯", "Nutty": "🥜", "Chocolate": "🍫", "Earthy": "🌱", "Herbal": "🌿", "Smoky": "🔥", "Juicy": "🍹", "Bitter": "☕", "Bright": "✨", "Balanced": "⚖️" };

function getRandomElement<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Cafe Card Component - Grid Layout Optimized & Memoized
const CafeCard = memo(function CafeCard({ cafe, onToggleWishlist, isWishlisted, onClick }: {
  cafe: Cafe;
  onToggleWishlist: (cafeId: string) => void;
  isWishlisted: boolean;
  onClick: () => void;
}) {
  const brandPhotoUrl = getBrandPhotoUrl(cafe);
  const fallbackSrc = cafe.imageUrl || brandPhotoUrl || getCafeImageByLocation(cafe.name, cafe.address);

  // 자체 수집 이미지가 없고 place_id가 있으면 Google 사진을 표시 시점에 받아온다.
  // 사진 URL은 저장하지 않는다(Places 정책). 실패하면 조용히 폴백으로 남는다.
  const [googlePhoto, setGooglePhoto] = useState<{ uri: string; author?: string } | null>(null);
  useEffect(() => {
    if (cafe.imageUrl || !cafe.googlePlaceId) return;
    let alive = true;
    fetch(`/api/cafe-photo?placeId=${encodeURIComponent(cafe.googlePlaceId)}&w=800`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.photoUri) {
          setGooglePhoto({ uri: d.photoUri, author: d.attributions?.[0]?.displayName });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [cafe.imageUrl, cafe.googlePlaceId]);

  const imageSrc = googlePhoto?.uri || fallbackSrc;

  return (
    <div 
      className="card-coffee card-hover cursor-pointer overflow-hidden flex flex-col justify-between"
      onClick={onClick}
    >
      <div>
        {/* 이미지 섹션 */}
        <div className="relative">
          <LazyImage
            src={imageSrc}
            alt={cafe.name}
            width={400}
            height={300}
            className="w-full h-56 object-cover"
            priority={false}
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          {/* 이미지 출처 표시.
              Google 사진은 저작자 표시가 정책상 의무라 이름을 함께 노출한다. */}
          {!cafe.imageUrl && (
            <div className="absolute bottom-2 left-2 max-w-[85%] truncate bg-[#120f0d]/80 backdrop-blur-sm text-coffee-light/80 text-[10px] px-2 py-0.5 rounded border border-white/5 font-semibold">
              {googlePhoto
                ? `Google${googlePhoto.author ? ` · ${googlePhoto.author}` : ''}`
                : brandPhotoUrl
                  ? '브랜드 추천'
                  : 'AI 생성'}
            </div>
          )}
          {/* 위시리스트 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist(cafe.id);
            }}
            className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm border transition-all duration-300 ${
              isWishlisted
                ? "bg-red-500/20 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                : "bg-[#1c1816]/80 border-white/5 text-coffee-light/60 hover:text-red-400 hover:border-red-400/30"
            }`}
          >
            <Heart className="w-3.5 h-3.5" fill={isWishlisted ? "currentColor" : "none"} strokeWidth={1.8} />
          </button>
          {/* 평점 배지 */}
          {cafe.rating && (
            <div className="absolute top-2 left-2 bg-[#120f0d]/85 border border-[#c5a880]/20 px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm">
              <Star className="w-3 h-3 text-[#c5a880] fill-current" strokeWidth={1.5} />
              <span className="text-[#c5a880] text-xs font-semibold">{cafe.rating}</span>
            </div>
          )}
        </div>
        
        {/* 콘텐츠 섹션 */}
        <div className="p-5">
          <div className="mb-3">
            <h3 className="font-bold text-[#f8f6f3] text-xl mb-1 truncate">{cafe.name}</h3>
            <p className="text-coffee-light/50 text-xs mt-1 flex items-center gap-1 truncate">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-[#c5a880]/70" strokeWidth={1.5} />
              <span>{cafe.address}</span>
            </p>
          </div>
          
          {/* 설명 (있을 경우) */}
          {cafe.description && (
            <p className="text-xs text-coffee-light/60 mb-3.5 line-clamp-2 leading-relaxed">
              {cafe.description}
            </p>
          )}
          
          {/* 특징 태그 */}
          <div className="flex flex-wrap gap-1 mb-3">
            {cafe.tags?.slice(0, 4).map((tag) => (
              <span key={tag} className="flavor-tag text-[10px] font-semibold">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      
      {/* 시그니처 메뉴 */}
      {cafe.signature_menu && cafe.signature_menu.length > 0 && (
        <div className="px-5 pb-5 pt-3 border-t border-white/5">
          <p className="text-[10px] text-coffee-light/40 font-semibold mb-1 uppercase tracking-wider">시그니처 메뉴</p>
          <p className="text-sm text-coffee-light/85 font-medium truncate">
            {cafe.signature_menu.slice(0, 2).join(", ")}
            {cafe.signature_menu.length > 2 && ` 외 ${cafe.signature_menu.length - 2}개`}
          </p>
        </div>
      )}
    </div>
  );
});

export type { Cafe };
export default function CafeClient({ 
  weather, 
  weatherEmoji, 
  cafes, 
  todayCafe: ssrTodayCafe, 
  userPreferenceDefault 
}: { 
  weather: string;
  weatherEmoji: string;
  cafes: Cafe[];
  todayCafe: Cafe | null;
  userPreferenceDefault: string;
}) {
  const isWeatherFallback = ["알 수 없음", "API키 없음", "날씨 불러오기 실패", "위치 정보 없음", "위치 미지원", "로딩중..."].includes(weather);
  const recommendationLabel = isWeatherFallback ? "오늘 어울리는 카페" : `${weather} 날씨에 어울리는 카페`;
  const recommendationEmoji = isWeatherFallback ? "☕" : weatherEmoji;

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("전체");
  const [user, setUser] = useState<User | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(9); // 더 크게 보이도록 9개로 조정

  const filters = ["전체", "조용함", "노트북 가능", "채광 좋음", "베이커리", "로스터리"];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setWishlist([]);
      return;
    }
    const fetchWishlist = async () => {
      try {
        const snap = await getDocs(collection(db, `users/${user.uid}/favorites`));
        setWishlist(snap.docs.map(doc => doc.id));
      } catch (error) {
        console.error("위시리스트 로드 실패:", error);
      }
    };
    fetchWishlist();
  }, [user]);

  const toggleWishlist = async (cafeId: string) => {
    if (!user) return;
    
    try {
      const ref = doc(db, `users/${user.uid}/favorites`, cafeId);
      if (wishlist.includes(cafeId)) {
        await deleteDoc(ref);
        setWishlist(wishlist.filter(id => id !== cafeId));
      } else {
        await setDoc(ref, { addedAt: new Date() });
        setWishlist([...wishlist, cafeId]);
      }
    } catch (error) {
      console.error("위시리스트 업데이트 실패:", error);
    }
  };

  const handleCafeClick = (cafe: Cafe) => {
    setSelectedCafe(cafe);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCafe(null);
  };

  // Filter cafes based on search and selected filter - Memoized
  const [showMap, setShowMap] = useState(false);

  const filteredCafes = useMemo(() => {
    return cafes.filter(cafe => {
      const matchesSearch = cafe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           cafe.address.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = selectedFilter === "전체" || 
                           cafe.tags?.includes(selectedFilter) ||
                           cafe.flavor_tags?.includes(selectedFilter);
      
      return matchesSearch && matchesFilter;
    });
  }, [cafes, searchTerm, selectedFilter]);

  // Pagination logic - Memoized
  const { totalPages, indexOfLastItem, indexOfFirstItem, currentCafes } = useMemo(() => {
    const totalPages = Math.ceil(filteredCafes.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentCafes = filteredCafes.slice(indexOfFirstItem, indexOfLastItem);
    
    return { totalPages, indexOfLastItem, indexOfFirstItem, currentCafes };
  }, [filteredCafes, currentPage, itemsPerPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFilter]);

  return (
    <section className="p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-heading text-[#f8f6f3] text-xl tracking-tight">내 주변 카페</h2>
        <div className="flex items-center gap-2">
          {/* 지도 보기. MapModal은 이미 구현돼 있었는데 어디서도 렌더되지 않았다.
              카카오맵 키가 없으면 모달이 목록 형태로 폴백한다. */}
          <button
            onClick={() => setShowMap(true)}
            className="bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#c5a880]/30 transition-all text-[#c5a880] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
          >
            <MapIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>지도</span>
          </button>
          <button className="bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#c5a880]/30 transition-all text-[#c5a880] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>상세 필터</span>
          </button>
        </div>
      </div>

      {!user && (
        <div className="mb-5 bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-coffee-light/95">비회원 모드로 탐색 중</div>
            <div className="text-xs text-coffee-light/60 mt-0.5">찜 저장/개인화 추천은 로그인 후 사용할 수 있어요.</div>
          </div>
          <Link href="/login" className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#c5a880]/10 border border-[#c5a880]/20 text-[#c5a880] hover:bg-[#c5a880]/20 transition-colors whitespace-nowrap">
            로그인하고 이어서 사용
          </Link>
        </div>
      )}

      {/* Search Bar - CoffeeTrackr Style */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="카페명 또는 지역 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <Search className="search-icon w-5 h-5" strokeWidth={1.5} />
      </div>

      {/* Filter Chips */}
      <div className="flex space-x-2 mb-6 overflow-x-auto pb-1">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`filter-chip ${selectedFilter === filter ? 'active' : 'inactive'}`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Today's Recommendation */}
      {ssrTodayCafe && (
        <div className="mb-8">
          <h3 className="section-heading text-lg flex items-center gap-2 mt-2">
            <Sparkles className="w-4.5 h-4.5 text-[#c5a880]" strokeWidth={1.5} />
            <span>오늘의 추천 카페</span>
          </h3>
          <div className="card-coffee p-4 border-l-2 border-[#c5a880] mt-2">
            <div className="flex items-center gap-2 mb-3 text-[#f8f6f3]/90 text-sm font-semibold">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#c5a880]/15 text-[#c5a880]">
                <Compass className="w-3.5 h-3.5" strokeWidth={1.8} />
              </span>
              <span>{recommendationLabel}</span>
            </div>
            <CafeCard
              cafe={ssrTodayCafe}
              onToggleWishlist={toggleWishlist}
              isWishlisted={wishlist.includes(ssrTodayCafe.id)}
              onClick={() => handleCafeClick(ssrTodayCafe)}
            />
          </div>
        </div>
      )}

      {/* Results Info */}
      {filteredCafes.length > 0 && (
        <div className="flex justify-between items-center mb-4 text-xs font-semibold text-coffee-light/40">
          <span>
            총 {filteredCafes.length}개 카페 중 {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredCafes.length)}개 표시
          </span>
          <span>
            {currentPage} / {totalPages} 페이지
          </span>
        </div>
      )}

      {/* Cafe Cards - Responsive Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {currentCafes.length > 0 ? (
          currentCafes.map((cafe) => (
            <CafeCard
              key={cafe.id}
              cafe={cafe}
              onToggleWishlist={toggleWishlist}
              isWishlisted={wishlist.includes(cafe.id)}
              onClick={() => handleCafeClick(cafe)}
            />
          ))
        ) : (
          <div className="empty-state card-coffee py-12">
            <Store className="w-12 h-12 text-coffee-light/20 mx-auto mb-4" strokeWidth={1.2} />
            <p className="empty-state-title text-[#f8f6f3] font-semibold text-lg">검색 결과가 없습니다</p>
            <p className="empty-state-subtitle text-xs text-coffee-light/50 font-medium">다른 검색어나 필터를 시도해보세요</p>
          </div>
        )}
      </div>

      {/* Pagination - Mobile Responsive */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-1.5 sm:space-x-2 mt-8 px-4">
          {/* Previous Button */}
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-300 ${
              currentPage === 1
                ? 'bg-white/[0.01] text-coffee-light/30 border border-white/5 opacity-50 cursor-not-allowed'
                : 'bg-white/5 border border-white/10 text-coffee-light hover:bg-[#c5a880]/15 hover:border-[#c5a880]/30 hover:text-[#c5a880]'
            }`}
          >
            이전
          </button>

          {/* Page Numbers */}
          {(() => {
            const pageNumbers = [];
            const maxVisiblePages = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            
            if (endPage - startPage + 1 < maxVisiblePages) {
              startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }

            for (let i = startPage; i <= endPage; i++) {
              pageNumbers.push(
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${
                    currentPage === i
                      ? 'bg-[#c5a880] text-[#120f0d] border border-[#c5a880]/30'
                      : 'bg-white/5 border border-white/10 text-coffee-light hover:bg-[#c5a880]/15 hover:border-[#c5a880]/30 hover:text-[#c5a880]'
                  }`}
                >
                  {i}
                </button>
              );
            }
            return pageNumbers;
          })()}

          {/* Next Button */}
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-300 ${
              currentPage === totalPages
                ? 'bg-white/[0.01] text-coffee-light/30 border border-white/5 opacity-50 cursor-not-allowed'
                : 'bg-white/5 border border-white/10 text-coffee-light hover:bg-[#c5a880]/15 hover:border-[#c5a880]/30 hover:text-[#c5a880]'
            }`}
          >
            다음
          </button>
        </div>
      )}

      {/* 카페 상세보기 모달 */}
      {selectedCafe && (
        <CafeDetailModal
          cafe={selectedCafe}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onToggleWishlist={toggleWishlist}
          isWishlisted={wishlist.includes(selectedCafe.id)}
        />
      )}
    {/* 지도 모달. 좌표가 있는 카페만 넘긴다 — 좌표 없는 문서는 지도에 찍을 수 없다. */}
      <MapModal
        isOpen={showMap}
        onClose={() => setShowMap(false)}
        cafes={filteredCafes
          .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
          .map((c) => ({
            id: c.id,
            name: c.name,
            address: c.address,
            lat: c.lat,
            lng: c.lng,
            imageUrl: c.imageUrl,
            rating: c.rating,
          }))}
      />

    </section>
  );
} 
