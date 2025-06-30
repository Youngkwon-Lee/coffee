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
          <div className="space-y-3">
            <Link href="/record/photo">
              <button className="btn-primary w-full">
                커피 기록하기
              </button>
            </Link>
            <Link href="/beans">
              <button className="btn-secondary w-full">
                원두 찾아보기
              </button>
            </Link>
            <Link href="/cafes">
              <button className="btn-secondary w-full">
                카페 찾아보기
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Welcome Section */}
      <section className="p-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-coffee-light mb-2">
            안녕하세요! ☕
          </h1>
          <p className="text-coffee-light opacity-70">
            오늘도 좋은 커피 한 잔 어떠세요?
          </p>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="p-4">
        <h2 className="section-heading">빠른 작업</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Link href="/record/photo">
            <div className="stats-card hover:bg-coffee-medium transition-colors cursor-pointer">
              <div className="text-2xl mb-2">📸</div>
              <div className="stats-label">커피 기록</div>
            </div>
          </Link>
          <Link href="/beans">
            <div className="stats-card hover:bg-coffee-medium transition-colors cursor-pointer">
              <div className="text-2xl mb-2">🫘</div>
              <div className="stats-label">원두 찾기</div>
            </div>
          </Link>
          <Link href="/cafes">
            <div className="stats-card hover:bg-coffee-medium transition-colors cursor-pointer">
              <div className="text-2xl mb-2">🏪</div>
              <div className="stats-label">카페 찾기</div>
            </div>
          </Link>
          <Link href="/history">
            <div className="stats-card hover:bg-coffee-medium transition-colors cursor-pointer">
              <div className="text-2xl mb-2">📊</div>
              <div className="stats-label">기록 보기</div>
            </div>
          </Link>
        </div>
      </section>

      {/* Coming Soon */}
      <section className="p-4">
        <div className="card-coffee p-4 text-center">
          <h3 className="font-medium text-coffee-light mb-2">더 많은 기능이 곧 추가됩니다!</h3>
          <p className="text-sm text-coffee-light opacity-70">
            커피 추천, 플레이버 분석, 통계 등
          </p>
        </div>
      </section>
    </div>
  );
} 