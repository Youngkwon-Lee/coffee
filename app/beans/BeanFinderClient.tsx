"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../src/firebase";
import { collection, setDoc, deleteDoc, doc, getDocs } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

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
  createdAt?: string;
  lastUpdated?: string;
};

// Bean Card Component
function BeanCard({ bean, onToggleWishlist, isWishlisted }: {
  bean: Bean;
  onToggleWishlist: (beanId: string) => void;
  isWishlisted: boolean;
}) {
  const getOriginFlag = (flavor: string) => {
    const origins: { [key: string]: string } = {
      "에티오피아": "🇪🇹",
      "콜롬비아": "🇨🇴", 
      "과테말라": "🇬🇹",
      "브라질": "🇧🇷",
      "자메이카": "🇯🇲",
      "케냐": "🇰🇪",
      "코스타리카": "🇨🇷",
      "페루": "🇵🇪",
      "인도네시아": "🇮🇩",
      "니카라과": "🇳🇮",
      "온두라스": "🇭🇳",
      "파나마": "🇵🇦"
    };
    
    for (const [origin, flag] of Object.entries(origins)) {
      if (flavor?.toLowerCase().includes(origin.toLowerCase())) return flag;
    }
    return "🌍";
  };

  const formatPrice = (price: string | number | any) => {
    if (!price) return "가격 문의";
    const priceStr = String(price);
    if (priceStr.includes("원")) return priceStr;
    return `${priceStr}원`;
  };

  return (
    <div className="card-coffee p-4 card-hover h-full flex flex-col">
      <div className="relative mb-3">
        <img
          src={bean.image || "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300&h=200&fit=crop"}
          alt={bean.name}
          className="w-full h-32 rounded-lg object-cover"
        />
        <button
          onClick={() => onToggleWishlist(bean.id || bean.name)}
          className="absolute top-2 right-2 w-8 h-8 bg-coffee-gold rounded-full flex items-center justify-center text-coffee-dark hover:scale-110 transition-transform shadow-lg"
        >
          <span className="text-sm">
            {isWishlisted ? "❤️" : "🤍"}
          </span>
        </button>
        <div className="absolute top-2 left-2">
          <span className="text-2xl">{getOriginFlag(bean.flavor)}</span>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col">
        <h3 className="font-semibold text-coffee-light mb-1 line-clamp-1">
          {bean.name}
        </h3>
        
        <p className="text-sm text-coffee-light opacity-70 mb-2">
          {bean.brand && `${bean.brand} • `}{formatPrice(bean.price)}
        </p>
        
        {/* Flavor Tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          <span className="flavor-tag text-xs">
            {bean.flavor}
          </span>
          {bean.roast && (
            <span className="flavor-tag text-xs">
              {bean.roast}
            </span>
          )}
        </div>
        
        {/* Description */}
        {bean.desc && (
          <p className="text-xs text-coffee-light opacity-60 line-clamp-2 mt-auto">
            {bean.desc}
          </p>
        )}
      </div>
    </div>
  );
}

export default function BeanFinderClient({ beans }: { beans: Bean[] }) {
  const [selectedOrigin, setSelectedOrigin] = useState<string>("전체");
  const [searchTerm, setSearchTerm] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);

  const origins = ["전체", "에티오피아", "콜롬비아", "과테말라", "브라질", "자메이카", "케냐", "코스타리카", "페루", "인도네시아"];

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
        const snap = await getDocs(collection(db, `users/${user.uid}/bean_favorites`));
        setWishlist(snap.docs.map(doc => doc.id));
      } catch (error) {
        console.error("원두 위시리스트 로드 실패:", error);
      }
    };
    fetchWishlist();
  }, [user]);

  const toggleWishlist = async (beanId: string) => {
    if (!user) return;
    
    try {
      const ref = doc(db, `users/${user.uid}/bean_favorites`, beanId);
      if (wishlist.includes(beanId)) {
        await deleteDoc(ref);
        setWishlist(wishlist.filter(id => id !== beanId));
      } else {
        await setDoc(ref, { addedAt: new Date() });
        setWishlist([...wishlist, beanId]);
      }
    } catch (error) {
      console.error("원두 위시리스트 업데이트 실패:", error);
    }
  };

  // Filter beans based on search and selected origin
  const filteredBeans = beans.filter(bean => {
    const matchesSearch = searchTerm === "" || 
                         bean.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bean.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bean.flavor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bean.desc?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesOrigin = selectedOrigin === "전체" || 
                         bean.flavor?.toLowerCase().includes(selectedOrigin.toLowerCase()) ||
                         bean.name?.toLowerCase().includes(selectedOrigin.toLowerCase()) ||
                         bean.category?.toLowerCase().includes(selectedOrigin.toLowerCase());
    
    return matchesSearch && matchesOrigin;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredBeans.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBeans = filteredBeans.slice(indexOfFirstItem, indexOfLastItem);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedOrigin]);

  return (
    <section className="p-4">
      <h2 className="section-heading">원두 탐색</h2>
      
      {/* Search Bar */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="원두명, 브랜드, 향미 검색"
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
        {origins.map((origin) => (
          <button
            key={origin}
            onClick={() => setSelectedOrigin(origin)}
            className={`filter-chip ${selectedOrigin === origin ? 'active' : 'inactive'}`}
          >
            {origin}
          </button>
        ))}
      </div>

      {/* Results count */}
      <div className="mb-4 flex justify-between items-center">
        <p className="text-sm text-coffee-light opacity-70">
          총 {filteredBeans.length}개의 원두가 있습니다
        </p>
        {totalPages > 1 && (
          <p className="text-sm text-coffee-light opacity-70">
            {currentPage} / {totalPages} 페이지
          </p>
        )}
      </div>

      {/* Bean Cards Grid - Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {currentBeans.length > 0 ? (
          currentBeans.map((bean) => (
            <BeanCard
              key={bean.id || bean.name}
              bean={bean}
              onToggleWishlist={toggleWishlist}
              isWishlisted={wishlist.includes(bean.id || bean.name)}
            />
          ))
        ) : (
          <div className="col-span-full empty-state">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <p className="empty-state-title">해당 조건의 원두가 없습니다</p>
            <p className="empty-state-subtitle">다른 검색어나 필터를 시도해보세요</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mb-20">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded-lg bg-coffee-medium text-coffee-light disabled:opacity-50 disabled:cursor-not-allowed hover:bg-coffee-gold hover:text-coffee-dark transition-colors"
          >
            이전
          </button>
          
          {/* Page Numbers */}
          <div className="flex space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNumber;
              if (totalPages <= 5) {
                pageNumber = i + 1;
              } else if (currentPage <= 3) {
                pageNumber = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNumber = totalPages - 4 + i;
              } else {
                pageNumber = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`px-3 py-2 rounded-lg transition-colors ${
                    currentPage === pageNumber
                      ? 'bg-coffee-gold text-coffee-dark'
                      : 'bg-coffee-medium text-coffee-light hover:bg-coffee-gold hover:text-coffee-dark'
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 rounded-lg bg-coffee-medium text-coffee-light disabled:opacity-50 disabled:cursor-not-allowed hover:bg-coffee-gold hover:text-coffee-dark transition-colors"
          >
            다음
          </button>
        </div>
      )}
    </section>
  );
} 