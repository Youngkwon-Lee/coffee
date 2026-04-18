"use client";
import { useState, useEffect, useMemo, memo } from "react";
import { db, auth } from "@/firebase";
import LazyImage from "../components/LazyImage";
import CafeDetailModal from "../components/CafeDetailModal";
import { getCafeImageByLocation } from "../utils/imageService";
import { collection, setDoc, deleteDoc, doc, getDocs } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import GoogleMapView from './GoogleMapView';
import Link from "next/link";

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

const BRAND_DOMAIN_MAP: { keyword: string; domain: string }[] = [
  { keyword: "블루보틀", domain: "bluebottlecoffee.com" },
  { keyword: "blue bottle", domain: "bluebottlecoffee.com" },
  { keyword: "bluebottle", domain: "bluebottlecoffee.com" },
  { keyword: "앤쓰러사이트", domain: "anthracitecoffee.com" },
  { keyword: "anthracite", domain: "anthracitecoffee.com" },
  { keyword: "커피리브레", domain: "coffeelibre.kr" },
  { keyword: "coffeelibre", domain: "coffeelibre.kr" },
  { keyword: "센터커피", domain: "centercoffee.co.kr" },
  { keyword: "center coffee", domain: "centercoffee.co.kr" },
  { keyword: "centercoffee", domain: "centercoffee.co.kr" },
  { keyword: "디폴트밸류", domain: "defaultvalue.co.kr" },
  { keyword: "디폴트벨류", domain: "defaultvalue.co.kr" },
  { keyword: "defaultvalue", domain: "defaultvalue.co.kr" },
];

function getBrandLogoUrl(cafe: Cafe): string | null {
  const source = `${cafe.name} ${cafe.website || ""}`.toLowerCase();
  const found = BRAND_DOMAIN_MAP.find((item) => source.includes(item.keyword));
  if (!found) return null;
  return `https://www.google.com/s2/favicons?domain=${found.domain}&sz=128`;
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
  const brandLogoUrl = getBrandLogoUrl(cafe);

  return (
    <div 
      className="card-coffee card-hover cursor-pointer overflow-hidden"
      onClick={onClick}
    >
      {/* 이미지 섹션 */}
      <div className="relative">
        <LazyImage
          src={cafe.imageUrl || getCafeImageByLocation(cafe.name, cafe.address)}
          alt={cafe.name}
          width={400}
          height={300}
          className="w-full h-56 object-cover"
          priority={false}
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {brandLogoUrl && (
          <div className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-white/95 p-1 shadow-md border border-black/10">
            <img
              src={brandLogoUrl}
              alt={`${cafe.name} 로고`}
              className="w-full h-full object-contain rounded-full"
            />
          </div>
        )}
        {/* 이미지 소스 표시 */}
        {!cafe.imageUrl && (
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
            AI 생성
          </div>
        )}
        {/* 위시리스트 버튼 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist(cafe.id);
          }}
          className="absolute top-2 right-2 w-8 h-8 bg-black bg-opacity-50 rounded-full flex items-center justify-center backdrop-blur-sm"
        >
          <span className="text-sm">
            {isWishlisted ? "❤️" : "🤍"}
          </span>
        </button>
        {/* 평점 배지 */}
        {cafe.rating && (
          <div className="absolute top-2 left-2 bg-coffee-gold bg-opacity-90 px-2 py-1 rounded-full flex items-center">
            <span className="text-coffee-dark text-xs">⭐ {cafe.rating}</span>
          </div>
        )}
      </div>
      
      {/* 콘텐츠 섹션 */}
      <div className="p-5">
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-coffee-light text-xl">{cafe.name}</h3>
            {brandLogoUrl && (
              <img
                src={brandLogoUrl}
                alt={`${cafe.name} 로고`}
                className="w-6 h-6 rounded-full bg-white p-0.5 border border-black/10"
              />
            )}
          </div>
          <p className="text-coffee-medium mb-3 line-clamp-1">
            {cafe.address}
          </p>
        </div>
        
        {/* 설명 (있을 경우) */}
        {cafe.description && (
          <p className="text-sm text-coffee-light opacity-80 mb-3 line-clamp-2">
            {cafe.description}
          </p>
        )}
        
        {/* 특징 태그 */}
        <div className="flex flex-wrap gap-1 mb-3">
          {cafe.tags?.slice(0, 4).map((tag) => (
            <span key={tag} className="flavor-tag text-xs">
              {tag}
            </span>
          ))}
        </div>
        
        {/* 시그니처 메뉴 */}
        {cafe.signature_menu && cafe.signature_menu.length > 0 && (
          <div className="border-t border-coffee-medium pt-3">
            <p className="text-xs text-coffee-medium mb-1">시그니처 메뉴</p>
            <p className="text-sm text-coffee-light">
              {cafe.signature_menu.slice(0, 2).join(", ")}
              {cafe.signature_menu.length > 2 && ` 외 ${cafe.signature_menu.length - 2}개`}
            </p>
          </div>
        )}
      </div>
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
    <section className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-heading">내 주변 카페</h2>
        <button className="bg-coffee-gold text-coffee-dark px-3 py-1 rounded-lg text-sm font-medium hover:bg-opacity-90 transition-colors">
          <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
          </svg>
          필터
        </button>
      </div>

      {!user && (
        <div className="mb-5 bg-coffee-medium/70 border border-coffee-gold/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-coffee-light">비회원 모드로 탐색 중</div>
            <div className="text-xs text-coffee-light/70">찜 저장/개인화 추천은 로그인 후 사용할 수 있어요.</div>
          </div>
          <Link href="/login" className="inline-flex items-center px-3 py-2 rounded-lg text-sm bg-coffee-gold/20 border border-coffee-gold/40 text-coffee-gold">
            로그인하고 이어서 사용
          </Link>
        </div>
      )}

      {/* Search Bar - CoffeeTrackr Style */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="카페명 또는 지역 검색"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <svg className="search-icon" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
      </div>

      {/* Filter Chips */}
      <div className="flex space-x-2 mb-6 overflow-x-auto">
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
        <div className="mb-6">
          <h3 className="section-heading text-lg">오늘의 추천 카페</h3>
            <div className="card-coffee p-4 border-l-4 border-coffee-gold">
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-2">{recommendationEmoji}</span>
                <span className="text-coffee-light font-medium">
                  {recommendationLabel}
                </span>
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
        <div className="flex justify-between items-center mb-4 text-sm text-coffee-medium">
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
          <div className="empty-state">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <p className="empty-state-title">검색 결과가 없습니다</p>
            <p className="empty-state-subtitle">다른 검색어나 필터를 시도해보세요</p>
          </div>
        )}
      </div>

      {/* Pagination - Mobile Responsive */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-1 sm:space-x-2 mt-8 px-4">
          {/* Previous Button */}
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              currentPage === 1
                ? 'bg-coffee-medium text-coffee-light opacity-50 cursor-not-allowed'
                : 'bg-coffee-medium text-coffee-light hover:bg-coffee-light hover:text-coffee-dark'
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
                  className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    currentPage === i
                      ? 'bg-coffee-gold text-coffee-dark'
                      : 'bg-coffee-medium text-coffee-light hover:bg-coffee-light hover:text-coffee-dark'
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
            className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              currentPage === totalPages
                ? 'bg-coffee-medium text-coffee-light opacity-50 cursor-not-allowed'
                : 'bg-coffee-medium text-coffee-light hover:bg-coffee-light hover:text-coffee-dark'
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
    </section>
  );
} 
