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
              <div className="relative group bg-[#1c1816]/80 backdrop-blur-md rounded-2xl p-6 text-center border border-[#c5a880]/15 shadow-2xl hover:border-[#c5a880]/30 transition-all duration-300 hover:scale-[1.01] cursor-pointer overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-[100%] group-hover:animate-shimmer"></div>
                <div className="relative z-10">
                  <Camera className="w-10 h-10 text-[#c5a880] mx-auto mb-3 animate-pulse" strokeWidth={1.5} />
                  <h2 className="text-lg font-bold text-[#f8f6f3] mb-1">AI 커피 기록</h2>
                  <p className="text-coffee-light/60 text-xs">카메라로 촬영해서 즉시 분석하세요!</p>
                </div>
              </div>
            </Link>
          </div>

          {/* 다른 기능들 */}
          <div className="grid grid-cols-3 gap-3">
            <Link href="/beans">
              <div className="stats-card hover:bg-white/5 transition-colors cursor-pointer text-center p-4">
                <Coffee className="w-5 h-5 text-[#c5a880] mx-auto mb-2" strokeWidth={1.5} />
                <div className="stats-label text-xs">원두 찾기</div>
              </div>
            </Link>
            <Link href="/cafes">
              <div className="stats-card hover:bg-white/5 transition-colors cursor-pointer text-center p-4">
                <Store className="w-5 h-5 text-[#c5a880] mx-auto mb-2" strokeWidth={1.5} />
                <div className="stats-label text-xs">카페 찾기</div>
              </div>
            </Link>
            <Link href="/history">
              <div className="stats-card hover:bg-white/5 transition-colors cursor-pointer text-center p-4">
                <History className="w-5 h-5 text-[#c5a880] mx-auto mb-2" strokeWidth={1.5} />
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
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-[#c5a880]/5 rounded-full blur-[110px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] bg-[#a88c74]/5 rounded-full blur-[130px]"></div>
      </div>

      {/* Welcome Section */}
      <section className="p-4 pb-2 mt-2 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#f8f6f3] mb-1 flex items-center gap-2 tracking-tight">
              안녕하세요! <Coffee className="w-6 h-6 text-[#c5a880] animate-float" strokeWidth={1.5} />
            </h1>
            <p className="text-coffee-light/60 text-sm font-medium">
              오늘도 풍부한 커피 향과 함께하세요
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#c5a880] to-[#a88c74] p-[1.5px] shadow-lg flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-[#120f0d] border border-white/5"></div>
          </div>
        </div>
      </section>

      <section className="p-4 pt-2 animate-slide-up" style={{ animationDelay: "80ms" }}>
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-coffee-light/95">처음 오셨나요?</div>
            <div className="text-xs text-coffee-light/60 mt-0.5">1분 온보딩으로 취향 설정하고 바로 시작하세요.</div>
          </div>
          <Link href="/onboarding" className="text-xs px-3.5 py-2 rounded-lg bg-[#c5a880]/10 border border-[#c5a880]/20 text-[#c5a880] hover:bg-[#c5a880]/20 hover:border-[#c5a880]/40 transition-colors whitespace-nowrap">
            온보딩 시작
          </Link>
        </div>
      </section>

      {/* 메인 커피 기록 액션 */}
      <section className="p-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
        <Link href="/record/photo">
          <div className="group relative rounded-[2rem] p-8 text-center mb-6 overflow-hidden cursor-pointer">
            {/* Base Glass Layer */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#c5a880]/10 via-transparent to-[#1c1816]/80 backdrop-blur-xl border border-white/5 shadow-2xl transition-all duration-500 group-hover:scale-[1.01] group-hover:border-[#c5a880]/20 group-hover:shadow-[0_0_50px_rgba(197,168,128,0.1)]"></div>

            {/* Animated Shimmer Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-[100%] group-hover:animate-shimmer"></div>

            {/* Ambient glowing blobs */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#c5a880]/5 rounded-full blur-[40px] mix-blend-screen group-hover:bg-[#c5a880]/10 transition-colors duration-500"></div>
            <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-[#a88c74]/8 rounded-full blur-[50px] mix-blend-screen animate-pulse-slow"></div>

            {/* 컨텐츠 */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="mb-5 transform transition-transform duration-500 group-hover:scale-105 group-hover:rotate-1 drop-shadow-2xl">
                <div className="relative">
                  <Camera className="w-16 h-16 text-[#f8f6f3]" strokeWidth={1.2} />
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#c5a880] animate-ping"></div>
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#c5a880]"></div>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-[#f8f6f3] mb-2 tracking-tight">AI 커피 기록</h2>
              <p className="text-coffee-light/60 text-sm mb-6 font-medium">영수증 촬영으로 간편하게 기록하세요</p>

              <div className="inline-flex items-center gap-2 bg-[#1c1816]/80 backdrop-blur border border-white/10 rounded-full px-5 py-2.5 text-sm font-semibold text-[#f8f6f3] shadow-lg group-hover:border-[#c5a880]/30 transition-all duration-300">
                <ScanText className="w-4 h-4 text-[#c5a880]/80" strokeWidth={1.5} />
                <span>스마트 기록 시작하기</span>
              </div>
            </div>
          </div>
        </Link>
      </section>

      {/* 다른 기능들 */}
      <section className="p-4 animate-slide-up" style={{ animationDelay: "200ms" }}>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-lg font-bold text-[#f8f6f3] tracking-tight">빠른 메뉴</h2>
          <span className="text-[10px] font-semibold text-[#c5a880] bg-[#c5a880]/10 border border-[#c5a880]/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">New</span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Link href="/beans">
            <div className="group relative bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-[1.5rem] p-4 text-center cursor-pointer transition-all duration-300 hover:bg-white/[0.05] hover:-translate-y-1 hover:border-[#c5a880]/20 hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
              <div className="w-12 h-12 mx-auto bg-[#c5a880]/5 rounded-full flex items-center justify-center mb-3 border border-white/5 group-hover:scale-105 transition-transform duration-300">
                <Coffee className="w-6 h-6 text-[#c5a880] drop-shadow-md" strokeWidth={1.3} />
              </div>
              <div className="text-xs font-semibold text-coffee-light/90">원두 찾기</div>
            </div>
          </Link>

          <Link href="/cafes">
            <div className="group relative bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-[1.5rem] p-4 text-center cursor-pointer transition-all duration-300 hover:bg-white/[0.05] hover:-translate-y-1 hover:border-[#c5a880]/20 hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
              <div className="w-12 h-12 mx-auto bg-[#c5a880]/5 rounded-full flex items-center justify-center mb-3 border border-white/5 group-hover:scale-105 transition-transform duration-300">
                <Store className="w-6 h-6 text-[#c5a880] drop-shadow-md" strokeWidth={1.3} />
              </div>
              <div className="text-xs font-semibold text-coffee-light/90">카페 찾기</div>
            </div>
          </Link>

          <Link href="/history">
            <div className="group relative bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-[1.5rem] p-4 text-center cursor-pointer transition-all duration-300 hover:bg-white/[0.05] hover:-translate-y-1 hover:border-[#c5a880]/20 hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
              <div className="w-12 h-12 mx-auto bg-[#c5a880]/5 rounded-full flex items-center justify-center mb-3 border border-white/5 group-hover:scale-105 transition-transform duration-300">
                <History className="w-6 h-6 text-[#c5a880] drop-shadow-md" strokeWidth={1.3} />
              </div>
              <div className="text-xs font-semibold text-coffee-light/90">기록 보기</div>
            </div>
          </Link>
        </div>
      </section>

      {/* 추가 정보 */}
      <section className="p-4 pt-4 animate-slide-up" style={{ animationDelay: "300ms" }}>
        <div className="relative overflow-hidden bg-gradient-to-r from-[#1c1816]/40 to-transparent backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex items-center justify-between cursor-pointer group hover:bg-[#1c1816]/60 transition-colors shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#c5a880]/10 flex items-center justify-center group-hover:scale-105 transition-transform duration-300 border border-[#c5a880]/20">
              <Sparkles className="w-5 h-5 text-[#c5a880] animate-pulse-slow" strokeWidth={1.5} />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-[#f8f6f3]">금주의 커피 트렌드</p>
              <p className="text-xs font-medium text-coffee-light/50 mt-0.5">새로운 로스터리 소식을 확인하세요</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <ChevronRight className="w-4 h-4 text-coffee-light/40 group-hover:text-coffee-light group-hover:translate-x-0.5 transition-all duration-300" strokeWidth={1.5} />
          </div>
        </div>
      </section>
    </div>
  );
} 