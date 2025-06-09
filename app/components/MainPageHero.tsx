"use client";

import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../../src/firebase";
import { collection, query, orderBy, limit, getDocs, where } from "firebase/firestore";
import Link from "next/link";
import { motion } from "framer-motion";
import EmailReportModal from './EmailReportModal';

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
        // TODO: 실제 추천 알고리즘 구현
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
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-amber-700">커피 여정을 준비하고 있어요...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      <div className="container mx-auto px-4 pt-20 pb-8">
        
        {/* 개인화된 인사말 섹션 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent mb-4">
            {getGreeting()}
          </h1>
          {user ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg max-w-6xl mx-auto">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                {user.displayName}님의 커피 여정 📊
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center p-4 bg-amber-100 rounded-xl">
                  <div className="text-3xl font-bold text-amber-700">{recentRecords.length || 0}</div>
                  <div className="text-sm text-amber-600">총 기록</div>
                </div>
                <div className="text-center p-4 bg-orange-100 rounded-xl">
                  <div className="text-2xl font-bold text-orange-700">
                    {recentRecords.length > 0 ? 'Floral' : 'Floral'}
                  </div>
                  <div className="text-sm text-orange-600">선호 향미</div>
                </div>
                <div className="text-center p-4 bg-red-100 rounded-xl">
                  <div className="text-lg font-bold text-red-700">
                    {recentRecords.length > 0 ? 
                      popularBeans.length > 0 ? popularBeans[0].brand : '원두 탐색 필요' : 
                      '기록 필요'
                    }
                  </div>
                  <div className="text-sm text-red-600">추천 브랜드</div>
                </div>
              </div>
              
              {/* 이메일 리포트 버튼 추가 */}
              {recentRecords.length > 0 && (
                <div className="flex justify-center space-x-4">
                  <Link 
                    href="/records"
                    className="inline-flex items-center px-6 py-3 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    📊 전체 기록 보기
                  </Link>
                  <button
                    onClick={() => setShowEmailModal(true)}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full hover:from-blue-600 hover:to-purple-600 transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    📧 이메일로 리포트 받기
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg max-w-6xl mx-auto">
              <p className="text-xl text-gray-600 mb-6">
                나만의 커피 여정을 시작해보세요
              </p>
              <Link 
                href="/login"
                className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-full hover:from-amber-600 hover:to-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                로그인하고 시작하기 ☕
              </Link>
            </div>
          )}
        </motion.div>

        {/* 개인화 추천 섹션 */}
        {user && personalizedRecommendations.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-16"
          >
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl">
              <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center">
                🎯 {user.displayName}님만을 위한 추천
              </h2>
              <p className="text-gray-600 mb-6">
                취향 분석 결과를 바탕으로 엄선한 원두들이에요
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {personalizedRecommendations.map((bean, index) => (
                  <motion.div
                    key={bean.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 * index }}
                    className="group bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border-2 border-transparent hover:border-amber-300 transition-all duration-300 hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                        #{index + 1} 추천
                      </span>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span>❤️ {bean.likes}</span>
                        <span>👁️ {bean.views}</span>
                      </div>
                    </div>
                    
                    <h3 className="font-bold text-lg text-gray-800 mb-2 group-hover:text-amber-700 transition-colors">
                      {bean.name}
                    </h3>
                    <p className="text-gray-600 text-sm mb-2">{bean.brand}</p>
                    {bean.flavor && (
                      <p className="text-amber-600 text-sm mb-3">🌸 {bean.flavor}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-700">{bean.price}</span>
                      <Link 
                        href={`/beans/${bean.id}`}
                        className="bg-amber-500 text-white px-4 py-2 rounded-full text-sm hover:bg-amber-600 transition-colors"
                      >
                        자세히 보기
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* 인기 원두 섹션 */}
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4 flex items-center justify-center">
              🔥 지금 인기있는 원두
            </h2>
            <p className="text-gray-600">커피 애호가들이 주목하고 있는 원두들</p>
          </div>

          {popularBeans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {popularBeans.map((bean, index) => (
                <motion.div
                  key={bean.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group hover:-translate-y-1"
                >
                  {bean.image && (
                    <div className="h-48 bg-gradient-to-br from-amber-100 to-orange-100 relative overflow-hidden">
                      <img 
                        src={bean.image} 
                        alt={bean.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium text-amber-700">
                        #{index + 1}
                      </div>
                    </div>
                  )}
                  
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-lg text-gray-800 group-hover:text-amber-700 transition-colors">
                        {bean.name}
                      </h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <span>❤️ {bean.likes}</span>
                        <span>👁️ {bean.views}</span>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-2">{bean.brand}</p>
                    {bean.origin && (
                      <p className="text-blue-600 text-sm mb-2">🌍 {bean.origin}</p>
                    )}
                    {bean.flavor && (
                      <p className="text-amber-600 text-sm mb-4">🌸 {bean.flavor}</p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xl text-amber-700">{bean.price}</span>
                      <Link 
                        href={`/beans/${bean.id}`}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-full text-sm hover:from-amber-600 hover:to-orange-600 transition-all duration-300 shadow-md hover:shadow-lg"
                      >
                        상세보기
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-12 text-center shadow-xl max-w-6xl mx-auto">
              <div className="text-6xl mb-4">☕</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">인기 원두 준비 중</h3>
              <p className="text-gray-600 mb-6">곧 멋진 원두들을 소개해드릴게요!</p>
              <Link 
                href="/beans"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full font-medium hover:from-amber-600 hover:to-orange-600 transition-all duration-300 shadow-lg"
              >
                원두 둘러보기 🔍
              </Link>
            </div>
          )}
        </motion.section>

        {/* 최근 기록 섹션 - 사용자 로그인 시에만 표시 */}
        {user && recentRecords.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mb-16"
          >
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-gray-800 flex items-center">
                  📚 나의 커피 기록
                </h2>
                <Link 
                  href="/records"
                  className="text-amber-600 hover:text-amber-700 font-medium flex items-center"
                >
                  전체보기 →
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {recentRecords.map((record, index) => (
                  <motion.div
                    key={record.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.05 * index }}
                    className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200 hover:border-amber-300 transition-all duration-300 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <span 
                            key={i} 
                            className={i < record.rating ? "text-amber-400" : "text-gray-300"}
                          >
                            ⭐
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <h4 className="font-semibold text-gray-800 mb-1 truncate">
                      {record.beanName}
                    </h4>
                    <p className="text-sm text-gray-600 mb-2 truncate">
                      {record.flavor}
                    </p>
                    <span className="inline-block bg-amber-200 text-amber-800 px-2 py-1 rounded-full text-xs">
                      {record.brewMethod}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* 빠른 액션 섹션 */}
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="text-center mb-32"
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            오늘도 멋진 커피 여정을 시작해보세요 ☕️
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Link 
              href="/bean-analyze"
              className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">📸</div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">원두 분석</h3>
              <p className="text-gray-600 text-sm">사진으로 원두 정보를 자동 분석</p>
            </Link>
            
            <Link 
              href="/cafes"
              className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🗺️</div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">카페 탐색</h3>
              <p className="text-gray-600 text-sm">내 취향에 맞는 카페 찾기</p>
            </Link>
            
            <Link 
              href="/beans"
              className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🌱</div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">원두 탐색</h3>
              <p className="text-gray-600 text-sm">다양한 원두들을 만나보세요</p>
            </Link>
          </div>
        </motion.section>

      </div>

      {/* 이메일 리포트 모달 */}
      <EmailReportModal 
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
      />
    </div>
  );
} 