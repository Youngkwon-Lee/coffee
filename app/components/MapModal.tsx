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

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  cafes: Cafe[];
  selectedCafe?: Cafe | null;
}

declare global {
  interface Window {
    kakao: any;
  }
}

export default function MapModal({ isOpen, onClose, cafes, selectedCafe }: MapModalProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // 모달이 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setIsMapLoaded(false);
      setMapError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !mapRef.current || typeof window === 'undefined') return;

    setIsMapLoaded(false);
    setMapError(null);

    // Kakao Map 스크립트 로드
    const script = document.createElement('script');
    const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    
    // API 키가 없으면 대체 지도 표시
    if (!apiKey || apiKey === 'demo_key' || apiKey === 'your_kakao_map_api_key_here') {
      setMapError('Kakao Map API 키가 설정되지 않았습니다.');
      setIsMapLoaded(true); // 에러 상태로 로딩 완료 처리
      return;
    }

    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
    script.async = true;
    
    // 스크립트 로드 타임아웃 설정
    const timeoutId = setTimeout(() => {
      setMapError('지도 로딩 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.');
    }, 10000); // 10초 타임아웃
    
    script.onload = () => {
      clearTimeout(timeoutId);
      
      if (!window.kakao || !window.kakao.maps) {
        setMapError('Kakao Maps API를 로드할 수 없습니다. API 키를 확인해주세요.');
        return;
      }
      
      window.kakao.maps.load(() => {
        const container = mapRef.current;
        if (!container) return;

        // 지도 중심점 설정 (선택된 카페가 있으면 해당 위치, 없으면 서울 중심)
        const centerLat = selectedCafe?.lat || 37.5665;
        const centerLng = selectedCafe?.lng || 126.9780;

        const options = {
          center: new window.kakao.maps.LatLng(centerLat, centerLng),
          level: selectedCafe ? 3 : 8, // 선택된 카페가 있으면 더 확대
        };

        const map = new window.kakao.maps.Map(container, options);
        mapInstance.current = map;

        // 마커 추가
        cafes.forEach((cafe) => {
          const markerPosition = new window.kakao.maps.LatLng(cafe.lat, cafe.lng);
          
          // 마커 이미지 설정
          const imageSrc = selectedCafe?.id === cafe.id 
            ? 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png' // 선택된 카페는 빨간 마커
            : 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png'; // 일반 카페는 별 마커
          
          const imageSize = new window.kakao.maps.Size(24, 35);
          const markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize);

          const marker = new window.kakao.maps.Marker({
            position: markerPosition,
            image: markerImage,
          });

          marker.setMap(map);

          // 인포윈도우 생성
          const infowindow = new window.kakao.maps.InfoWindow({
            content: `
              <div style="padding:8px; min-width:200px;">
                <div style="font-weight:bold; color:#3b2f26; margin-bottom:4px;">${cafe.name}</div>
                <div style="font-size:12px; color:#666; margin-bottom:4px;">${cafe.address}</div>
                ${cafe.rating ? `<div style="font-size:12px; color:#c58b3c;">⭐ ${cafe.rating}</div>` : ''}
              </div>
            `,
          });

          // 마커 클릭 이벤트
          window.kakao.maps.event.addListener(marker, 'click', () => {
            infowindow.open(map, marker);
          });

          // 선택된 카페의 인포윈도우는 자동으로 열기
          if (selectedCafe?.id === cafe.id) {
            infowindow.open(map, marker);
          }
        });
        
        setIsMapLoaded(true);
      });
    };

    script.onerror = () => {
      clearTimeout(timeoutId);
      setMapError('지도 스크립트를 로드할 수 없습니다. 네트워크 연결을 확인해주세요.');
    };

    document.head.appendChild(script);

    return () => {
      clearTimeout(timeoutId);
      if (document.head.contains(script)) {
        document.head.removeChild(script);
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
            <div ref={mapRef} className="w-full h-full" />
            
            {/* Fallback Map when API key is missing */}
            {mapError && mapError.includes('API 키') && (
              <div className="absolute inset-0 bg-coffee-medium flex items-center justify-center">
                <div className="text-center w-full h-full flex flex-col">
                  <div className="flex-1 flex items-center justify-center">
                    <div className="bg-coffee-dark rounded-lg p-6 m-4">
                      <div className="text-4xl mb-4">📍</div>
                      <h3 className="text-lg font-semibold text-coffee-light mb-2">카페 목록</h3>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {cafes.slice(0, 5).map((cafe) => (
                          <div key={cafe.id} className="text-left p-2 bg-coffee-medium rounded">
                            <p className="text-sm font-medium text-coffee-light">{cafe.name}</p>
                            <p className="text-xs text-coffee-light opacity-70">{cafe.address}</p>
                            {cafe.rating && (
                              <p className="text-xs text-coffee-gold">⭐ {cafe.rating}</p>
                            )}
                          </div>
                        ))}
                        {cafes.length > 5 && (
                          <p className="text-xs text-coffee-light opacity-50">
                            외 {cafes.length - 5}개 카페
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Loading Overlay */}
            {!isMapLoaded && (
              <div className="absolute inset-0 bg-coffee-medium flex items-center justify-center">
                <div className="text-center">
                  {mapError ? (
                    <>
                      <div className="text-6xl mb-4">🗺️</div>
                      <p className="text-coffee-light opacity-70 mb-2">지도를 불러올 수 없습니다</p>
                      <p className="text-sm text-coffee-light opacity-50 mb-4">{mapError}</p>
                      {mapError.includes('API 키') && (
                        <div className="bg-coffee-dark rounded-lg p-4 text-left max-w-md">
                          <p className="text-xs text-coffee-light opacity-70 mb-2">해결 방법:</p>
                          <ol className="text-xs text-coffee-light opacity-60 space-y-1">
                            <li>1. 프로젝트 루트에 .env.local 파일 생성</li>
                            <li>2. NEXT_PUBLIC_KAKAO_MAP_KEY=your_api_key 추가</li>
                            <li>3. Kakao Developers에서 API 키 발급</li>
                            <li>4. 서버 재시작</li>
                          </ol>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="loading-spinner w-8 h-8 rounded-full mx-auto mb-4"></div>
                      <p className="text-coffee-light opacity-70">지도를 불러오는 중...</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-coffee-dark bg-opacity-90 rounded-lg p-3 backdrop-blur-sm">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span className="text-coffee-light">선택된 카페</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                <span className="text-coffee-light">일반 카페</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
} 