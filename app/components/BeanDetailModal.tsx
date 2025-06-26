"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink, Heart, Star, Coffee } from "lucide-react";
import { normalizeRoastLevel, getRoastDisplayText } from "../../src/utils/roastMapping";
import { extractOrigin, getOriginFlag } from "../../src/utils/originMapping";

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

interface BeanDetailModalProps {
  bean: Bean | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleWishlist: (beanId: string) => void;
  isWishlisted: boolean;
}

export default function BeanDetailModal({
  bean,
  isOpen,
  onClose,
  onToggleWishlist,
  isWishlisted
}: BeanDetailModalProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !bean) return null;

  const getBeanOriginFlag = (flavor: string | any) => {
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

  const handlePurchase = () => {
    if (bean.link) {
      window.open(bean.link, '_blank', 'noopener,noreferrer');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-coffee-dark rounded-2xl shadow-2xl border border-coffee-medium">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-coffee-dark border-b border-coffee-medium">
          <h2 className="text-lg font-semibold text-coffee-light">원두 상세정보</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-coffee-medium transition-colors"
          >
            <X className="w-5 h-5 text-coffee-light" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Image and Basic Info */}
          <div className="flex flex-col space-y-4 mb-6">
            <div className="relative">
              <img
                src={imageError ? "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=300&fit=crop" : bean.image}
                alt={bean.name || '원두'}
                className="w-full h-48 object-cover rounded-lg"
                onError={() => setImageError(true)}
              />
              <div className="absolute top-3 left-3 text-3xl">
                {getBeanOriginFlag(bean.flavor)}
              </div>
              <button
                onClick={() => onToggleWishlist(bean.id || bean.name)}
                className="absolute top-3 right-3 p-2 bg-coffee-dark bg-opacity-80 rounded-full hover:scale-110 transition-transform"
              >
                <Heart 
                  className={`w-5 h-5 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-coffee-light'}`} 
                />
              </button>
            </div>

            <div>
              <h3 className="text-xl font-bold text-coffee-light mb-2">
                {bean.name || '이름 없음'}
              </h3>
              
              {bean.brand && (
                <p className="text-coffee-gold text-sm font-medium mb-2">
                  {bean.brand}
                </p>
              )}
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold text-coffee-light">
                  {formatPrice(bean.price)}
                </span>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star 
                      key={star} 
                      className="w-4 h-4 fill-coffee-gold text-coffee-gold" 
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Flavor Information */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-coffee-light mb-3 flex items-center">
              <Coffee className="w-4 h-4 mr-2" />
              향미 특성
            </h4>
            <div className="flex flex-wrap gap-2">
              {bean.flavor && (
                <span className="flavor-tag">
                  {Array.isArray(bean.flavor) ? bean.flavor.join(', ') : bean.flavor}
                </span>
              )}
              {bean.roast && (
                <span className="flavor-tag">
                  {(() => {
                    const normalizedRoast = normalizeRoastLevel(bean.roast);
                    return normalizedRoast ? getRoastDisplayText(normalizedRoast) : bean.roast;
                  })()}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          {bean.desc && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-coffee-light mb-3">
                상세 설명
              </h4>
              <p className="text-coffee-light opacity-80 text-sm leading-relaxed">
                {typeof bean.desc === 'string' ? bean.desc : String(bean.desc)}
              </p>
            </div>
          )}

          {/* Additional Info */}
          <div className="mb-6 space-y-3">
            {bean.category && (
              <div className="flex justify-between text-sm">
                <span className="text-coffee-light opacity-70">카테고리</span>
                <span className="text-coffee-light">{bean.category}</span>
              </div>
            )}
            {bean.createdAt && (
              <div className="flex justify-between text-sm">
                <span className="text-coffee-light opacity-70">등록일</span>
                <span className="text-coffee-light">
                  {new Date(bean.createdAt).toLocaleDateString('ko-KR')}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={() => onToggleWishlist(bean.id || bean.name)}
              className="flex-1 btn-secondary flex items-center justify-center space-x-2"
            >
              <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
              <span>{isWishlisted ? '찜 해제' : '찜하기'}</span>
            </button>
            
            {bean.link && (
              <button
                onClick={handlePurchase}
                className="flex-2 btn-primary flex items-center justify-center space-x-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>구매하기</span>
              </button>
            )}
          </div>

          {!bean.link && (
            <div className="mt-3 p-3 bg-coffee-medium rounded-lg">
              <p className="text-coffee-light opacity-70 text-sm text-center">
                구매 링크가 제공되지 않은 상품입니다
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}