"use client";

import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../../src/firebase";
import { collection, query, orderBy, limit, getDocs, where } from "firebase/firestore";
import Link from "next/link";
import { motion } from "framer-motion";
import EmailReportModal from './EmailReportModal';
import SearchBar from './SearchBar';
import OfflineIndicator from './OfflineIndicator';
import ErrorBoundary from './ErrorBoundary';

interface Bean {
  id: string;
  name: string;
  brand: string;
  price: string;
  origin?: string;
  flavor?: string;
  image?: string;
  views?: number;
  likes?: number;
}

interface CoffeeRecord {
  id: string;
  beanName: string;
  flavor: string;
  rating: number;
  brewMethod: string;
  createdAt: string;
  imageUrl?: string;
}

export default function MainPageHero() {
  const [user] = useAuthState(auth);
  const [popularBeans, setPopularBeans] = useState<Bean[]>([]);
  const [recentRecords, setRecentRecords] = useState<CoffeeRecord[]>([]);
  const [personalizedRecommendations, setPersonalizedRecommendations] = useState<Bean[]>([]);
  const [todayStats, setTodayStats] = useState({
    recordsCount: 0,
    avgRating: 0,
    favoriteMethod: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);

  useEffect(() => {
    loadMainPageData();
  }, [user]);

  async function loadMainPageData() {
    try {
      setIsLoading(true);
      
      // 인기 원두 로드 (조회수/좋아요 기준)
      const beansQuery = query(
        collection(db, "beans"),
        orderBy("views", "desc"),
        limit(6)
      );
      const beansSnapshot = await getDocs(beansQuery);
      const beans = beansSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        views: doc.data().views || Math.floor(Math.random() * 1000),
        likes: doc.data().likes || Math.floor(Math.random() * 100)
      })) as Bean[];
      setPopularBeans(beans);

      if (user) {
        // 사용자 최근 기록 로드
        const recordsQuery = query(
          collection(db, "users", user.uid, "coffee_records"),
          orderBy("createdAt", "desc"),
          limit(8)
        );
        const recordsSnapshot = await getDocs(recordsQuery);
        const records = recordsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CoffeeRecord[];
        setRecentRecords(records);

        // 개인화 추천 (사용자 취향 기반)
        setPersonalizedRecommendations(beans.slice(0, 3));

        // 오늘의 통계
        const today = new Date().toISOString().split('T')[0];
        const todayRecords = records.filter(r => 
          r.createdAt?.startsWith(today)
        );
        
        setTodayStats({
          recordsCount: todayRecords.length,
          avgRating: todayRecords.length > 0 
            ? todayRecords.reduce((sum, r) => sum + r.rating, 0) / todayRecords.length 
            : 0,
          favoriteMethod: todayRecords.length > 0 
            ? todayRecords[0].brewMethod 
            : ''
        });
      }

    } catch (error) {
      console.error("메인페이지 데이터 로드 실패:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "좋은 아침이에요! ☀️";
    if (hour < 18) return "좋은 오후에요! ⛅";
    return "좋은 저녁이에요! 🌙";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-50 via-coffee-50 to-cream-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-coffee-500 border-t-transparent rounded-full mx-auto mb-6"></div>
          <p className="text-brown-600 text-lg">커피 여정을 준비하고 있어요...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-coffee-50 to-cream-100 relative">
      <OfflineIndicator />
      
      <div className="container mx-auto px-4 pt-20 pb-16 max-w-7xl">
        
        {/* 🎯 메인 히어로 섹션 - 현대적 디자인 */}
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="max-w-4xl mx-auto">
            {/* 메인 타이틀 */}
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-7xl font-black bg-gradient-to-r from-brown-800 via-coffee-700 to-brown-800 bg-clip-text text-transparent mb-6 leading-tight"
              >
              Coffee Journey
              </motion.h1>
              
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl md:text-2xl text-brown-600 mb-8 font-light"
            >
              AI로 분석하는 나만의 커피 이야기
            </motion.p>

            {/* 메인 사진촬영 액션 - 가장 큰 영역 */}
              <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-coffee-500 via-coffee-600 to-brown-500 rounded-3xl p-12 text-white shadow-2xl relative overflow-hidden group mb-12 max-w-3xl mx-auto"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="text-7xl mb-6">📸</div>
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl md:text-5xl font-black mb-4"
                >
                  사진으로 분석하기
                </motion.h2>
                <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                  className="text-white/90 text-xl mb-8 leading-relaxed"
                >
                  커피백이나 카페 메뉴판을 찍어보세요<br/>
                  AI가 즉시 커피 정보를 분석해드릴게요
                </motion.p>
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowPhotoOptions(true)}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-8 py-4 rounded-2xl font-bold text-xl transition-all duration-300 border-2 border-white/30 hover:border-white/50"
                >
                  사진으로 분석하기 →
                </motion.button>
              </div>
            </motion.div>

            {/* 날씨 기반 추천 - 미니멀한 디자인 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-xl max-w-2xl mx-auto mb-12"
            >
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/80 rounded-full shadow-sm">
                  <span className="text-2xl">☁️</span>
                  <span className="text-brown-700 font-medium">흐림</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/80 rounded-full shadow-sm">
                  <span className="text-2xl">🌸</span>
                  <span className="text-brown-700 font-medium">Floral</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-full shadow-sm">
                  <span className="text-xl">🗺️</span>
                  <span className="font-medium">테라로사</span>
                </div>
              </div>
              <p className="text-brown-600 mt-4 text-center">
                오늘 같은 날씨에는 <span className="font-semibold text-coffee-600">Floral</span>한 분위기가 어울려요
              </p>
            </motion.div>

            {/* 검색바 - 현대적인 디자인 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
                className="max-w-2xl mx-auto"
              >
                <SearchBar 
                  placeholder="원두, 카페, 브랜드를 검색해보세요..."
                  onSearch={(query) => {
                    window.location.href = `/search?q=${encodeURIComponent(query)}`;
                  }}
                />
              </motion.div>
            </div>
        </motion.section>

        {/* 🚀 서브 액션 카드들 - 2x2 그리드 (작은 크기) */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mb-20"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-brown-800 mb-2">더 많은 기능들</h2>
            <p className="text-brown-600">커피 여정을 더욱 풍부하게 만들어보세요</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {/* 직접 기록하기 */}
              <motion.div
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-gradient-to-br from-brown-400 via-brown-500 to-coffee-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10 text-center">
                <div className="text-3xl mb-3">✍️</div>
                <h3 className="text-lg font-bold mb-2">직접 기록</h3>
                <p className="text-white/90 text-sm mb-4">수동으로 입력</p>
                <Link href="/record">
                  <button className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-300 border border-white/30">
                    기록하기
                  </button>
                </Link>
              </div>
              </motion.div>
              
            {/* 취향 분석하기 */}
              <motion.div
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-gradient-to-br from-coffee-400 via-coffee-500 to-brown-400 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10 text-center">
                <div className="text-3xl mb-3">✨</div>
                <h3 className="text-lg font-bold mb-2">취향 분석</h3>
                <p className="text-white/90 text-sm mb-4">AI 분석</p>
                <Link href="/history">
                  <button className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-300 border border-white/30">
                    분석하기
                  </button>
                </Link>
              </div>
              </motion.div>
              
            {/* 카페 탐색 */}
              <motion.div
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-gradient-to-br from-coffee-500 via-coffee-600 to-brown-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10 text-center">
                <div className="text-3xl mb-3">🗺️</div>
                <h3 className="text-lg font-bold mb-2">카페 탐색</h3>
                <p className="text-white/90 text-sm mb-4">주변 카페</p>
                <Link href="/cafes">
                  <button className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-300 border border-white/30">
                    탐색하기
                  </button>
                </Link>
              </div>
              </motion.div>

            {/* 원두 카탈로그 */}
              <motion.div
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-gradient-to-br from-brown-500 via-coffee-500 to-coffee-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10 text-center">
                <div className="text-3xl mb-3">🌱</div>
                <h3 className="text-lg font-bold mb-2">원두</h3>
                <p className="text-white/90 text-sm mb-4">카탈로그</p>
                <Link href="/beans">
                  <button className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-300 border border-white/30">
                    둘러보기
                  </button>
                    </Link>
                </div>
              </motion.div>
          </div>
        </motion.section>

        {/* 📊 사용자 대시보드 */}
        {user && (
          <motion.section 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mb-20"
          >
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-white/20 shadow-xl">
              <h2 className="text-3xl font-bold text-brown-800 mb-8 text-center">
                👋 {user?.displayName}님의 커피 여정
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <div className="text-center p-6 bg-white/60 rounded-2xl border border-white/30">
                  <div className="text-3xl mb-2">📊</div>
                  <div className="text-2xl font-bold text-brown-800">{recentRecords.length}</div>
                  <div className="text-brown-600 text-sm">총 기록</div>
                </div>
                
                <div className="text-center p-6 bg-white/60 rounded-2xl border border-white/30">
                  <div className="text-3xl mb-2">🌸</div>
                  <div className="text-lg font-bold text-brown-800">Floral</div>
                  <div className="text-brown-600 text-sm">선호 향미</div>
                </div>
                
                <div className="text-center p-6 bg-white/60 rounded-2xl border border-white/30">
                  <div className="text-3xl mb-2">⭐</div>
                  <div className="text-lg font-bold text-brown-800">Blue Bottle</div>
                  <div className="text-brown-600 text-sm">추천 브랜드</div>
                </div>
                
                <div className="text-center p-6 bg-white/60 rounded-2xl border border-white/30">
                  <div className="text-3xl mb-2">📧</div>
                  <button
                    onClick={() => setShowEmailModal(true)}
                    className="text-lg font-bold text-brown-800 hover:text-coffee-600 transition-colors"
                  >
                    리포트
                  </button>
                  <div className="text-brown-600 text-sm">주간 분석</div>
                      </div>
                    </div>
                    
              {/* 최근 기록들 미니 프리뷰 */}
              {recentRecords.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-brown-800">최근 기록</h3>
                    <Link href="/history" className="text-coffee-600 hover:text-coffee-700 font-medium">
                      전체보기 →
                      </Link>
                    </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {recentRecords.slice(0, 4).map((record, index) => (
                      <div key={record.id} className="bg-white/60 rounded-xl p-4 border border-white/30 text-center">
                        <div className="text-2xl mb-2">☕</div>
                        <h4 className="font-semibold text-brown-800 text-sm truncate">{record.beanName}</h4>
                        <p className="text-xs text-brown-600 mb-2">{record.flavor}</p>
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-yellow-500">⭐</span>
                          <span className="text-xs font-medium">{record.rating}</span>
                        </div>
                      </div>
                ))}
              </div>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* 🔥 인기 원두 섹션 */}
        {popularBeans.length > 0 && (
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="mb-20"
          >
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-brown-800 mb-4">🔥 인기 원두</h2>
              <p className="text-brown-600 text-lg">커피 애호가들이 주목하는 원두들</p>
          </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {popularBeans.slice(0, 6).map((bean, index) => (
                <motion.div
                  key={bean.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  whileHover={{ scale: 1.03, y: -5 }}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/30 hover:shadow-2xl transition-all duration-300"
                >
                  <div className="text-center">
                    <div className="text-4xl mb-4">☕</div>
                    <h3 className="font-bold text-brown-800 text-lg mb-2">{bean.name}</h3>
                    <p className="text-brown-600 mb-1">{bean.brand}</p>
                    <p className="text-coffee-600 text-sm mb-4">{bean.flavor}</p>
                    <div className="flex items-center justify-center gap-4 text-sm text-brown-500">
                      <span>👀 {bean.views}</span>
                        <span>❤️ {bean.likes}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </div>

      {/* 사진 옵션 모달 */}
      {showPhotoOptions && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">📸</div>
              <h3 className="text-2xl font-bold text-brown-800 mb-2">사진으로 분석하기</h3>
              <p className="text-brown-600">커피백이나 메뉴판을 촬영해보세요</p>
            </div>

            <div className="space-y-4">
              <Link href="/record/photo">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-coffee-500 to-coffee-600 text-white py-4 px-6 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-3"
                >
                  <span className="text-2xl">📷</span>
                  사진 촬영하기
                </motion.button>
            </Link>
            
              <Link href="/record/photo">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-brown-500 to-brown-600 text-white py-4 px-6 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-3"
                >
                  <span className="text-2xl">🖼️</span>
                  갤러리에서 선택
                </motion.button>
            </Link>
            
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowPhotoOptions(false)}
                className="w-full bg-cream-100 text-brown-700 py-3 px-6 rounded-2xl font-semibold hover:bg-cream-200 transition-colors duration-300"
              >
                취소
              </motion.button>
          </div>
          </motion.div>
        </motion.div>
      )}

      {/* 이메일 리포트 모달 */}
      {showEmailModal && (
      <EmailReportModal 
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
      />
      )}
    </div>
  );
} 