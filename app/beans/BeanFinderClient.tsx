"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../src/firebase";
import { collection, setDoc, deleteDoc, doc, getDocs } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import BeanDetailModal from "../components/BeanDetailModal";
import FilterDropdown from "../components/FilterDropdown";
import { normalizeRoastLevel, getRoastDisplayText } from "../../src/utils/roastMapping";
import { extractOrigin, getOriginFlag, STANDARD_ORIGINS } from "../../src/utils/originMapping";

type Bean = {
  id?: string;
  name: string | any;
  flavor: string | string[] | any;
  price: string | number | any;
  image: string | any;
  desc?: string | any;
  roast?: string | any;
  brand?: string | any;
  link?: string | any;
  category?: string | any;
  createdAt?: string | any;
  lastUpdated?: string | any;
};

// Bean Card Component
function BeanCard({ bean, onToggleWishlist, isWishlisted, onCardClick }: {
  bean: Bean;
  onToggleWishlist: (beanId: string) => void;
  isWishlisted: boolean;
  onCardClick: (bean: Bean) => void;
}) {
  const getBeanOriginFlag = (flavor: string | any) => {
    // flavor를 안전하게 문자열로 변환
    const flavorStr = typeof flavor === 'string' ? flavor : 
                     Array.isArray(flavor) ? flavor.join(' ') : 
                     flavor ? String(flavor) : '';
    
    const origin = extractOrigin(flavorStr);
    return origin ? getOriginFlag(origin) : "🌍";
  };

  const formatPrice = (price: string | number | any) => {
    if (!price) return "가격 문의";
    const priceStr = String(price);
    if (priceStr.includes("원")) return priceStr;
    return `${priceStr}원`;
  };

  return (
    <div 
      className="card-coffee p-4 card-hover h-full flex flex-col cursor-pointer"
      onClick={() => onCardClick(bean)}
    >
      <div className="relative mb-3">
        <img
          src={bean.image || "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300&h=200&fit=crop"}
          alt={bean.name}
          className="w-full h-32 rounded-lg object-cover"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist(bean.id || bean.name);
          }}
          className="absolute top-2 right-2 w-8 h-8 bg-coffee-gold rounded-full flex items-center justify-center text-coffee-dark hover:scale-110 transition-transform shadow-lg"
        >
          <span className="text-sm">
            {isWishlisted ? "❤️" : "🤍"}
          </span>
        </button>
        <div className="absolute top-2 left-2">
          <span className="text-2xl">{getBeanOriginFlag(bean.flavor)}</span>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col">
        <h3 className="font-semibold text-coffee-light mb-1 line-clamp-1">
          {bean.name || '이름 없음'}
        </h3>
        
        <p className="text-sm text-coffee-light opacity-70 mb-2">
          {bean.brand && `${bean.brand} • `}{formatPrice(bean.price)}
        </p>
        
        {/* Flavor Tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          {bean.flavor && (
            <span className="flavor-tag text-xs">
              {Array.isArray(bean.flavor) ? bean.flavor.join(', ') : bean.flavor}
            </span>
          )}
          {bean.roast && (
            <span className="flavor-tag text-xs">
              {(() => {
                const normalizedRoast = normalizeRoastLevel(bean.roast);
                return normalizedRoast ? getRoastDisplayText(normalizedRoast) : bean.roast;
              })()} 
            </span>
          )}
        </div>
        
        {/* Description */}
        {bean.desc && (
          <p className="text-xs text-coffee-light opacity-60 line-clamp-2 mt-auto">
            {typeof bean.desc === 'string' ? bean.desc : String(bean.desc)}
          </p>
        )}
      </div>
    </div>
  );
}

export default function BeanFinderClient({ beans }: { beans: Bean[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("전체");
  const [selectedOrigin, setSelectedOrigin] = useState<string>("전체");
  const [selectedRoast, setSelectedRoast] = useState<string>("전체");
  const [user, setUser] = useState<User | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [selectedBean, setSelectedBean] = useState<Bean | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 동적으로 필터 옵션 생성
  const generateFilterOptions = (field: keyof Bean, label: string) => {
    const safeString = (value: any) => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) return value.join(' ');
      return String(value);
    };

    const counts: { [key: string]: number } = {};
    const uniqueValues = new Set<string>();

    beans.forEach(bean => {
      const value = safeString(bean[field]).trim();
      if (value) {
        // 여러 값이 쉼표나 공백으로 구분되어 있을 수 있음
        const values = value.split(/[,\s]+/).filter(v => v.length > 0);
        values.forEach(v => {
          const cleanValue = v.trim();
          if (cleanValue && cleanValue !== '전체') { // '전체' 중복 방지
            uniqueValues.add(cleanValue);
            counts[cleanValue] = (counts[cleanValue] || 0) + 1;
          }
        });
      }
    });

    const options = [
      { value: "전체", label: "전체", count: beans.length }
    ];

    // 중복 제거된 값들을 정렬하여 추가
    Array.from(uniqueValues)
      .sort()
      .forEach(value => {
        // 이미 존재하는지 한번 더 확인
        if (!options.some(opt => opt.value === value)) {
          options.push({
            value,
            label: value,
            count: counts[value]
          });
        }
      });

    return options;
  };

  // 필터 옵션들
  const brandOptions = generateFilterOptions('brand', '브랜드');
  const originOptions = (() => {
    const counts: { [key: string]: number } = {};
    
    beans.forEach(bean => {
      const flavorStr = typeof bean.flavor === 'string' ? bean.flavor : 
                       Array.isArray(bean.flavor) ? bean.flavor.join(' ') : 
                       bean.flavor ? String(bean.flavor) : '';
      
      // 원산지 추출 유틸리티 사용
      const origin = extractOrigin(flavorStr);
      if (origin) {
        counts[origin] = (counts[origin] || 0) + 1;
      }
    });

    return [
      { value: "전체", label: "전체", count: beans.length },
      ...STANDARD_ORIGINS.filter(origin => counts[origin] > 0).map(origin => ({
        value: origin,
        label: `${getOriginFlag(origin)} ${origin}`,
        count: counts[origin]
      }))
    ];
  })();
  
  const roastOptions = (() => {
    const counts: { [key: string]: number } = {};
    
    beans.forEach(bean => {
      if (bean.roast) {
        const normalizedRoast = normalizeRoastLevel(bean.roast);
        if (normalizedRoast) {
          counts[normalizedRoast] = (counts[normalizedRoast] || 0) + 1;
        }
      }
    });

    return [
      { value: "전체", label: "전체", count: beans.length },
      ...Object.entries(counts).map(([roast, count]) => ({
        value: roast,
        label: getRoastDisplayText(roast as any),
        count
      }))
    ];
  })();

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

  // Filter beans based on search and selected filters
  const filteredBeans = beans.filter(bean => {
    // 안전한 문자열 변환 함수
    const safeString = (value: any) => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) return value.join(' ');
      return String(value);
    };
    
    const searchLower = searchTerm.toLowerCase();
    
    // 검색어 매칭
    const matchesSearch = searchTerm === "" || 
                         safeString(bean.name).toLowerCase().includes(searchLower) ||
                         safeString(bean.brand).toLowerCase().includes(searchLower) ||
                         safeString(bean.flavor).toLowerCase().includes(searchLower) ||
                         safeString(bean.desc).toLowerCase().includes(searchLower);
    
    // 브랜드 필터
    const matchesBrand = selectedBrand === "전체" || 
                        safeString(bean.brand).toLowerCase().includes(selectedBrand.toLowerCase());
    
    // 원산지 필터 (향미 필드에서 확인)
    const matchesOrigin = selectedOrigin === "전체" || (() => {
      const flavorStr = safeString(bean.flavor);
      const origin = extractOrigin(flavorStr);
      return origin === selectedOrigin;
    })();
    
    // 로스팅 필터
    const matchesRoast = selectedRoast === "전체" || (() => {
      const normalizedRoast = normalizeRoastLevel(bean.roast);
      return normalizedRoast === selectedRoast;
    })();
    
    return matchesSearch && matchesBrand && matchesOrigin && matchesRoast;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredBeans.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBeans = filteredBeans.slice(indexOfFirstItem, indexOfLastItem);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBrand, selectedOrigin, selectedRoast]);

  // Modal handlers
  const handleCardClick = (bean: Bean) => {
    setSelectedBean(bean);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedBean(null);
  };

  // 필터 초기화
  const resetFilters = () => {
    setSearchTerm("");
    setSelectedBrand("전체");
    setSelectedOrigin("전체");
    setSelectedRoast("전체");
    setCurrentPage(1);
  };

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
      
      {/* Filter Dropdowns */}
      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <FilterDropdown
            label="브랜드"
            options={brandOptions}
            selectedValue={selectedBrand}
            onSelect={setSelectedBrand}
            placeholder="브랜드 선택"
          />
          <FilterDropdown
            label="원산지"
            options={originOptions}
            selectedValue={selectedOrigin}
            onSelect={setSelectedOrigin}
            placeholder="원산지 선택"
          />
          <FilterDropdown
            label="로스팅"
            options={roastOptions}
            selectedValue={selectedRoast}
            onSelect={setSelectedRoast}
            placeholder="로스팅 선택"
          />
        </div>
        
        {/* Filter Reset Button */}
        {(selectedBrand !== "전체" || selectedOrigin !== "전체" || selectedRoast !== "전체" || searchTerm !== "") && (
          <div className="flex justify-end">
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm bg-coffee-medium text-coffee-light border border-coffee-gold border-opacity-50 rounded-lg hover:bg-coffee-gold hover:text-coffee-dark transition-colors"
            >
              필터 초기화
            </button>
          </div>
        )}
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
              onCardClick={handleCardClick}
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

      {/* Bean Detail Modal */}
      <BeanDetailModal
        bean={selectedBean}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onToggleWishlist={toggleWishlist}
        isWishlisted={selectedBean ? wishlist.includes(selectedBean.id || selectedBean.name) : false}
      />
    </section>
  );
} 