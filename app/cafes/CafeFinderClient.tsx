"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../src/firebase";
import { collection, setDoc, deleteDoc, doc, getDocs } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import MapModal from "../components/MapModal";
import SimpleMapModal from "../components/SimpleMapModal";
import ClientOnly from "../components/ClientOnly";

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

// Cafe Card Component
function CafeCard({ cafe, onToggleWishlist, isWishlisted, onShowMap }: {
  cafe: Cafe;
  onToggleWishlist: (cafeId: string) => void;
  isWishlisted: boolean;
  onShowMap: (cafe: Cafe) => void;
}) {
  return (
    <div className="card-coffee p-4 card-hover">
      <div className="flex items-start space-x-3">
        <div className="relative">
          <img
            src={cafe.imageUrl || "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=80&h=80&fit=crop"}
            alt={cafe.name}
            className="w-16 h-16 rounded-lg object-cover"
          />
          <button
            onClick={() => onToggleWishlist(cafe.id)}
            className="absolute -top-2 -right-2 w-6 h-6 bg-coffee-gold rounded-full flex items-center justify-center text-coffee-dark hover:scale-110 transition-transform"
          >
            <span className="text-xs">
              {isWishlisted ? "❤️" : "🤍"}
            </span>
          </button>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-medium text-coffee-light">{cafe.name}</h3>
            {cafe.rating && (
              <div className="flex items-center">
                <span className="text-coffee-gold text-sm">⭐</span>
                <span className="text-sm text-coffee-light ml-1">{cafe.rating}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-coffee-light opacity-70 flex-1">
              {cafe.address}
            </p>
            <button
              onClick={() => onShowMap(cafe)}
              className="ml-2 w-8 h-8 bg-coffee-gold bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center transition-colors"
              title="지도에서 보기"
            >
              <svg className="w-4 h-4 text-coffee-gold" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          {/* Features */}
          <div className="flex flex-wrap gap-1 mb-2">
            {cafe.tags?.slice(0, 3).map((tag) => (
              <span key={tag} className="flavor-tag text-xs">
                {tag}
              </span>
            ))}
          </div>
          
          {/* Signature Menu */}
          {cafe.signature_menu && cafe.signature_menu.length > 0 && (
            <p className="text-xs text-coffee-light opacity-60">
              시그니처: {cafe.signature_menu.slice(0, 2).join(", ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export type { Cafe };
export default function CafeFinderClient({ 
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("전체");
  const [user, setUser] = useState<User | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);

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

  const handleShowMap = (cafe?: Cafe) => {
    if (typeof window === 'undefined') return;
    setSelectedCafe(cafe || null);
    setIsMapOpen(true);
  };

  const handleShowAllCafesMap = () => {
    if (typeof window === 'undefined') return;
    setSelectedCafe(null);
    setIsMapOpen(true);
  };

  // Filter cafes based on search and selected filter
  const filteredCafes = cafes.filter(cafe => {
    const matchesSearch = cafe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cafe.address.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = selectedFilter === "전체" || 
                         cafe.tags?.includes(selectedFilter) ||
                         cafe.flavor_tags?.includes(selectedFilter);
    
    return matchesSearch && matchesFilter;
  });

  return (
    <>
      <section className="p-4 pb-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-heading">내 주변 카페</h2>
          <div className="flex gap-2">
            <button 
              onClick={handleShowAllCafesMap}
              className="bg-coffee-gold text-coffee-dark px-3 py-1 rounded-lg text-sm font-medium hover:bg-opacity-90 transition-colors"
            >
              <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              지도
            </button>
            <button className="bg-coffee-gold text-coffee-dark px-3 py-1 rounded-lg text-sm font-medium hover:bg-opacity-90 transition-colors">
              <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
              </svg>
              필터
            </button>
          </div>
        </div>
        
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
                <span className="text-2xl mr-2">{weatherEmoji}</span>
                <span className="text-coffee-light font-medium">
                  {weather} 날씨에 어울리는 카페
                </span>
              </div>
              <CafeCard
                cafe={ssrTodayCafe}
                onToggleWishlist={toggleWishlist}
                isWishlisted={wishlist.includes(ssrTodayCafe.id)}
                onShowMap={handleShowMap}
              />
            </div>
          </div>
        )}

        {/* Cafe Cards */}
        <div className="space-y-4">
          {filteredCafes.length > 0 ? (
            filteredCafes.map((cafe) => (
              <CafeCard
                key={cafe.id}
                cafe={cafe}
                onToggleWishlist={toggleWishlist}
                isWishlisted={wishlist.includes(cafe.id)}
                onShowMap={handleShowMap}
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
      </section>

      {/* Map Modal */}
      <ClientOnly>
        <SimpleMapModal
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          cafes={filteredCafes}
          selectedCafe={selectedCafe}
        />
      </ClientOnly>
    </>
  );
} 