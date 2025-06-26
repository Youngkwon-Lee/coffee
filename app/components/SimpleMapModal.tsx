"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Cafe {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  rating?: number;
}

interface SimpleMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  cafes: Cafe[];
  selectedCafe?: Cafe | null;
}

declare global {
  interface Window {
    L: any;
  }
}

export default function SimpleMapModal({ isOpen, onClose, cafes, selectedCafe }: SimpleMapModalProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // 모달이 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setIsMapLoaded(false);
      setMapError(null);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !mapRef.current || typeof window === 'undefined') return;

    setIsMapLoaded(false);
    setMapError(null);

    // Leaflet.js 스크립트 로드 (무료 OpenStreetMap)
    const loadLeaflet = async () => {
      try {
        // CSS 로드
        if (!document.querySelector('link[href*="leaflet"]')) {
          const cssLink = document.createElement('link');
          cssLink.rel = 'stylesheet';
          cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(cssLink);
        }

        // JS 로드
        if (!window.L) {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.async = true;
          
          script.onload = () => {
            initializeMap();
          };
          
          script.onerror = () => {
            setMapError('지도 라이브러리를 로드할 수 없습니다.');
          };
          
          document.head.appendChild(script);
        } else {
          initializeMap();
        }
      } catch (error) {
        setMapError('지도를 초기화할 수 없습니다.');
      }
    };

    const initializeMap = () => {
      try {
        const container = mapRef.current;
        if (!container || mapInstance.current) return;

        // 지도 중심점 설정
        const centerLat = selectedCafe?.lat || 37.5665;
        const centerLng = selectedCafe?.lng || 126.9780;

        // 지도 생성
        const map = window.L.map(container).setView([centerLat, centerLng], selectedCafe ? 15 : 11);
        mapInstance.current = map;

        // OpenStreetMap 타일 레이어 추가
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // 마커 추가
        cafes.forEach((cafe) => {
          // 마커 색상 설정
          const isSelected = selectedCafe?.id === cafe.id;
          const markerColor = isSelected ? 'red' : 'blue';
          
          // 커스텀 마커 아이콘
          const customIcon = window.L.divIcon({
            className: 'custom-marker',
            html: `<div style="
              background-color: ${markerColor};
              width: 20px;
              height: 20px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          const marker = window.L.marker([cafe.lat, cafe.lng], { icon: customIcon }).addTo(map);

          // 팝업 내용
          const popupContent = `
            <div style="padding: 8px; min-width: 200px;">
              <div style="font-weight: bold; color: #3b2f26; margin-bottom: 4px; font-size: 14px;">${cafe.name}</div>
              <div style="font-size: 12px; color: #666; margin-bottom: 4px;">${cafe.address}</div>
              ${cafe.rating ? `<div style="font-size: 12px; color: #c58b3c;">⭐ ${cafe.rating}</div>` : ''}
            </div>
          `;

          marker.bindPopup(popupContent);

          // 선택된 카페의 팝업은 자동으로 열기
          if (selectedCafe?.id === cafe.id) {
            marker.openPopup();
          }
        });

        setIsMapLoaded(true);
      } catch (error) {
        setMapError('지도를 생성할 수 없습니다.');
      }
    };

    loadLeaflet();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [isOpen, cafes, selectedCafe]);

  if (!isOpen || typeof window === 'undefined') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-coffee-dark rounded-2xl w-full max-w-4xl h-[80vh] max-h-[600px] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-coffee-medium">
            <div>
              <h2 className="text-xl font-bold text-coffee-light">카페 지도</h2>
              <p className="text-sm text-coffee-light opacity-70">
                {selectedCafe ? `${selectedCafe.name} 위치` : `총 ${cafes.length}개 카페`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-coffee-medium hover:bg-coffee-gold hover:text-coffee-dark transition-colors flex items-center justify-center text-coffee-light"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Map Container */}
          <div className="relative h-full">
            <div ref={mapRef} className="w-full h-full bg-green-100">
              {isMapLoaded && (
                <div className="w-full h-full bg-gradient-to-br from-green-300 to-blue-300 relative">
                  {/* 간단한 지도 시뮬레이션 */}
                  <div className="absolute inset-0 bg-gray-200 opacity-30"></div>
                  <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 bg-green-200 rounded-lg opacity-50"></div>
                  <div className="absolute top-1/3 right-1/4 w-1/3 h-1/3 bg-blue-200 rounded-full opacity-50"></div>
                  
                  {/* 카페 마커들 */}
                  {cafes.slice(0, 10).map((cafe, index) => {
                    const isSelected = selectedCafe?.id === cafe.id;
                    const left = 20 + (index % 5) * 15;
                    const top = 20 + Math.floor(index / 5) * 30;
                    
                    return (
                      <div
                        key={cafe.id}
                        className={`absolute w-4 h-4 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all hover:scale-110 ${
                          isSelected ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                        style={{ left: `${left}%`, top: `${top}%` }}
                        title={cafe.name}
                      >
                        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-white rounded px-2 py-1 text-xs shadow-lg opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          <div className="font-semibold">{cafe.name}</div>
                          <div className="text-gray-600 text-xs">{cafe.address}</div>
                          {cafe.rating && <div className="text-yellow-600">⭐ {cafe.rating}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Loading Overlay */}
            {!isMapLoaded && (
              <div className="absolute inset-0 bg-coffee-medium flex items-center justify-center">
                <div className="text-center">
                  <div className="loading-spinner w-8 h-8 rounded-full mx-auto mb-4"></div>
                  <p className="text-coffee-light opacity-70">지도를 불러오는 중...</p>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          {isMapLoaded && (
            <div className="absolute bottom-4 left-4 bg-coffee-dark bg-opacity-90 rounded-lg p-3 backdrop-blur-sm">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                  <span className="text-coffee-light">선택된 카페</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                  <span className="text-coffee-light">일반 카페</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
} 