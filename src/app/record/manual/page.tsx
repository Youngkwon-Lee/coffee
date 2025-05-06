"use client";

import { useState, useEffect } from "react";
import cafes from '@/data/cafesList_sample.json';
import useFrequentCafes from "@/hooks/useFrequentCafes";

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

export const BEAN_ORIGINS = [
  {
    origin: "에티오피아",
    varieties: ["예가체프", "시다모", "구지"],
  },
  {
    origin: "콜롬비아",
    varieties: ["우일라", "나리뇨", "톨리마"],
  },
  {
    origin: "파나마",
    varieties: ["게이샤", "카투라", "카투아이"],
  },
  {
    origin: "케냐",
    varieties: ["니에리", "키리냐가", "엠부"],
  },
  {
    origin: "브라질",
    varieties: ["세라도 미네이루", "술 데 미나스", "모지아나"],
  },
];

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
  const handleSave = () => {
    alert("기록이 저장되었습니다!\n" + JSON.stringify(data, null, 2));
    // TODO: Firestore 등 저장 연동
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
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">☕️ 커피 기록 챗봇</h1>
      <div className="flex flex-col gap-2 mb-4">
        {chat.map((msg, idx) => (
          <div
            key={idx}
            className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm whitespace-pre-line
              ${msg.type === "bot" ? "bg-gray-100 self-start" : "bg-yellow-200 self-end"}
            `}
          >
            {msg.text}
          </div>
        ))}
      </div>
      {step === "bean" && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2 mb-2">
            {BEAN_ORIGINS.map(origin => (
              <button
                key={origin.origin}
                className="px-3 py-1 rounded-full border bg-yellow-100"
                onClick={() => {
                  setInput(origin.origin);
                  setOpenOrigin(openOrigin === origin.origin ? null : origin.origin);
                  setTimeout(() => {
                    const el = document.getElementById("bean-input");
                    if (el) (el as HTMLInputElement).focus();
                  }, 0);
                }}
              >
                {origin.origin}
              </button>
            ))}
          </div>
          {BEAN_ORIGINS.map(origin => (
            openOrigin === origin.origin && (
              <div key={origin.origin} className="flex flex-wrap gap-2 mb-2 ml-4">
                {origin.varieties.map(variety => (
                  <button
                    key={variety}
                    className="px-3 py-1 rounded-full border bg-yellow-400 text-white font-bold"
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
            )
          ))}
          <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
            <input
              id="bean-input"
              className="flex-1 border rounded-lg px-3 py-2"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="직접 입력도 가능합니다"
              autoFocus
            />
            <button className="px-4 py-2 bg-yellow-400 rounded-lg font-bold" type="submit">
              입력
            </button>
          </form>
        </div>
      )}
      {step === "cafe" && (
        <div className="mb-4">
          <div className="mb-2 text-xs text-gray-500">가까운 카페</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {geoError ? (
              <span className="text-xs text-gray-400">{geoError}</span>
            ) : nearbyCafes.length > 0 ? (
              nearbyCafes.map(cafe => (
                <button
                  key={cafe.name}
                  className="px-3 py-1 rounded-full border bg-yellow-100"
                  onClick={() => {
                    setData(d => ({ ...d, cafe: cafe.name }));
                    setChat(prev => [...prev, { type: "user", text: cafe.name }]);
                    setChat(prev => [...prev, { type: "bot", text: "향미(여러 개 선택 가능)를 골라주세요!" }]);
                    setStep("flavor");
                  }}
                >
                  {cafe.name} <span className="text-xs text-gray-500">({cafe.distance.toFixed(1)}km)</span>
                </button>
              ))
            ) : (
              <span className="text-xs text-gray-400">위치 정보를 불러오는 중...</span>
            )}
          </div>
          <div className="mb-2 text-xs text-gray-500">자주 간 카페</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {frequentLoading ? (
              <span className="text-xs text-gray-400">불러오는 중...</span>
            ) : frequentCafes.length > 0 ? (
              frequentCafes.map(cafe => (
                <button
                  key={cafe}
                  className="px-3 py-1 rounded-full border bg-rose-100"
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
              <span className="text-xs text-gray-400">기록이 없습니다.</span>
            )}
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
            <input
              className="flex-1 border rounded-lg px-3 py-2"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="직접 입력도 가능합니다"
              autoFocus
            />
            <button className="px-4 py-2 bg-yellow-400 rounded-lg font-bold" type="submit">
              입력
            </button>
          </form>
        </div>
      )}
      {step !== "done" && step !== "flavor" && step !== "mood" && step !== "rating" && step !== "review" && step !== "bean" && step !== "cafe" && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            className="flex-1 border rounded-lg px-3 py-2"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="입력하세요"
            autoFocus
          />
          <button className="px-4 py-2 bg-yellow-400 rounded-lg font-bold" type="submit">
            입력
          </button>
        </form>
      )}
      {step === "flavor" && (
        <>
          <div className="mb-4">
            {FLAVOR_CATEGORIES.map(cat => (
              <div key={cat.category} className="mb-2">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 bg-yellow-100 rounded font-bold"
                  onClick={() => handleCategoryToggle(cat.category)}
                >
                  {cat.category}
                </button>
                {openCategories.includes(cat.category) && (
                  <div className="flex flex-wrap gap-2 mt-2 ml-4">
                    {cat.options.map(flavor => (
                      <button
                        key={flavor}
                        type="button"
                        className={`px-3 py-1 rounded-full border transition-all duration-150 ${
                          selectedFlavors.includes(flavor)
                            ? "bg-yellow-400 text-white font-bold border-yellow-400"
                            : "bg-white text-gray-700 border-gray-300"
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
            className="px-4 py-2 bg-yellow-400 rounded-lg font-bold mb-4"
            onClick={handleFlavorNext}
            disabled={selectedFlavors.length === 0}
          >
            다음
          </button>
        </>
      )}
      {step === "mood" && (
        <div className="flex flex-wrap gap-2 mb-4">
          {MOOD_OPTIONS.map(opt => (
            <button
              key={opt.label}
              className="px-3 py-2 rounded-full border bg-white text-2xl"
              onClick={() => handleMood(opt.emoji + ' ' + opt.label)}
            >
              {opt.emoji} <span className="text-base ml-1">{opt.label}</span>
            </button>
          ))}
          <button
            className="px-3 py-2 rounded-full border bg-gray-200"
            onClick={() => handleMood(undefined)}
          >
            Skip
          </button>
        </div>
      )}
      {step === "rating" && (
        <div className="flex items-center gap-2 mb-4">
          {Array.from({ length: 5 }, (_, i) => (
            <button
              key={i}
              className="text-4xl p-0 m-0 bg-transparent border-none"
              style={{ cursor: "pointer" }}
              onClick={() => handleRating(i + 1)}
              aria-label={`${i + 1}점`}
            >
              {data.rating && data.rating >= i + 1 ? "⭐" : "☆"}
            </button>
          ))}
          <button
            className="px-3 py-2 rounded-full border bg-gray-200 ml-2"
            onClick={() => handleRating(undefined)}
          >
            Skip
          </button>
        </div>
      )}
      {step === "review" && (
        <form
          onSubmit={e => {
            e.preventDefault();
            handleReview(input.trim() || undefined);
          }}
          className="flex gap-2"
        >
          <input
            className="flex-1 border rounded-lg px-3 py-2"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="오늘 커피에 대해 한 줄로 남겨볼까요? (스킵 가능)"
            autoFocus
          />
          <button className="px-4 py-2 bg-yellow-400 rounded-lg font-bold" type="submit">
            입력
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-full border bg-gray-200"
            onClick={() => handleReview(undefined)}
          >
            Skip
          </button>
        </form>
      )}
      {step === "done" && (
        <div className="mt-4 p-4 bg-white rounded-lg shadow">
          <div className="mb-2">☕️ <b>원두명:</b> {data.bean}</div>
          <div className="mb-2">🏠 <b>카페명:</b> {data.cafe}</div>
          <div className="mb-2">🌸 <b>향미:</b> {data.flavor.join(", ")}</div>
          {data.mood && <div className="mb-2">🧘 <b>오늘 기분:</b> {data.mood}</div>}
          {data.rating && <div className="mb-2">⭐ <b>별점:</b> {"⭐".repeat(data.rating)}</div>}
          {data.review && <div className="mb-2">💬 <b>한줄 감상:</b> {data.review}</div>}
          <button
            className="mt-2 px-4 py-2 bg-rose-400 text-white rounded-lg font-bold"
            onClick={handleSave}
          >
            기록 저장
          </button>
        </div>
      )}
    </div>
  );
} 