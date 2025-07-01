"use client";
import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/firebase";
import { collection, query, orderBy, getDocs, Timestamp } from "firebase/firestore";
import Link from "next/link";

interface CoffeeRecord {
  id: string;
  bean: string;          // beanName → bean으로 변경
  flavor: string | string[];
  rating?: number;
  brewMethod?: string;
  createdAt: string | Timestamp;
  imageUrl?: string;
  cafe?: string;
  review?: string;       // notes → review로 변경
  processing?: string;
}

// Coffee Card Component for History
function CoffeeRecordCard({ record, showTime = true, showFlavors = true }: {
  record: CoffeeRecord;
  showTime?: boolean;
  showFlavors?: boolean;
}) {
  const formatTime = (timestamp: string | Timestamp) => {
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return "방금 전";
    if (diffInHours < 24) return `${Math.floor(diffInHours)}시간 전`;
    return `${Math.floor(diffInHours / 24)}일 전`;
  };

  const stars = Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={`text-sm ${i < (record.rating || 0) ? 'text-coffee-gold' : 'text-coffee-light opacity-30'}`}>
      ★
    </span>
  ));

  return (
    <div className="bg-coffee-medium rounded-xl p-4 card-hover border border-coffee-gold border-opacity-10">
      <div className="flex items-start space-x-3">
        <div className="w-14 h-14 rounded-xl overflow-hidden bg-coffee-dark flex-shrink-0">
          <img 
            src={record.imageUrl || "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=120&h=120&fit=crop&crop=center"} 
            alt={record.bean}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=120&h=120&fit=crop&crop=center";
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-coffee-light text-base truncate">{record.bean}</h3>
              <p className="text-sm text-coffee-light opacity-70 truncate">
                {record.cafe && `${record.cafe} • `}{record.brewMethod || record.processing || '사진으로 기록'}
              </p>
            </div>
            {showTime && (
              <span className="text-xs text-coffee-light opacity-50 ml-2 flex-shrink-0">
                {formatTime(record.createdAt)}
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              {stars}
              <span className="ml-2 text-sm text-coffee-light opacity-70">
                {record.rating || 0}.0
              </span>
            </div>
          </div>

          {showFlavors && record.flavor && Array.isArray(record.flavor) && record.flavor.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {record.flavor.slice(0, 3).map((flavor) => (
                <span 
                  key={flavor}
                  className="bg-coffee-gold bg-opacity-20 text-coffee-gold px-2 py-1 rounded-full text-xs font-medium"
                >
                  {flavor}
                </span>
              ))}
              {record.flavor.length > 3 && (
                <span className="text-coffee-light opacity-50 text-xs px-2 py-1">
                  +{record.flavor.length - 3}
                </span>
              )}
            </div>
          )}

          {record.review && (
            <p className="text-xs text-coffee-light opacity-60 line-clamp-2 leading-relaxed">
              {record.review}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const filters = ["전체", "이번 주", "즐겨찾기"];

export default function HistoryClient() {
  const [user] = useAuthState(auth);
  const [coffeeRecords, setCoffeeRecords] = useState<CoffeeRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState("전체");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCoffeeRecords();
  }, [user]);

  async function loadCoffeeRecords() {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      const recordsQuery = query(
        collection(db, "users", user.uid, "records"),
        orderBy("createdAt", "desc")
      );
      const recordsSnapshot = await getDocs(recordsQuery);
      const records = recordsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CoffeeRecord[];
      
      setCoffeeRecords(records);
    } catch (error) {
      console.error("커피 기록 로드 실패:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const getFilteredRecords = () => {
    switch (activeFilter) {
      case "이번 주":
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return coffeeRecords.filter(record => {
          const recordDate = record.createdAt instanceof Timestamp 
            ? record.createdAt.toDate() 
            : new Date(record.createdAt);
          return recordDate >= weekAgo;
        });
      case "즐겨찾기":
        return coffeeRecords.filter(record => (record.rating || 0) >= 4);
      default:
        return coffeeRecords;
    }
  };

  const filteredRecords = getFilteredRecords();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="loading-spinner w-8 h-8 rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📘</div>
          <h2 className="text-2xl font-bold text-coffee-light mb-4">
            로그인이 필요합니다
          </h2>
          <p className="text-coffee-light opacity-70 mb-6">
            커피 기록을 확인하려면 로그인하세요
          </p>
          <div className="space-y-3">
            <button 
              onClick={() => {
                // TODO: 로그인 페이지로 이동
                window.location.href = '/login';
              }}
              className="btn-primary w-full max-w-xs mx-auto block"
            >
              로그인하기
            </button>
            <div className="text-center">
              <Link href="/record/photo" className="text-coffee-gold hover:text-coffee-light underline text-sm">
                🎁 AI 분석 무료 체험하기
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-coffee-light">내 커피 기록</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-coffee-light opacity-70">
            총 {coffeeRecords.length}개
          </span>
          <button className="bg-coffee-gold text-coffee-dark px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-opacity-90 transition-colors">
            <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-.447.894l-2 1A1 1 0 019 18v-7.586L5.293 6.707A1 1 0 015 6V4z" />
            </svg>
            정렬
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex space-x-2 mb-6 overflow-x-auto">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`filter-chip ${
              activeFilter === filter ? "active" : "inactive"
            }`}
          >
            {filter}
            {filter === "즐겨찾기" && (
              <span className="ml-1">⭐</span>
            )}
          </button>
        ))}
      </div>

      {/* Coffee Records */}
      <div className="space-y-3">
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => (
            <CoffeeRecordCard
              key={record.id}
              record={record}
              showTime
              showFlavors
            />
          ))
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 bg-coffee-medium rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-coffee-light opacity-30" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-coffee-light mb-2">
              {activeFilter === "전체" ? "아직 기록된 커피가 없습니다" :
               activeFilter === "이번 주" ? "이번 주에 마신 커피가 없습니다" :
               "즐겨찾기 커피가 없습니다"}
            </h3>
            <p className="text-sm text-coffee-light opacity-60 mb-6">
              {activeFilter === "전체" ? "새로운 커피를 기록해보세요!" :
               activeFilter === "이번 주" ? "이번 주에 새로운 커피를 시도해보세요!" :
               "별점 4점 이상의 커피를 마셔보세요!"}
            </p>
            <div className="flex justify-center gap-3">
              <button className="btn-primary">
                📸 사진으로 기록
              </button>
              <button className="btn-secondary">
                ✍️ 직접 입력
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 