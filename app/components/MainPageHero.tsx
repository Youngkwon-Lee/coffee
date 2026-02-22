"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Coffee, Camera, ScanText, Store, History, ChevronRight, Sparkles, Plus } from "lucide-react";

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
    <div className="dashboard-container relative">
      {/* Background gradients for overall app feel */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-coffee-gold/5 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-coffee-latte/5 rounded-full blur-[120px]"></div>
      </div>

      {/* Welcome Section */}
      <section className="p-4 pb-2 mt-2 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-coffee-50 to-coffee-200 mb-1 flex items-center gap-2">
              안녕하세요! <Coffee className="w-6 h-6 text-coffee-300 animate-float" />
            </h1>
            <p className="text-coffee-light/70 text-sm font-medium">
              오늘도 풍부한 커피 향과 함께하세요
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-coffee-600 to-coffee-800 p-[2px] shadow-glow flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-coffee-dark border border-coffee-800/50"></div>
          </div>
        </div>
      </section>

      {/* 메인 커피 기록 액션 */}
      <section className="p-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
        <Link href="/record/photo">
          <div className="group relative rounded-[2rem] p-8 text-center mb-6 overflow-hidden cursor-pointer">
            {/* Base Glass Layer */}
            <div className="absolute inset-0 bg-gradient-to-br from-coffee-600/30 to-coffee-900/40 backdrop-blur-glass-md border border-coffee-400/20 shadow-glow-lg transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-[0_0_50px_rgba(197,139,60,0.5)]"></div>

            {/* Animated Shimmer Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[100%] group-hover:animate-shimmer"></div>

            {/* Ambient glowing blobs */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-coffee-300/20 rounded-full blur-[40px] mix-blend-screen group-hover:bg-coffee-300/30 transition-colors duration-500"></div>
            <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-coffee-600/30 rounded-full blur-[50px] mix-blend-screen animate-pulse-slow"></div>

            {/* 컨텐츠 */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="mb-5 transform transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 drop-shadow-2xl">
                <div className="relative">
                  <Camera className="w-16 h-16 text-coffee-50" strokeWidth={1.5} />
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-coffee-gold animate-ping"></div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-coffee-gold"></div>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-coffee-50 mb-2 tracking-tight">AI 커피 기록</h2>
              <p className="text-coffee-100/80 text-sm mb-6 font-medium">영수증 촬영으로 간편하게 기록하세요</p>

              <div className="inline-flex items-center gap-2 bg-coffee-900/40 backdrop-blur-md border border-coffee-400/30 rounded-full px-5 py-2.5 text-sm font-semibold text-coffee-50 shadow-lg group-hover:bg-coffee-800/50 transition-colors duration-300">
                <ScanText className="w-4 h-4 text-coffee-400" />
                <span>스마트 기록 시작하기</span>
              </div>
            </div>
          </div>
        </Link>
      </section>

      {/* 다른 기능들 */}
      <section className="p-4 animate-slide-up" style={{ animationDelay: "200ms" }}>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-lg font-bold text-coffee-50 tracking-tight">빠른 메뉴</h2>
          <span className="text-xs font-semibold text-coffee-gold/80 bg-coffee-gold/10 px-2 py-1 rounded-full">New</span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Link href="/beans">
            <div className="group relative bg-coffee-800/30 backdrop-blur-glass border border-white/5 rounded-[1.5rem] p-4 text-center cursor-pointer transition-all duration-300 hover:bg-coffee-700/40 hover:-translate-y-1 hover:shadow-glow">
              <div className="w-12 h-12 mx-auto bg-gradient-to-br from-coffee-600/20 to-brown-800/40 rounded-full flex items-center justify-center mb-3 border border-white/10 group-hover:scale-110 transition-transform duration-300">
                <Coffee className="w-6 h-6 text-coffee-200 drop-shadow-md" strokeWidth={1.5} />
              </div>
              <div className="text-xs font-semibold text-coffee-100">원두 찾기</div>
            </div>
          </Link>

          <Link href="/cafes">
            <div className="group relative bg-coffee-800/30 backdrop-blur-glass border border-white/5 rounded-[1.5rem] p-4 text-center cursor-pointer transition-all duration-300 hover:bg-coffee-700/40 hover:-translate-y-1 hover:shadow-glow">
              <div className="w-12 h-12 mx-auto bg-gradient-to-br from-coffee-500/20 to-coffee-800/40 rounded-full flex items-center justify-center mb-3 border border-white/10 group-hover:scale-110 transition-transform duration-300">
                <Store className="w-6 h-6 text-coffee-200 drop-shadow-md" strokeWidth={1.5} />
              </div>
              <div className="text-xs font-semibold text-coffee-100">카페 찾기</div>
            </div>
          </Link>

          <Link href="/history">
            <div className="group relative bg-coffee-800/30 backdrop-blur-glass border border-white/5 rounded-[1.5rem] p-4 text-center cursor-pointer transition-all duration-300 hover:bg-coffee-700/40 hover:-translate-y-1 hover:shadow-glow">
              <div className="w-12 h-12 mx-auto bg-gradient-to-br from-coffee-400/20 to-coffee-700/40 rounded-full flex items-center justify-center mb-3 border border-white/10 group-hover:scale-110 transition-transform duration-300">
                <History className="w-6 h-6 text-coffee-200 drop-shadow-md" strokeWidth={1.5} />
              </div>
              <div className="text-xs font-semibold text-coffee-100">기록 보기</div>
            </div>
          </Link>
        </div>
      </section>

      {/* 추가 정보 */}
      <section className="p-4 pt-4 animate-slide-up" style={{ animationDelay: "300ms" }}>
        <div className="relative overflow-hidden bg-gradient-to-r from-coffee-800/20 to-coffee-600/20 backdrop-blur-glass border border-coffee-500/10 rounded-2xl p-4 flex items-center justify-between cursor-pointer group hover:bg-coffee-800/30 transition-colors shadow-glow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-coffee-gold/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-coffee-gold/30">
              <Sparkles className="w-5 h-5 text-coffee-gold animate-pulse-slow" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-coffee-50">금주의 커피 트렌드</p>
              <p className="text-xs font-medium text-coffee-100/70">새로운 로스터리 소식을 확인하세요</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-coffee-900/50 flex items-center justify-center border border-coffee-500/20">
            <ChevronRight className="w-4 h-4 text-coffee-300/80 group-hover:text-coffee-300 group-hover:translate-x-0.5 transition-all duration-300" />
          </div>
        </div>
      </section>
    </div>
  );
} 