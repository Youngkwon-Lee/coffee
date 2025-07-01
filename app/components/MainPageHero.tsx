"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface CoffeeRecord {
  id: string;
  beanName: string;
  flavor: string;
  rating: number;
  brewMethod: string;
  createdAt: string;
  imageUrl?: string;
  cafe?: string;
  notes?: string;
  flavors?: string[];
}

export default function MainPageHero() {
  const [coffeeRecords, setCoffeeRecords] = useState<CoffeeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  useEffect(() => {
    // Firebase 초기화 검사
    try {
      // Firebase가 제대로 로드되었는지 확인
      if (typeof window !== 'undefined') {
        // 클라이언트 사이드에서만 Firebase 로드 시도
        loadFirebaseAuth();
      }
    } catch (error) {
      console.error("Firebase 초기화 오류:", error);
      setFirebaseError("Firebase 연결 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  }, []);

  async function loadFirebaseAuth() {
    try {
      // 동적으로 Firebase 임포트
      const { auth, db } = await import("@/firebase");
      const { useAuthState } = await import("react-firebase-hooks/auth");
      const { collection, query, orderBy, limit, getDocs } = await import("firebase/firestore");
      
      // Firebase 연결 성공
      setIsLoading(false);
    } catch (error) {
      console.error("Firebase 로드 실패:", error);
      setFirebaseError("Firebase를 로드할 수 없습니다.");
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="loading-spinner w-8 h-8 rounded-full border-2 border-coffee-gold border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (firebaseError) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">☕</div>
          <h2 className="text-2xl font-bold text-coffee-light mb-4">
            커피 트래커에 오신 것을 환영합니다!
          </h2>
          <p className="text-coffee-light opacity-70 mb-2">
            Firebase 연결에 문제가 있지만, 앱을 계속 사용할 수 있습니다.
          </p>
          <p className="text-sm text-coffee-light opacity-50 mb-6">
            오류: {firebaseError}
          </p>
          {/* 메인 커피 기록 액션 */}
          <div className="mb-6">
            <Link href="/record/photo">
              <div className="relative bg-gradient-to-br from-coffee-gold/90 to-coffee-600/90 backdrop-blur-sm rounded-2xl p-6 text-center shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-[1.02] cursor-pointer overflow-hidden">
                <div className="relative z-10">
                  <div className="text-5xl mb-3 animate-pulse">📸</div>
                  <h2 className="text-xl font-bold text-coffee-dark mb-2">AI 커피 기록</h2>
                  <p className="text-coffee-dark/80 text-sm">카메라로 촬영해서 즉시 분석하세요!</p>
                </div>
              </div>
            </Link>
          </div>
          
          {/* 다른 기능들 */}
          <div className="grid grid-cols-3 gap-3">
            <Link href="/beans">
              <div className="stats-card hover:bg-coffee-medium transition-colors cursor-pointer text-center p-4">
                <div className="text-2xl mb-2">🫘</div>
                <div className="stats-label text-xs">원두 찾기</div>
              </div>
            </Link>
            <Link href="/cafes">
              <div className="stats-card hover:bg-coffee-medium transition-colors cursor-pointer text-center p-4">
                <div className="text-2xl mb-2">🏪</div>
                <div className="stats-label text-xs">카페 찾기</div>
              </div>
            </Link>
            <Link href="/history">
              <div className="stats-card hover:bg-coffee-medium transition-colors cursor-pointer text-center p-4">
                <div className="text-2xl mb-2">📊</div>
                <div className="stats-label text-xs">기록 보기</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Welcome Section */}
      <section className="p-4 pb-2">
        <div className="text-center">
          <h1 className="text-xl font-bold text-coffee-light mb-1">
            안녕하세요! ☕
          </h1>
          <p className="text-coffee-light opacity-70 text-sm">
            오늘도 좋은 커피 한 잔 어떠세요?
          </p>
        </div>
      </section>

      {/* 메인 커피 기록 액션 */}
      <section className="p-4">
        <Link href="/record/photo">
          <div className="relative bg-gradient-to-br from-coffee-gold/90 to-coffee-600/90 backdrop-blur-sm rounded-2xl p-8 text-center mb-6 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-[1.02] cursor-pointer overflow-hidden">
            {/* 배경 장식 */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-coffee-gold/10 to-transparent"></div>
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-coffee-light/10 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-coffee-gold/20 rounded-full blur-3xl"></div>
            
            {/* 컨텐츠 */}
            <div className="relative z-10">
              <div className="text-6xl mb-4">📸</div>
              <h2 className="text-2xl font-bold text-coffee-dark mb-2">AI 커피 기록</h2>
              <p className="text-coffee-dark/80 text-sm mb-4">카메라로 촬영해서 즉시 분석하세요!</p>
              <div className="inline-flex items-center gap-2 bg-coffee-dark/20 rounded-full px-4 py-2 text-sm font-medium text-coffee-dark animate-bounce">
                <span>🤖</span>
                <span>탭해서 시작하기</span>
              </div>
            </div>
          </div>
        </Link>
      </section>

      {/* 다른 기능들 */}
      <section className="p-4">
        <h2 className="section-heading mb-4">다른 기능</h2>
        <div className="grid grid-cols-3 gap-3">
          <Link href="/beans">
            <div className="stats-card hover:bg-coffee-medium transition-colors cursor-pointer text-center p-4">
              <div className="text-3xl mb-2">🫘</div>
              <div className="stats-label text-sm">원두 찾기</div>
            </div>
          </Link>
          <Link href="/cafes">
            <div className="stats-card hover:bg-coffee-medium transition-colors cursor-pointer text-center p-4">
              <div className="text-3xl mb-2">🏪</div>
              <div className="stats-label text-sm">카페 찾기</div>
            </div>
          </Link>
          <Link href="/history">
            <div className="stats-card hover:bg-coffee-medium transition-colors cursor-pointer text-center p-4">
              <div className="text-3xl mb-2">📊</div>
              <div className="stats-label text-sm">기록 보기</div>
            </div>
          </Link>
        </div>
      </section>

      {/* 추가 정보 */}
      <section className="p-4 pt-2">
        <div className="card-coffee p-3 text-center">
          <p className="text-sm text-coffee-light opacity-70">
            ✨ 더 많은 기능이 곧 추가됩니다!
          </p>
        </div>
      </section>
    </div>
  );
} 