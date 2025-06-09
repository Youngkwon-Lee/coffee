"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import dayjs from "dayjs";
import Image from "next/image";
import Link from "next/link";

interface RecordData {
  id: string;
  createdAt: string;
  bean?: string;
  cafe?: string;
  flavor?: string[];
  rating?: number;
  review?: string;
  image?: string;
  mood?: string;
  weather?: string;
  roast?: string;
  brewing?: string;
}

export default function HistoryPage() {
  const [user, setUser] = useState<any>(null);
  const [records, setRecords] = useState<RecordData[]>([]);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState<RecordData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlavor, setSelectedFlavor] = useState("");
  const [minRating, setMinRating] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setRecords([]);
      setLoading(false);
      return;
    }
    const fetchRecords = async () => {
      try {
        const q = query(collection(db, `users/${user.uid}/records`), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RecordData[]);
      } catch (error) {
        console.error("기록 불러오기 실패:", error);
      }
      setLoading(false);
    };
    fetchRecords();
  }, [user]);

  useEffect(() => {
    let result = records;

    // 텍스트 검색
    if (search.trim()) {
      result = result.filter(r =>
        (r.bean || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.cafe || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.review || "").toLowerCase().includes(search.toLowerCase())
      );
    }

    // 향미 필터
    if (selectedFlavor) {
      result = result.filter(r => r.flavor?.includes(selectedFlavor));
    }

    // 평점 필터
    if (minRating > 0) {
      result = result.filter(r => (r.rating || 0) >= minRating);
    }

    setFiltered(result);
  }, [search, records, selectedFlavor, minRating]);

  // 통계 계산
  const totalRecords = records.length;
  const avgRating = records.length > 0 ? 
    (records.reduce((sum, r) => sum + (r.rating || 0), 0) / records.length).toFixed(1) : "0";
  
  const flavorCount: { [key: string]: number } = {};
  records.forEach(r => {
    r.flavor?.forEach(f => {
      flavorCount[f] = (flavorCount[f] || 0) + 1;
    });
  });
  const topFlavor = Object.entries(flavorCount).sort(([,a], [,b]) => b - a)[0]?.[0] || "없음";
  
  const recentStreak = (() => {
    if (records.length === 0) return 0;
    let streak = 0;
    const today = dayjs();
    for (let i = 0; i < 30; i++) {
      const date = today.subtract(i, 'day').format('YYYY-MM-DD');
      const hasRecord = records.some(r => dayjs(r.createdAt).format('YYYY-MM-DD') === date);
      if (hasRecord) streak++;
      else break;
    }
    return streak;
  })();

  // 날짜별 그룹핑
  const grouped = filtered.reduce((acc, rec) => {
    const date = dayjs(rec.createdAt).format("YYYY-MM-DD");
    if (!acc[date]) acc[date] = [];
    acc[date].push(rec);
    return acc;
  }, {} as { [date: string]: RecordData[] });
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // 모든 향미 목록
  const allFlavors = Array.from(new Set(records.flatMap(r => r.flavor || [])));

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-coffee-50 to-cream-100 relative overflow-hidden">
      {/* 배경 장식 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(230,188,83,0.15),transparent_70%)]"></div>
      <div className="absolute top-0 left-0 w-96 h-96 bg-coffee-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"></div>
      <div className="absolute top-0 right-0 w-80 h-80 bg-brown-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{animationDelay: '2s'}}></div>
      
      <main className="relative z-10 flex flex-col items-center min-h-screen pt-20 pb-24 px-4">
        {/* 헤더 */}
        <header className="w-full max-w-6xl text-center mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-8">
            <h1 className="text-4xl md:text-6xl font-display font-bold bg-gradient-to-r from-brown-700 via-coffee-600 to-brown-800 bg-clip-text text-transparent mb-4">
              📚 My Coffee Journey
            </h1>
            <p className="text-xl text-brown-600 mb-6">
              {user ? `${user.displayName || user.email?.split('@')[0]}님의 커피 기록` : "로그인이 필요합니다"}
            </p>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center w-full max-w-2xl">
            <div className="bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-12 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-coffee-500 border-t-transparent mx-auto mb-4"></div>
              <p className="text-brown-600 text-lg">기록을 불러오는 중...</p>
            </div>
          </div>
        ) : !user ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-12 text-center max-w-md">
            <div className="text-6xl mb-4">🔐</div>
            <h2 className="text-2xl font-bold text-brown-800 mb-4">로그인이 필요해요</h2>
            <p className="text-brown-600 mb-6">커피 기록을 보려면 먼저 로그인해주세요</p>
            <Link href="/login" className="inline-block px-6 py-3 bg-gradient-to-r from-coffee-500 to-coffee-600 rounded-button text-white font-medium">
              로그인하기
            </Link>
          </div>
        ) : (
          <div className="w-full max-w-7xl space-y-8">
            {/* 통계 대시보드 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-6 text-center hover:shadow-hover transition-all">
                <div className="text-3xl mb-2">📊</div>
                <div className="text-3xl font-bold text-coffee-600">{totalRecords}</div>
                <div className="text-brown-600 text-sm">총 기록</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-6 text-center hover:shadow-hover transition-all">
                <div className="text-3xl mb-2">⭐</div>
                <div className="text-3xl font-bold text-coffee-600">{avgRating}</div>
                <div className="text-brown-600 text-sm">평균 평점</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-6 text-center hover:shadow-hover transition-all">
                <div className="text-3xl mb-2">🌸</div>
                <div className="text-xl font-bold text-coffee-600">{topFlavor}</div>
                <div className="text-brown-600 text-sm">선호 향미</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-6 text-center hover:shadow-hover transition-all">
                <div className="text-3xl mb-2">🔥</div>
                <div className="text-3xl font-bold text-coffee-600">{recentStreak}</div>
                <div className="text-brown-600 text-sm">연속 기록일</div>
              </div>
            </div>

            {/* 검색 및 필터 */}
            <div className="bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="md:col-span-2">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 카페, 원두, 리뷰 검색..."
                    className="w-full bg-white border border-coffee-200 rounded-button px-4 py-3 text-brown-700 placeholder-brown-400 focus:outline-none focus:ring-2 focus:ring-coffee-400"
                  />
                </div>
                <select 
                  value={selectedFlavor} 
                  onChange={e => setSelectedFlavor(e.target.value)}
                  className="bg-white border border-coffee-200 rounded-button px-4 py-3 text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400"
                >
                  <option value="">모든 향미</option>
                  {allFlavors.map(flavor => (
                    <option key={flavor} value={flavor}>{flavor}</option>
                  ))}
                </select>
                <select 
                  value={minRating} 
                  onChange={e => setMinRating(Number(e.target.value))}
                  className="bg-white border border-coffee-200 rounded-button px-4 py-3 text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400"
                >
                  <option value={0}>모든 평점</option>
                  <option value={5}>⭐⭐⭐⭐⭐ 5점</option>
                  <option value={4}>⭐⭐⭐⭐ 4점 이상</option>
                  <option value={3}>⭐⭐⭐ 3점 이상</option>
                  <option value={2}>⭐⭐ 2점 이상</option>
                  <option value={1}>⭐ 1점 이상</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-brown-600">
                  <span className="font-bold text-coffee-600">{filtered.length}</span>개의 기록을 찾았습니다
                </div>
                {(search || selectedFlavor || minRating > 0) && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setSelectedFlavor("");
                      setMinRating(0);
                    }}
                    className="text-coffee-600 hover:text-coffee-700 font-medium text-sm"
                  >
                    필터 초기화
                  </button>
                )}
              </div>
            </div>

            {/* 기록 목록 */}
            {filtered.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-12 text-center">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-2xl font-bold text-brown-800 mb-4">
                  {records.length === 0 ? "아직 기록이 없어요" : "검색 결과가 없어요"}
                </h3>
                <p className="text-brown-600 mb-6">
                  {records.length === 0 ? "첫 번째 커피 기록을 남겨보세요!" : "다른 검색어나 필터를 사용해보세요"}
                </p>
                {records.length === 0 && (
                  <div className="space-x-4">
                    <Link href="/record/photo" className="inline-block px-6 py-3 bg-gradient-to-r from-coffee-500 to-coffee-600 rounded-button text-white font-medium">
                      📸 사진으로 기록
                    </Link>
                    <Link href="/record/manual" className="inline-block px-6 py-3 bg-gradient-to-r from-brown-500 to-brown-600 rounded-button text-white font-medium">
                      ✍️ 직접 기록
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {dates.map((date, dateIndex) => (
                  <div key={date} className="relative">
                    {/* 타임라인 라인 */}
                    {dateIndex < dates.length - 1 && (
                      <div className="absolute left-6 top-16 w-0.5 h-full bg-gradient-to-b from-coffee-300 to-transparent"></div>
                    )}
                    
                    {/* 날짜 헤더 */}
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-r from-coffee-500 to-brown-600 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-lg">{dayjs(date).format("D")}</span>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-brown-800">
                          {dayjs(date).format("YYYY년 M월 D일")}
                        </h2>
                        <p className="text-brown-600">
                          {dayjs(date).format("dddd")} • {grouped[date].length}개 기록
                        </p>
                      </div>
                    </div>

                    {/* 기록 카드들 */}
                    <div className="ml-16 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {grouped[date].map((record, index) => (
                        <div key={record.id} className="bg-white/90 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-6 hover:shadow-hover transition-all duration-300 group">
                          <div className="flex items-start gap-4">
                            {/* 이미지 또는 아이콘 */}
                            <div className="flex-shrink-0">
                              {record.image ? (
                                <Image 
                                  src={record.image} 
                                  alt={record.bean || record.cafe || "기록"} 
                                  width={80} 
                                  height={80} 
                                  className="rounded-card object-cover shadow-lg group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-20 h-20 bg-gradient-to-br from-coffee-400 to-coffee-600 rounded-card flex items-center justify-center shadow-lg">
                                  <span className="text-3xl">☕</span>
                                </div>
                              )}
                            </div>

                            {/* 기록 내용 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-lg text-brown-800 truncate">
                                  {record.bean || record.cafe || "커피 기록"}
                                </h3>
                                {record.rating && (
                                  <div className="flex items-center gap-1">
                                    {Array.from({length: 5}, (_, i) => (
                                      <span key={i} className={`text-lg ${i < record.rating! ? 'text-yellow-500' : 'text-gray-300'}`}>
                                        ⭐
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {record.cafe && record.bean && (
                                <p className="text-brown-600 text-sm mb-2">
                                  📍 {record.cafe}
                                </p>
                              )}

                              {record.flavor && record.flavor.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {record.flavor.slice(0, 4).map((flavor, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-coffee-100 text-coffee-700 text-xs rounded-button font-medium">
                                      {flavor}
                                    </span>
                                  ))}
                                  {record.flavor.length > 4 && (
                                    <span className="px-2 py-1 bg-brown-100 text-brown-600 text-xs rounded-button">
                                      +{record.flavor.length - 4}
                                    </span>
                                  )}
                                </div>
                              )}

                              {record.review && (
                                <p className="text-brown-700 text-sm line-clamp-2 mb-2">
                                  "{record.review}"
                                </p>
                              )}

                              <div className="flex items-center justify-between text-xs text-brown-500">
                                <span>{dayjs(record.createdAt).format("HH:mm")}</span>
                                <div className="flex gap-2">
                                  {record.mood && (
                                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-button">
                                      {record.mood}
                                    </span>
                                  )}
                                  {record.weather && (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-button">
                                      {record.weather}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
} 