"use client";
import { useState } from "react";
import LazyImage from "./LazyImage";
import { getCafeImageByLocation } from "../utils/imageService";

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

interface CafeDetailModalProps {
  cafe: Cafe;
  isOpen: boolean;
  onClose: () => void;
  onToggleWishlist: (cafeId: string) => void;
  isWishlisted: boolean;
}

const FLAVOR_ICON: { [key: string]: string } = { 
  "Floral": "🌸", "Fruity": "🍑", "Sweet": "🍯", "Nutty": "🥜", 
  "Chocolate": "🍫", "Earthy": "🌱", "Herbal": "🌿", "Smoky": "🔥", 
  "Juicy": "🍹", "Bitter": "☕", "Bright": "✨", "Balanced": "⚖️" 
};

const FEATURE_ICON: { [key: string]: string } = {
  laptop_friendly: "💻",
  quiet: "🔇", 
  sunny: "☀️",
  dessert: "🧁",
  instagrammable: "📸"
};

export default function CafeDetailModal({ 
  cafe, 
  isOpen, 
  onClose, 
  onToggleWishlist, 
  isWishlisted 
}: CafeDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'menu' | 'beans'>('info');

  if (!isOpen) return null;

  const handlePurchase = () => {
    // 구매하기 기능 구현
    if (cafe.website) {
      window.open(cafe.website, '_blank');
    } else {
      // 기본 검색 링크
      const searchQuery = encodeURIComponent(`${cafe.name} 커피 온라인 주문`);
      window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank');
    }
  };

  const handleCall = () => {
    if (cafe.phone) {
      window.location.href = `tel:${cafe.phone}`;
    }
  };

  const handleDirection = () => {
    const query = encodeURIComponent(cafe.address);
    window.open(`https://maps.google.com/maps?q=${query}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-coffee-dark rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="relative">
          <LazyImage
            src={cafe.imageUrl || getCafeImageByLocation(cafe.name, cafe.address)}
            alt={cafe.name}
            width={400}
            height={200}
            className="w-full h-48 object-cover"
          />
          <div className="absolute top-4 right-4 flex space-x-2">
            <button
              onClick={() => onToggleWishlist(cafe.id)}
              className="w-10 h-10 bg-black bg-opacity-50 rounded-full flex items-center justify-center backdrop-blur-sm"
            >
              <span className="text-xl">
                {isWishlisted ? "❤️" : "🤍"}
              </span>
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-black bg-opacity-50 rounded-full flex items-center justify-center backdrop-blur-sm"
            >
              <span className="text-white text-xl">×</span>
            </button>
          </div>
          {/* 이미지 소스 표시 */}
          {!cafe.imageUrl && (
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
              AI 생성 이미지
            </div>
          )}
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-12rem)]">
          {/* 카페 기본 정보 */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold text-coffee-light">{cafe.name}</h2>
              {cafe.rating && (
                <div className="flex items-center">
                  <span className="text-coffee-gold text-lg">⭐</span>
                  <span className="text-lg text-coffee-light ml-1">{cafe.rating}</span>
                </div>
              )}
            </div>
            
            <p className="text-coffee-medium mb-4">{cafe.address}</p>
            
            {cafe.description && (
              <p className="text-coffee-light mb-4">{cafe.description}</p>
            )}

            {/* 탭 네비게이션 */}
            <div className="flex border-b border-coffee-medium mb-4">
              <button
                className={`px-4 py-2 ${activeTab === 'info' ? 'text-coffee-gold border-b-2 border-coffee-gold' : 'text-coffee-medium'}`}
                onClick={() => setActiveTab('info')}
              >
                정보
              </button>
              <button
                className={`px-4 py-2 ${activeTab === 'menu' ? 'text-coffee-gold border-b-2 border-coffee-gold' : 'text-coffee-medium'}`}
                onClick={() => setActiveTab('menu')}
              >
                메뉴
              </button>
              <button
                className={`px-4 py-2 ${activeTab === 'beans' ? 'text-coffee-gold border-b-2 border-coffee-gold' : 'text-coffee-medium'}`}
                onClick={() => setActiveTab('beans')}
              >
                원두
              </button>
            </div>

            {/* 탭 컨텐츠 */}
            {activeTab === 'info' && (
              <div className="space-y-4">
                {/* 운영시간 */}
                {cafe.operatingHours && (
                  <div>
                    <h4 className="font-medium text-coffee-light mb-2">⏰ 운영시간</h4>
                    <p className="text-coffee-medium">{cafe.operatingHours}</p>
                  </div>
                )}

                {/* 특징 */}
                {cafe.features && (
                  <div>
                    <h4 className="font-medium text-coffee-light mb-2">✨ 특징</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(cafe.features).map(([key, value]) => 
                        value && (
                          <span key={key} className="bg-coffee-medium px-3 py-1 rounded-full text-sm text-coffee-light">
                            {FEATURE_ICON[key]} {key === 'laptop_friendly' ? '노트북 가능' : 
                              key === 'quiet' ? '조용함' : 
                              key === 'sunny' ? '채광 좋음' : 
                              key === 'dessert' ? '디저트' : 
                              key === 'instagrammable' ? '포토존' : key}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* 태그 */}
                {cafe.tags && cafe.tags.length > 0 && (
                  <div>
                    <h4 className="font-medium text-coffee-light mb-2">#️⃣ 태그</h4>
                    <div className="flex flex-wrap gap-2">
                      {cafe.tags.map((tag, index) => (
                        <span key={index} className="bg-coffee-gold bg-opacity-20 text-coffee-gold px-2 py-1 rounded text-sm">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'menu' && (
              <div className="space-y-4">
                {/* 시그니처 메뉴 */}
                {cafe.signature_menu && cafe.signature_menu.length > 0 && (
                  <div>
                    <h4 className="font-medium text-coffee-light mb-2">☕ 시그니처 메뉴</h4>
                    <div className="space-y-2">
                      {cafe.signature_menu.map((menu, index) => (
                        <div key={index} className="bg-coffee-medium p-3 rounded-lg">
                          <span className="text-coffee-light">{menu}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'beans' && (
              <div className="space-y-4">
                {/* 플레이버 태그 */}
                {cafe.flavor_tags && cafe.flavor_tags.length > 0 && (
                  <div>
                    <h4 className="font-medium text-coffee-light mb-2">🌟 플레이버 프로필</h4>
                    <div className="flex flex-wrap gap-2">
                      {cafe.flavor_tags.map((flavor, index) => (
                        <span key={index} className="bg-coffee-gold bg-opacity-20 text-coffee-gold px-3 py-1 rounded-full text-sm">
                          {FLAVOR_ICON[flavor] || '☕'} {flavor}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 메인 플레이버 */}
                {cafe.flavor_main && (
                  <div>
                    <h4 className="font-medium text-coffee-light mb-2">🎯 주요 플레이버</h4>
                    <div className="bg-coffee-medium p-3 rounded-lg">
                      <span className="text-coffee-light text-lg">
                        {FLAVOR_ICON[cafe.flavor_main] || '☕'} {cafe.flavor_main}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 하단 액션 버튼들 */}
        <div className="p-4 border-t border-coffee-medium bg-coffee-darker">
          <div className="grid grid-cols-3 gap-3">
            {cafe.phone && (
              <button
                onClick={handleCall}
                className="bg-coffee-medium text-coffee-light py-3 px-4 rounded-lg hover:bg-coffee-light hover:text-coffee-dark transition-colors"
              >
                📞 전화
              </button>
            )}
            <button
              onClick={handleDirection}
              className="bg-coffee-medium text-coffee-light py-3 px-4 rounded-lg hover:bg-coffee-light hover:text-coffee-dark transition-colors"
            >
              🗺️ 길찾기
            </button>
            <button
              onClick={handlePurchase}
              className="bg-coffee-gold text-coffee-dark py-3 px-4 rounded-lg hover:bg-yellow-400 transition-colors font-medium"
            >
              🛒 구매하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}