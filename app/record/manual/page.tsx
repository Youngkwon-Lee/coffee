"use client";

import { useState, useEffect } from "react";
import cafes from '@/data/cafesList_sample.json';
import useFrequentCafes from "@/hooks/useFrequentCafes";
import { BEAN_ORIGINS } from "@/constants/beanOrigins";
import { db, auth } from "@/firebase";
import { collection, addDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

type Step = "bean" | "cafe" | "flavor" | "mood" | "rating" | "review" | "done";
type RecordData = {
  bean: string;
  cafe: string;
  flavor: string[];
  mood?: string;
  rating?: number;
  review?: string;
};

type ChatMessage = {
  type: "bot" | "user";
  text: string;
};

const FLAVOR_CATEGORIES = [
  {
    category: "Fruity",
    options: ["Citrus", "Berry-like", "Winey", "Floral", "Fruity"]
  },
  {
    category: "Nutty & Sweet",
    options: ["Nutty", "Malty", "Candy-like", "Syrup-like", "Chocolate-like", "Vanilla-like", "Caramel"]
  },
  {
    category: "Herby & Spicy",
    options: ["Herby", "Spicy", "Resinous", "Medicinal"]
  },
  {
    category: "Acidity & Sour",
    options: ["Sour", "Acidic", "Tart"]
  },
  {
    category: "Bitter & Others",
    options: ["Bitter", "Mellow", "Sweet", "Earthy", "Smoky", "Astringent"]
  }
];

const MOOD_OPTIONS = [
  { emoji: "😌", label: "가라앉아요" },
  { emoji: "😃", label: "활기차요" },
  { emoji: "🥰", label: "설레요" },
  { emoji: "😐", label: "평온해요" },
  { emoji: "😴", label: "졸려요" }
];

interface BeanOrigin {
  origin: string;
  varieties: string[];
}

export default function RecordManualPage() {
  const [step, setStep] = useState<Step>("bean");
  const [input, setInput] = useState("");
  const [data, setData] = useState<RecordData>({ bean: "", cafe: "", flavor: [] });
  const [chat, setChat] = useState<ChatMessage[]>([
    { type: "bot", text: "원두명을 입력해 주세요!" }
  ]);
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [openOrigin, setOpenOrigin] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [myRecords, setMyRecords] = useState<RecordData[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [hoveredRating, setHoveredRating] = useState<number>(0);

  // 자주 사용한 원두/카페 분석
  const [frequentBeans, setFrequentBeans] = useState<string[]>([]);
  const [recentBeans, setRecentBeans] = useState<string[]>([]);
  const [preferredFlavors, setPreferredFlavors] = useState<string[]>([]);
  
  useEffect(() => {
    async function analyzeUserPreferences() {
      if (!userId) return;
      
      try {
        // 최근 20개 기록 가져오기
        const q = query(
          collection(db, `users/${userId}/records`), 
          orderBy("createdAt", "desc"), 
          limit(20)
        );
        const snap = await getDocs(q);
        const records = snap.docs.map(doc => doc.data() as RecordData);
        
        // 원두 빈도 분석
        const beanFrequency: { [key: string]: number } = {};
        const flavorFrequency: { [key: string]: number } = {};
        
        records.forEach(record => {
          // 원두 빈도
          if (record.bean) {
            beanFrequency[record.bean] = (beanFrequency[record.bean] || 0) + 1;
          }
          
          // 향미 빈도
          if (record.flavor && Array.isArray(record.flavor)) {
            record.flavor.forEach(flavor => {
              flavorFrequency[flavor] = (flavorFrequency[flavor] || 0) + 1;
            });
          }
        });
        
        // 자주 사용한 원두 (2회 이상)
        const frequentBeanList = Object.entries(beanFrequency)
          .filter(([_, count]) => count >= 2)
          .sort(([,a], [,b]) => b - a)
          .map(([bean]) => bean)
          .slice(0, 6);
        
        // 최근 사용한 원두 (중복 제거)
        const recentBeanList = [...new Set(records.map(r => r.bean).filter(Boolean))].slice(0, 5);
        
        // 선호하는 향미 (2회 이상)
        const preferredFlavorList = Object.entries(flavorFrequency)
          .filter(([_, count]) => count >= 2)
          .sort(([,a], [,b]) => b - a)
          .map(([flavor]) => flavor)
          .slice(0, 6);
        
        setFrequentBeans(frequentBeanList);
        setRecentBeans(recentBeanList);
        setPreferredFlavors(preferredFlavorList);
        
      } catch (error) {
        console.error("사용자 선호도 분석 오류:", error);
      }
    }
    
    analyzeUserPreferences();
  }, [userId]);

  // 위치 기반 가까운 카페 추천
  function getDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const [nearbyCafes, setNearbyCafes] = useState<{name: string, distance: number}[]>([]);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    if (step === "cafe") {
      if (!navigator.geolocation) {
        setGeoError("위치 정보 사용이 불가합니다.");
        setNearbyCafes([]);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => {
          setGeoError(null);
          const { latitude, longitude } = pos.coords;
          const cafesWithDistance = (cafes as {lat: number, lng: number, name: string}[])
            .filter(cafe => cafe.lat && cafe.lng)
            .map(cafe => ({
              ...cafe,
              distance: getDistance(latitude, longitude, cafe.lat, cafe.lng)
            }));
          cafesWithDistance.sort((a, b) => a.distance - b.distance);
          setNearbyCafes(cafesWithDistance.slice(0, 3));
        },
        () => {
          setGeoError("위치 권한이 필요합니다.");
          setNearbyCafes([]);
        }
      );
    }
  }, [step]);

  useEffect(() => {
    if (step === "cafe") {
      setInput("");
    }
  }, [step]);

  const { frequentCafes, loading: frequentLoading } = useFrequentCafes();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  // 내 기록 불러오기
  useEffect(() => {
    if (!userId) {
      setMyRecords([]);
      setLoadingRecords(false);
      return;
    }
    async function fetchRecords() {
      setLoadingRecords(true);
      const q = query(collection(db, `users/${userId}/records`), orderBy("createdAt", "desc"), limit(3));
      const snap = await getDocs(q);
      setMyRecords(snap.docs.map(doc => doc.data() as RecordData));
      setLoadingRecords(false);
    }
    fetchRecords();
  }, [userId]);

  // 챗봇 입력 처리
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setChat(prev => [...prev, { type: "user", text: input }]);

    if (step === "bean") {
      setData(d => ({ ...d, bean: input.trim() }));
      setChat(prev => [...prev, { type: "bot", text: "카페명을 입력해 주세요!" }]);
      setStep("cafe");
    } else if (step === "cafe") {
      setData(d => ({ ...d, cafe: input.trim() }));
      setChat(prev => [...prev, { type: "bot", text: "향미(여러 개 선택 가능)를 골라주세요!" }]);
      setStep("flavor");
      setSelectedFlavors([]);
      setOpenCategories([]);
    }
    setInput("");
  };

  // flavor 단계: 카테고리 펼침/접힘
  const handleCategoryToggle = (category: string) => {
    setOpenCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // flavor 단계: 옵션 클릭
  const handleFlavorClick = (flavor: string) => {
    setSelectedFlavors(prev =>
      prev.includes(flavor) ? prev.filter(f => f !== flavor) : [...prev, flavor]
    );
  };

  // flavor 단계: '다음' 버튼
  const handleFlavorNext = () => {
    setData(d => ({ ...d, flavor: selectedFlavors }));
    setChat(prev => [...prev, { type: "user", text: selectedFlavors.join(", ") }]);
    setChat(prev => [...prev, { type: "bot", text: "오늘 기분은 어떤가요? (스킵 가능)" }]);
    setStep("mood");
    setSelectedFlavors([]);
    setOpenCategories([]);
  };

  // 기록 저장(실제 저장 로직은 추후 구현)
  const handleSave = async () => {
    if (!userId) {
      alert("로그인이 필요합니다.");
      return;
    }

    // 필수 데이터 검증
    if (!data.bean || !data.cafe || !data.flavor || data.flavor.length === 0) {
      alert("원두명, 카페명, 향미는 필수 입력 항목입니다.");
      return;
    }

    try {
      const recordData: any = {
        bean: data.bean.trim(),
        cafe: data.cafe.trim(),
        flavor: data.flavor.filter(f => f.trim() !== ""), // 빈 향미 제거
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // undefined 값이 아닌 경우에만 필드 추가 (Firebase는 undefined를 허용하지 않음)
      if (data.mood) recordData.mood = data.mood;
      if (data.rating) recordData.rating = data.rating;
      if (data.review?.trim()) recordData.review = data.review.trim();

      console.log("저장할 데이터:", recordData); // 디버깅용

      await addDoc(collection(db, `users/${userId}/records`), recordData);
      
      // 저장 즉시 로컬 상태에 새 기록 추가 (즉시 반영)
      const newRecord = { ...recordData };
      setMyRecords(prevRecords => [newRecord, ...prevRecords.slice(0, 4)]);
      
      alert("기록이 저장되었습니다!");
      
      // 백그라운드에서 실제 데이터 새로고침 (정확성 보장)
      setTimeout(async () => {
        try {
          const q = query(collection(db, `users/${userId}/records`), orderBy("createdAt", "desc"), limit(5));
          const snap = await getDocs(q);
          const updatedRecords = snap.docs.map(doc => doc.data() as RecordData);
          setMyRecords(updatedRecords);
          console.log("백그라운드 기록 새로고침 완료:", updatedRecords.length, "개 기록");
        } catch (fetchError) {
          console.error("백그라운드 기록 새로고침 오류:", fetchError);
        }
      }, 1000);

      // 성공 시 초기화
      setData({ bean: "", cafe: "", flavor: [] });
      setStep("bean");
      setChat([{ type: "bot", text: "안녕하세요! 오늘 마신 커피 원두를 알려주세요 😊" }]);
      
    } catch (error) {
      console.error("저장 오류:", error);
      
      // 구체적인 오류 메시지 제공
      if (error instanceof Error) {
        if (error.message.includes("permission-denied")) {
          alert("데이터베이스 접근 권한이 없습니다. 다시 로그인해주세요.");
        } else if (error.message.includes("network")) {
          alert("네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.");
        } else {
          alert(`저장 중 오류가 발생했습니다: ${error.message}`);
        }
      } else {
        alert("저장 중 알 수 없는 오류가 발생했습니다. 다시 시도해주세요.");
      }
    }
  };

  // 별점 선택
  const handleRating = (star: number | undefined) => {
    setData(d => ({ ...d, rating: star }));
    setChat(prev => [...prev, { type: "user", text: star ? "⭐".repeat(star) : "Skip" }]);
    setChat(prev => [...prev, { type: "bot", text: "오늘 커피에 대해 한 줄로 남겨볼까요? (스킵 가능)" }]);
    setStep("review");
  };

  // 기분 선택
  const handleMood = (mood: string | undefined) => {
    setData(d => ({ ...d, mood }));
    setChat(prev => [...prev, { type: "user", text: mood || "Skip" }]);
    setChat(prev => [...prev, { type: "bot", text: "오늘 커피 별점은 몇 점인가요? (스킵 가능)" }]);
    setStep("rating");
  };

  // 한줄 감상평 입력/스킵
  const handleReview = (review: string | undefined) => {
    setData(d => ({ ...d, review }));
    setChat(prev => [...prev, { type: "user", text: review || "Skip" }]);
    setChat(prev => [...prev, { type: "bot", text: "입력이 완료되었습니다!\n아래 정보로 기록을 저장할까요?" }]);
    setStep("done");
    setInput("");
  };

  // review 단계 진입 시 입력란 비우기
  useEffect(() => {
    if (step === "review") {
      setInput("");
    }
  }, [step]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-coffee-50 to-cream-100 pt-20 pb-20">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-brown-800 mb-4">
            ✍️ 직접 입력하기
          </h1>
          <p className="text-brown-600">AI 어시스턴트와 대화하며 커피 기록을 남겨보세요</p>
        </div>

        {/* AI 어시스턴트 메인 채팅 영역 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-6">
          <h2 className="text-lg font-display font-bold text-brown-800 mb-4">💬 AI 어시스턴트</h2>
          
          <div className="flex flex-col gap-3 h-[400px] overflow-y-auto p-4 bg-coffee-50 rounded-card border border-coffee-100 mb-4">
        {chat.map((msg, idx) => (
          <div
            key={idx}
                className={`max-w-[85%] transition-all duration-200 ${
                  msg.type === "bot" ? "self-start" : "self-end"
                }`}
              >
                <div
                  className={`px-4 py-3 rounded-button text-sm whitespace-pre-line ${
                    msg.type === "bot" 
                      ? "bg-white text-brown-700 shadow-sm border border-coffee-200" 
                      : "bg-gradient-to-r from-coffee-500 to-coffee-600 text-white shadow-lg"
                  }`}
          >
            {msg.text}
                </div>
          </div>
        ))}
      </div>

          {/* 원두 선택 */}
      {step === "bean" && (
            <div className="space-y-4">

              
              {/* 직접 입력 */}
                <div>
                <label className="block text-sm font-medium text-brown-700 mb-2">✏️ 직접 입력</label>
                <form onSubmit={handleSubmit} className="flex gap-3 mb-4">
            <input
              id="bean-input"
                    className="flex-1 px-4 py-3 border border-coffee-200 rounded-button bg-white text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400 focus:border-transparent transition-all duration-200"
              value={input}
              onChange={e => setInput(e.target.value)}
                    placeholder="원두명을 입력하세요"
              autoFocus
            />
                  <button className="px-6 py-3 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-button font-medium shadow-lg hover:shadow-hover transition-all duration-200" type="submit">
                    다음
            </button>
          </form>
                
                {/* 채팅 형태의 원두 선택 */}
                <div className="bg-white rounded-2xl shadow-lg p-4 border border-coffee-200">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-coffee-400 to-brown-400 text-white flex items-center justify-center text-sm">
                      🤖
                    </div>
                    <div className="bg-cream-100 rounded-2xl p-3 max-w-xs">
                      <p className="text-sm text-brown-800">원두를 빠르게 선택해보세요!</p>
                    </div>
                  </div>
                  
                  {/* 자주 사용한 원두 채팅 버튼 */}
                  {frequentBeans.length > 0 && (
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-coffee-400 to-brown-400 text-white flex items-center justify-center text-sm">
                        🤖
                      </div>
                      <div className="bg-cream-100 rounded-2xl p-3 flex-1">
                        <p className="text-xs text-brown-600 mb-2">⭐ 자주 사용한 원두</p>
                        <div className="flex flex-wrap gap-2">
                    {frequentBeans.map(bean => (
                      <button
                        key={bean}
                              className="px-3 py-2 text-xs bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-xl font-medium hover:from-coffee-600 hover:to-coffee-700 transition-all duration-200 shadow-sm hover:shadow-md"
                        onClick={() => {
                          setData(d => ({ ...d, bean }));
                          setChat(prev => [...prev, { type: "user", text: bean }]);
                          setChat(prev => [...prev, { type: "bot", text: "카페명을 입력해 주세요!" }]);
                          setStep("cafe");
                        }}
                      >
                              {bean}
                      </button>
                    ))}
                        </div>
                  </div>
                </div>
              )}

                  {/* 최근 사용한 원두 채팅 버튼 */}
              {recentBeans.length > 0 && (
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-coffee-400 to-brown-400 text-white flex items-center justify-center text-sm">
                        🤖
                      </div>
                      <div className="bg-cream-100 rounded-2xl p-3 flex-1">
                        <p className="text-xs text-brown-600 mb-2">🕒 최근 사용한 원두</p>
                        <div className="flex flex-wrap gap-2">
                    {recentBeans.filter(bean => !frequentBeans.includes(bean)).map(bean => (
                      <button
                        key={bean}
                              className="px-3 py-2 text-xs bg-gradient-to-r from-brown-500 to-brown-600 text-white rounded-xl font-medium hover:from-brown-600 hover:to-brown-700 transition-all duration-200 shadow-sm hover:shadow-md"
                        onClick={() => {
                          setData(d => ({ ...d, bean }));
                          setChat(prev => [...prev, { type: "user", text: bean }]);
                          setChat(prev => [...prev, { type: "bot", text: "카페명을 입력해 주세요!" }]);
                          setStep("cafe");
                        }}
                      >
                              {bean}
                      </button>
                    ))}
                        </div>
                  </div>
                </div>
              )}

                  {/* 원산지별 원두 채팅 버튼 */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-coffee-400 to-brown-400 text-white flex items-center justify-center text-sm">
                      🤖
                    </div>
                    <div className="bg-cream-100 rounded-2xl p-3 flex-1">
                      <p className="text-xs text-brown-600 mb-2">🌍 원산지별 원두</p>
                <div className="flex flex-wrap gap-2 mb-3">
            {BEAN_ORIGINS.map((origin: BeanOrigin) => (
              <button
                key={origin.origin}
                            className="px-3 py-2 text-xs bg-coffee-100 hover:bg-coffee-200 text-brown-700 rounded-xl font-medium transition-colors duration-200 border border-coffee-200"
                onClick={() => {
                  setOpenOrigin(openOrigin === origin.origin ? null : origin.origin);
                }}
              >
                {origin.origin}
              </button>
            ))}
          </div>
                
                {/* 품종 버튼들 */}
          {BEAN_ORIGINS.map((origin: BeanOrigin) => (
            openOrigin === origin.origin && (
                          <div key={origin.origin} className="p-2 bg-coffee-50 rounded-xl border border-coffee-200 mt-2">
                            <p className="text-xs font-medium text-brown-700 mb-2">{origin.origin} 품종:</p>
                            <div className="flex flex-wrap gap-1">
                {origin.varieties.map((variety: string) => (
                  <button
                    key={variety}
                                  className="px-2 py-1 text-xs bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-lg font-medium hover:from-coffee-600 hover:to-coffee-700 transition-all duration-200 shadow-sm"
                    onClick={() => {
                      setData(d => ({ ...d, bean: `${origin.origin} ${variety}` }));
                      setChat(prev => [...prev, { type: "user", text: `${origin.origin} ${variety}` }]);
                      setChat(prev => [...prev, { type: "bot", text: "카페명을 입력해 주세요!" }]);
                      setStep("cafe");
                      setOpenOrigin(null);
                    }}
                  >
                    {variety}
                  </button>
                ))}
                      </div>
              </div>
            )
          ))}
              </div>
                  </div>
                </div>
              </div>
        </div>
      )}

          {/* 카페 선택 */}
      {step === "cafe" && (
            <div className="space-y-4">
              {/* 가까운 카페 */}
              <div>
                <label className="block text-sm font-medium text-brown-700 mb-2">가까운 카페</label>
                <div className="flex flex-wrap gap-2 mb-3">
            {geoError ? (
                    <span className="text-sm text-brown-500 p-2">{geoError}</span>
            ) : nearbyCafes.length > 0 ? (
              nearbyCafes.map(cafe => (
                <button
                  key={cafe.name}
                        className="px-4 py-2 rounded-button border bg-coffee-100 hover:bg-coffee-200 text-brown-700 font-medium transition-colors duration-200"
                  onClick={() => {
                    setData(d => ({ ...d, cafe: cafe.name }));
                    setChat(prev => [...prev, { type: "user", text: cafe.name }]);
                    setChat(prev => [...prev, { type: "bot", text: "향미(여러 개 선택 가능)를 골라주세요!" }]);
                    setStep("flavor");
                  }}
                >
                        {cafe.name} <span className="text-xs text-brown-500">({cafe.distance.toFixed(1)}km)</span>
                </button>
              ))
            ) : (
                    <span className="text-sm text-brown-500 p-2">위치 정보를 불러오는 중...</span>
            )}
          </div>
              </div>

              {/* 자주 간 카페 */}
              <div>
                <label className="block text-sm font-medium text-brown-700 mb-2">자주 간 카페</label>
                <div className="flex flex-wrap gap-2 mb-3">
            {frequentLoading ? (
                    <span className="text-sm text-brown-500 p-2">불러오는 중...</span>
            ) : frequentCafes.length > 0 ? (
              frequentCafes.map(cafe => (
                <button
                  key={cafe}
                        className="px-4 py-2 rounded-button border bg-brown-100 hover:bg-brown-200 text-brown-700 font-medium transition-colors duration-200"
                  onClick={() => {
                    setData(d => ({ ...d, cafe }));
                    setChat(prev => [...prev, { type: "user", text: cafe }]);
                    setChat(prev => [...prev, { type: "bot", text: "향미(여러 개 선택 가능)를 골라주세요!" }]);
                    setStep("flavor");
                  }}
                >
                  {cafe}
                </button>
              ))
            ) : (
                    <span className="text-sm text-brown-500 p-2">기록이 없습니다.</span>
            )}
          </div>
              </div>

              {/* 직접 입력 */}
              <div>
                <label className="block text-sm font-medium text-brown-700 mb-2">직접 입력</label>
                <form onSubmit={handleSubmit} className="flex gap-3">
            <input
                    className="flex-1 px-4 py-3 border border-coffee-200 rounded-button bg-white text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400 focus:border-transparent transition-all duration-200"
              value={input}
              onChange={e => setInput(e.target.value)}
                    placeholder="카페명을 입력하세요"
              autoFocus
            />
                  <button className="px-6 py-3 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-button font-medium shadow-lg hover:shadow-hover transition-all duration-200" type="submit">
                    다음
            </button>
          </form>
              </div>
        </div>
      )}

          {/* 향미 선택 */}
          {step === "flavor" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-brown-700 mb-3">향미 (여러 개 선택 가능)</label>
                
                {/* 선호하는 향미 (자주 사용한 향미) */}
                {preferredFlavors.length > 0 && (
                  <div className="mb-4 p-3 bg-gradient-to-r from-coffee-100 to-brown-100 rounded-card border border-coffee-200">
                    <p className="text-sm font-medium text-brown-800 mb-2">⭐ 자주 선택한 향미</p>
                    <div className="flex flex-wrap gap-2">
                      {preferredFlavors.map(flavor => (
                        <button
                          key={flavor}
                          type="button"
                          className={`px-3 py-1 rounded-button border transition-all duration-200 text-xs font-medium ${
                            selectedFlavors.includes(flavor)
                              ? "bg-coffee-500 text-white border-coffee-500 shadow-lg"
                              : "bg-coffee-300 text-white border-coffee-300 hover:bg-coffee-400"
                          }`}
                          onClick={() => handleFlavorClick(flavor)}
                        >
                          ⭐ {flavor}
          </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 선택된 향미 표시 */}
                {selectedFlavors.length > 0 && (
                  <div className="mb-4 p-3 bg-white rounded-card border border-coffee-100">
                    <p className="text-sm font-medium text-brown-800 mb-2">선택된 향미:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedFlavors.map(flavor => (
                        <div 
                          key={flavor} 
                          className="flex items-center gap-2 px-3 py-1 bg-coffee-500 text-white rounded-button font-medium text-sm"
                        >
                          <span>{flavor}</span>
                          <button 
                            type="button" 
                            className="w-4 h-4 bg-coffee-600 hover:bg-coffee-700 rounded-full flex items-center justify-center transition-colors duration-200 text-xs"
                            onClick={() => handleFlavorClick(flavor)}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 향미 카테고리 */}
                <div className="space-y-2 mb-4">
            {FLAVOR_CATEGORIES.map(cat => (
                    <div key={cat.category}>
                <button
                  type="button"
                        className="w-full text-left px-3 py-2 bg-coffee-200 hover:bg-coffee-300 rounded-button font-medium text-brown-800 transition-colors duration-200 text-sm"
                  onClick={() => handleCategoryToggle(cat.category)}
                >
                        {cat.category} {openCategories.includes(cat.category) ? '▼' : '▶'}
                </button>
                {openCategories.includes(cat.category) && (
                  <div className="flex flex-wrap gap-2 mt-2 ml-4">
                    {cat.options.map(flavor => (
                      <button
                        key={flavor}
                        type="button"
                              className={`px-3 py-1 rounded-button border transition-all duration-200 text-xs font-medium ${
                          selectedFlavors.includes(flavor)
                                  ? "bg-coffee-500 text-white border-coffee-500 shadow-lg"
                                  : "bg-white text-brown-700 border-coffee-200 hover:bg-coffee-50"
                        }`}
                        onClick={() => handleFlavorClick(flavor)}
                      >
                        {flavor}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
                  className="w-full px-6 py-3 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-button font-medium shadow-lg hover:shadow-hover transition-all duration-200 disabled:opacity-50"
            onClick={handleFlavorNext}
            disabled={selectedFlavors.length === 0}
          >
            다음
          </button>
              </div>
            </div>
      )}

          {/* 기분 선택 */}
      {step === "mood" && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-brown-700">오늘의 기분</label>
              <div className="flex flex-wrap gap-3">
          {MOOD_OPTIONS.map(opt => (
            <button
              key={opt.label}
                    className="flex items-center gap-2 px-4 py-3 rounded-button border bg-white hover:bg-coffee-50 text-brown-700 font-medium transition-colors duration-200"
              onClick={() => handleMood(opt.emoji + ' ' + opt.label)}
            >
                    <span className="text-xl">{opt.emoji}</span>
                    <span>{opt.label}</span>
            </button>
          ))}
          <button
                  className="px-4 py-3 rounded-button border bg-brown-100 hover:bg-brown-200 text-brown-700 font-medium transition-colors duration-200"
            onClick={() => handleMood(undefined)}
          >
                  건너뛰기
          </button>
              </div>
        </div>
      )}

          {/* 별점 선택 */}
      {step === "rating" && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-brown-700">평점</label>
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
          {Array.from({ length: 5 }, (_, i) => {
            const isActive = hoveredRating > 0 ? hoveredRating >= i + 1 : (data.rating || 0) >= i + 1;
            return (
              <button
                key={i}
                        className="w-8 h-8 transition-all duration-200 hover:scale-110 focus:outline-none"
                onClick={() => handleRating(i + 1)}
                onMouseEnter={() => setHoveredRating(i + 1)}
                onMouseLeave={() => setHoveredRating(0)}
                aria-label={`${i + 1}점`}
              >
                        <svg 
                          className="w-full h-full" 
                          viewBox="0 0 24 24" 
                          fill={isActive ? "#f59e0b" : "transparent"} 
                          stroke="#f59e0b" 
                          strokeWidth="2"
                        >
                          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2" />
                        </svg>
              </button>
            );
          })}
                </div>
          <button
                  className="px-4 py-3 rounded-button border bg-brown-100 hover:bg-brown-200 text-brown-700 font-medium transition-colors duration-200"
            onClick={() => handleRating(undefined)}
          >
                  건너뛰기
          </button>
              </div>
        </div>
      )}

          {/* 한줄평 입력 */}
      {step === "review" && (
            <div className="space-y-4">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleReview(input.trim() || undefined);
          }}
                className="space-y-3"
        >
                <label className="block text-sm font-medium text-brown-700">한줄평</label>
                <textarea
                  className="w-full px-4 py-3 border border-coffee-200 rounded-button bg-white text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400 focus:border-transparent transition-all duration-200 resize-none"
                  rows={3}
            value={input}
            onChange={e => setInput(e.target.value)}
                  placeholder="오늘 커피에 대해 한 줄로 남겨볼까요? (건너뛰기 가능)"
            autoFocus
          />
                <div className="flex gap-3">
                  <button className="flex-1 px-6 py-3 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-button font-medium shadow-lg hover:shadow-hover transition-all duration-200" type="submit">
                    완료
          </button>
          <button
            type="button"
                    className="px-4 py-3 rounded-button border bg-brown-100 hover:bg-brown-200 text-brown-700 font-medium transition-colors duration-200"
            onClick={() => handleReview(undefined)}
          >
                    건너뛰기
          </button>
                </div>
        </form>
            </div>
      )}

          {/* 저장 확인 */}
      {step === "done" && (
            <div className="space-y-6">
              <div className="p-4 bg-coffee-50 rounded-card border border-coffee-200">
                <h3 className="text-lg font-medium text-brown-800 mb-4">기록 확인</h3>
                <div className="space-y-2 text-sm text-brown-700">
                  <div><span className="font-medium">☕️ 원두:</span> {data.bean}</div>
                  <div><span className="font-medium">🏠 카페:</span> {data.cafe}</div>
                  <div><span className="font-medium">🌸 향미:</span> {data.flavor.join(", ")}</div>
                  {data.mood && <div><span className="font-medium">🧘 기분:</span> {data.mood}</div>}
                  {data.rating && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">⭐ 별점:</span>
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }, (_, i) => (
                          <svg 
                            key={i}
                            className="w-4 h-4" 
                            viewBox="0 0 24 24" 
                            fill={(data.rating || 0) >= i + 1 ? "#f59e0b" : "transparent"} 
                            stroke="#f59e0b" 
                            strokeWidth="2"
                          >
                            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2" />
                          </svg>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.review && <div><span className="font-medium">💬 감상:</span> {data.review}</div>}
                </div>
              </div>
          <button
                className="w-full px-6 py-4 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-button font-medium shadow-lg hover:shadow-hover transition-all duration-200"
            onClick={handleSave}
          >
                💾 기록 저장하기
          </button>
        </div>
      )}

          {/* 기본 입력 (다른 단계들) */}
          {step !== "done" && step !== "flavor" && step !== "mood" && step !== "rating" && step !== "review" && step !== "bean" && step !== "cafe" && (
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                className="flex-1 px-4 py-3 border border-coffee-200 rounded-button bg-white text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400 focus:border-transparent transition-all duration-200"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="입력하세요"
                autoFocus
              />
              <button className="px-6 py-3 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-button font-medium shadow-lg hover:shadow-hover transition-all duration-200" type="submit">
                다음
              </button>
            </form>
          )}

        </div>

        {/* 내 최근 기록 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-6 mt-6">
          <h3 className="text-lg font-display font-bold text-brown-800 mb-4">📚 내 최근 기록</h3>
        {loadingRecords ? (
            <div className="text-center py-4 text-brown-600">불러오는 중...</div>
        ) : myRecords.length === 0 ? (
            <div className="text-center py-4 text-brown-500">최근 기록이 없습니다.</div>
        ) : (
            <div className="space-y-2">
            {myRecords.map((rec, i) => (
                <div key={i} className="p-3 bg-coffee-50 rounded-card border border-coffee-200">
                  <div className="text-sm text-brown-700 space-y-1">
                    <div><span className="font-medium">☕️ 원두:</span> {rec.bean}</div>
                    <div><span className="font-medium">🏠 카페:</span> {rec.cafe}</div>
                    <div><span className="font-medium">🌸 향미:</span> {rec.flavor?.join(", ")}</div>
                    {rec.mood && <div><span className="font-medium">🧘 기분:</span> {rec.mood}</div>}
                    {rec.rating && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">⭐ 별점:</span>
                        <div className="flex gap-1">
                          {Array.from({ length: 5 }, (_, i) => (
                            <svg 
                              key={i}
                              className="w-3 h-3" 
                              viewBox="0 0 24 24" 
                              fill={(rec.rating || 0) >= i + 1 ? "#f59e0b" : "transparent"} 
                              stroke="#f59e0b" 
                              strokeWidth="2"
                            >
                              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2" />
                            </svg>
                          ))}
                        </div>
                      </div>
                    )}
                    {rec.review && <div><span className="font-medium">💬 감상:</span> {rec.review}</div>}
                  </div>
                </div>
            ))}
            </div>
        )}
        </div>
      </div>
    </div>
  );
} 