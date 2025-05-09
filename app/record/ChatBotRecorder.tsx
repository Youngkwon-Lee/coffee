"use client";
import { useState, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import { db, auth } from "@/firebase";
import { collection, addDoc, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { motion } from "framer-motion";
import Image from "next/image";

const KAKAO_API_KEY = "24ddecafd36b81b810a0ba245b4bdba4";

const QUESTIONS = [
  { type: "text", message: "어떤 커피를 마셨나요?" },
  { type: "text", message: "어디서 마셨나요?" },
  { type: "emotion", message: "오늘 기분은 어땠나요?" },
  { type: "note", message: "컵노트를 골라볼까요?\n오늘 커피에서 어떤 향미가 느껴졌나요? 아래에서 어울리는 노트를 골라주세요. 여러 개 선택할 수 있어요!" },
  { type: "location", message: "혹시 지금 계신 위치를 기록해드릴까요?" },
  { type: "rating", message: "오늘 커피에 별점을 준다면? (1~5)" },
  { type: "repurchase", message: "이 커피를 다시 마시고 싶으신가요?" },
  { type: "photo", message: "사진을 첨부해볼까요? (선택)" },
  { type: "memo", message: "느낀 점을 자유롭게 메모해주세요" },
];

type LocationType = {
  lat: number;
  lng: number;
  address?: string;
  provider?: string;
  label?: string;
} | null;

const COFFEE_GROUPS = [
  {
    name: "에스프레소 계열",
    items: ["Espresso", "Doppio", "Macchiato", "Flat White", "Cortado", "Americano"]
  },
  {
    name: "브루잉 커피",
    items: ["V60", "Chemex", "French Press", "Cold Brew", "Siphon"]
  },
  {
    name: "라떼 계열",
    items: ["Latte", "Vanilla Latte", "Dirty", "Mocha", "Spanish Latte", "Green Tea Latte"]
  }
];

const STATIC_CAFE_LIST = ["커피휘엘", "프릳츠", "빈브라더스", "앤트러사이트", "블루보틀"];

function getTimeOfDay(date: Date) {
  const h = date.getHours();
  if (h < 6) return '새벽';
  if (h < 11) return '아침';
  if (h < 15) return '점심';
  if (h < 18) return '오후';
  if (h < 21) return '저녁';
  return '밤';
}

async function fetchKakaoAddress(lat: number, lng: number): Promise<string | null> {
  const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` }
  });
  const data = await res.json();
  return data.documents?.[0]?.address?.address_name || null;
}

export default function ChatBotRecorder() {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [selectedEmo, setSelectedEmo] = useState("");
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [location, setLocation] = useState<LocationType>(null);
  const [locStatus, setLocStatus] = useState<"idle"|"loading"|"success"|"fail">("idle");
  const [rating, setRating] = useState<number | null>(null);
  const [repurchase, setRepurchase] = useState<boolean | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [coffee, setCoffee] = useState("");
  const [coffeeRecommended, setCoffeeRecommended] = useState<boolean>(false);
  const [showCoffeeInput, setShowCoffeeInput] = useState(false);
  const [recentCoffees, setRecentCoffees] = useState<string[]>([]);
  const [cafe, setCafe] = useState("");
  const [cafeByLocation, setCafeByLocation] = useState<boolean>(false);
  const [showCafeInput, setShowCafeInput] = useState(false);
  const [cafeOptions, setCafeOptions] = useState<string[]>(STATIC_CAFE_LIST);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchRecentCoffees() {
      if (!userId) return;
      const q = query(
        collection(db, "records"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(3)
      );
      const snap = await getDocs(q);
      const recent: string[] = Array.from(new Set(snap.docs.map(doc => doc.data().coffee as string))).filter(Boolean);
      setRecentCoffees(recent);
    }
    fetchRecentCoffees();
  }, [userId]);

  // 위치 기반 카페 추천 fetch
  async function fetchNearbyCafes() {
    if (!navigator.geolocation) return setCafeOptions(STATIC_CAFE_LIST);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const res = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?category_group_code=CE7&x=${longitude}&y=${latitude}&radius=1000&sort=distance`, {
          headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` }
        });
        const data: { documents?: { place_name: string }[] } = await res.json();
        const cafes = data.documents?.map((doc) => doc.place_name).filter(Boolean) ?? [];
        if (cafes.length > 0) setCafeOptions(cafes.slice(0, 5));
        else setCafeOptions(STATIC_CAFE_LIST);
      } catch {
        setCafeOptions(STATIC_CAFE_LIST);
      }
    }, () => setCafeOptions(STATIC_CAFE_LIST));
  }

  // 카페 입력 단계 진입 시 자동 fetch
  useEffect(() => {
    if (step === 1) fetchNearbyCafes();
    // eslint-disable-next-line
  }, [step]);

  // 메시지 리스트: 질문/응답 쌓기
  const messages: { role: "bot"|"user", content: string }[] = [];
  for (let i = 0; i < step; i++) {
    messages.push({ role: "bot", content: QUESTIONS[i].message });
    if (QUESTIONS[i].type === "text") messages.push({ role: "user", content: i === 0 ? coffee : i === 1 ? cafe : "" });
    if (QUESTIONS[i].type === "emotion") messages.push({ role: "user", content: selectedEmo });
    if (QUESTIONS[i].type === "note") messages.push({ role: "user", content: selectedNotes.join(", ") });
    if (QUESTIONS[i].type === "location") messages.push({ role: "user", content: location?.address || location?.label || "위치 미기록" });
    if (QUESTIONS[i].type === "rating") messages.push({ role: "user", content: rating ? `${rating}점` : "" });
    if (QUESTIONS[i].type === "repurchase") messages.push({ role: "user", content: repurchase === null ? "" : repurchase ? "예" : "아니오" });
    if (QUESTIONS[i].type === "photo") messages.push({ role: "user", content: imageUrl ? "사진 첨부됨" : "사진 없음" });
    if (QUESTIONS[i].type === "memo") messages.push({ role: "user", content: memo });
  }
  if (step < QUESTIONS.length) {
    messages.push({ role: "bot", content: QUESTIONS[step].message });
  }

  // 입력 핸들러
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setCoffee(input.trim());
    setCoffeeRecommended(false);
    setInput("");
    setShowCoffeeInput(false);
    setStep((s) => s + 1);
  };
  const handleEmotion = (emo: string) => {
    setSelectedEmo(emo);
    setTimeout(() => setStep((s) => s + 1), 400);
  };
  const toggleNote = (note: string) => {
    setSelectedNotes((prev) => prev.includes(note) ? prev.filter((n) => n !== note) : [...prev, note]);
  };
  const handleNoteNext = () => {
    setStep((s) => s + 1);
  };
  // 위치 자동 감지
  const handleLocation = () => {
    setLocStatus("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let address: string | undefined = undefined;
        try {
          address = await fetchKakaoAddress(latitude, longitude) ?? undefined;
        } catch {}
        setLocation({ lat: latitude, lng: longitude, address, provider: "kakao" });
        setLocStatus("success");
        setTimeout(() => setStep((s) => s + 1), 700);
      },
      () => {
        setLocStatus("fail");
        setLocation(null);
        setTimeout(() => setStep((s) => s + 1), 700);
      }
    );
  };
  const handleLocationSkip = () => {
    setLocation(null);
    setStep((s) => s + 1);
  };
  // 별점
  const handleRating = (n: number) => {
    setRating(n);
    setStep((s) => s + 1);
  };
  // 재구매
  const handleRepurchase = (v: boolean) => {
    setRepurchase(v);
    setStep((s) => s + 1);
  };
  // 사진
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageUrl(URL.createObjectURL(file));
      setAnalyzing(true);
      setAnalyzeError("");
      try {
        const formData = new FormData();
        formData.append("image", file);
        const res = await fetch("/api/bean-analyze", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.beanName) {
          setCoffee(data.beanName);
          setCoffeeRecommended(true);
          setStep((s) => s + 1); // 자동 다음 단계로 이동
        } else {
          setAnalyzeError("원두를 인식하지 못했습니다. 직접 입력해 주세요.");
        }
      } catch {
        setAnalyzeError("이미지 분석 중 오류가 발생했습니다.");
      } finally {
        setAnalyzing(false);
      }
    }
  };
  const handlePhotoNext = () => {
    setStep((s) => s + 1);
  };
  // 메모 + Firestore 저장
  const handleMemoNext = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const now = new Date();
      const timeOfDay = getTimeOfDay(now);
      await addDoc(collection(db, "records"), {
        coffee,
        coffeeRecommended,
        cafe,
        cafeByLocation,
        emotion: selectedEmo,
        notes: selectedNotes,
        location: location,
        rating,
        repurchase,
        imageUrl,
        memo,
        createdAt: now.toISOString(),
        timeOfDay,
        userId,
      });
      setSaveMsg("기록이 Firestore에 저장되었습니다!");
    } catch {
      setSaveMsg("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // 컵노트 그룹(간단 예시)
  const FLAVOR_GROUPS = [
    { name: "Fruity", emoji: "🥭", tags: ["Citrus", "Berry", "Apple"] },
    { name: "Floral", emoji: "🌸", tags: ["Rose", "Chamomile"] },
    { name: "Nutty/Cocoa", emoji: "🥜", tags: ["Hazelnut", "Chocolate"] },
    { name: "Sweet", emoji: "🍯", tags: ["Honey", "Vanilla"] },
    { name: "Roasted", emoji: "🔥", tags: ["Smoky", "Dark Roast"] },
    { name: "Earthy", emoji: "🌱", tags: ["Woody", "Earthy"] },
  ];

  return (
    <div className="relative flex flex-col items-center min-h-screen pt-20 pb-32 px-2 bg-gradient-to-br from-amber-50 to-rose-100 overflow-hidden">
      {/* 배경 패턴 오버레이 */}
      <div className="pointer-events-none absolute inset-0 z-0 before:content-[''] before:absolute before:inset-0 before:bg-[url('/pattern.svg')] before:opacity-10" />
      <div className="relative w-full max-w-md mx-auto flex flex-col gap-2 z-10">
        {messages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role} content={msg.content} />
        ))}
        {/* 입력 UI */}
        {step < QUESTIONS.length && (
          <div className="mt-4">
            {QUESTIONS[step].type === "text" && step === 0 && (
              <div className="flex flex-col gap-2">
                {recentCoffees.length > 0 && (
                  <fieldset className="mb-2">
                    <legend className="text-xs text-brown-700 mb-1">최근 마신 커피</legend>
                    <div className="flex flex-wrap gap-2">
                      {recentCoffees.map((c) => (
                        <motion.button
                          whileTap={{ scale: 1.12, boxShadow: "0 0 0 4px #f5e0dc" }}
                          whileHover={{ scale: 1.07, backgroundColor: "#f5e0dc" }}
                          transition={{ type: "spring", stiffness: 300, damping: 18 }}
                          key={c}
                          onClick={() => {
                            setCoffee(c);
                            setCoffeeRecommended(true);
                            setStep((s) => s + 1);
                          }}
                          className="px-3 py-1 rounded-full border text-sm font-serif bg-latte text-espresso border-latte shadow hover:bg-caramel focus:ring-2 focus:ring-mocha focus:outline-none transition-all duration-150"
                        >
                          {c}
                        </motion.button>
                      ))}
                    </div>
                  </fieldset>
                )}
                {COFFEE_GROUPS.map(group => (
                  <fieldset key={group.name} className="mb-2">
                    <legend className="text-xs text-brown-700 mb-1">{group.name}</legend>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map(item => (
                        <motion.button
                          whileTap={{ scale: 1.12, boxShadow: "0 0 0 4px #f5e0dc" }}
                          whileHover={{ scale: 1.07, backgroundColor: "#f5e0dc" }}
                          transition={{ type: "spring", stiffness: 300, damping: 18 }}
                          key={item}
                          onClick={() => {
                            setCoffee(item);
                            setCoffeeRecommended(true);
                            setStep((s) => s + 1);
                          }}
                          className="px-3 py-1 rounded-full border text-sm font-serif bg-latte text-espresso border-latte shadow hover:bg-caramel focus:ring-2 focus:ring-mocha focus:outline-none transition-all duration-150"
                        >
                          {item}
                        </motion.button>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <motion.button
                  whileTap={{ scale: 1.12, boxShadow: "0 0 0 4px #f5e0dc" }}
                  whileHover={{ scale: 1.07, backgroundColor: "#f5e0dc" }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  onClick={() => setShowCoffeeInput(true)}
                  className="px-3 py-1 rounded-full border text-sm font-serif bg-white border-mocha text-mocha shadow hover:bg-caramel focus:ring-2 focus:ring-mocha focus:outline-none transition-all duration-150"
                >
                  + 직접 입력
                </motion.button>
                {showCoffeeInput && (
                  <form onSubmit={handleTextSubmit} className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      className="flex-1 border border-mocha rounded-full px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-mocha font-serif"
                      placeholder="커피명을 입력하세요"
                      autoFocus
                    />
                    <button type="submit" className="bg-mocha text-white px-5 py-2 rounded-full font-bold shadow hover:bg-espresso transition">입력</button>
                  </form>
                )}
              </div>
            )}
            {QUESTIONS[step].type === "text" && step === 1 && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2 mb-2">
                  {cafeOptions.map((c) => (
                    <motion.button
                      whileTap={{ scale: 1.12, boxShadow: "0 0 0 4px #f5e0dc" }}
                      whileHover={{ scale: 1.07, backgroundColor: "#f5e0dc" }}
                      transition={{ type: "spring", stiffness: 300, damping: 18 }}
                      key={c}
                      onClick={() => {
                        setCafe(c);
                        setCafeByLocation(true);
                        setStep((s) => s + 1);
                      }}
                      className="px-3 py-1 rounded-full border text-sm font-serif bg-latte text-espresso border-latte shadow hover:bg-caramel focus:ring-2 focus:ring-mocha focus:outline-none transition-all duration-150"
                    >
                      {c}
                    </motion.button>
                  ))}
                  <motion.button
                    whileTap={{ scale: 1.12, boxShadow: "0 0 0 4px #f5e0dc" }}
                    whileHover={{ scale: 1.07, backgroundColor: "#f5e0dc" }}
                    transition={{ type: "spring", stiffness: 300, damping: 18 }}
                    onClick={() => setShowCafeInput(true)}
                    className="px-3 py-1 rounded-full border text-sm font-serif bg-white border-mocha text-mocha shadow hover:bg-caramel focus:ring-2 focus:ring-mocha focus:outline-none transition-all duration-150"
                  >
                    + 직접 입력
                  </motion.button>
                </div>
                {showCafeInput && (
                  <form onSubmit={e => {
                    e.preventDefault();
                    if (!input.trim()) return;
                    setCafe(input.trim());
                    setCafeByLocation(false);
                    setInput("");
                    setShowCafeInput(false);
                    setStep((s) => s + 1);
                  }} className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      className="flex-1 border border-mocha rounded-full px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-mocha font-serif"
                      placeholder="카페명을 입력하세요"
                      autoFocus
                    />
                    <button type="submit" className="bg-mocha text-white px-5 py-2 rounded-full font-bold shadow hover:bg-espresso transition">입력</button>
                  </form>
                )}
              </div>
            )}
            {QUESTIONS[step].type === "emotion" && (
              <div className="flex gap-2 justify-center">
                {["😊", "😐", "😢", "😍", "😡"].map((emo) => (
                  <button
                    key={emo}
                    onClick={() => handleEmotion(emo)}
                    className={`text-3xl px-3 py-2 rounded-full shadow transition hover:scale-110 ${selectedEmo === emo ? "bg-caramel" : "bg-white"}`}
                  >
                    {emo}
                  </button>
                ))}
              </div>
            )}
            {QUESTIONS[step].type === "note" && (
              <div>
                {FLAVOR_GROUPS.map((group) => (
                  <fieldset key={group.name} className="mb-2">
                    <legend className="text-sm text-brown-700 mb-1">{group.emoji} {group.name}</legend>
                    <div className="flex flex-wrap gap-2">
                      {group.tags.map((tag) => (
                        <motion.button
                          whileTap={{ scale: 1.12, boxShadow: "0 0 0 4px #f5e0dc" }}
                          whileHover={{ scale: 1.07, backgroundColor: "#f5e0dc" }}
                          transition={{ type: "spring", stiffness: 300, damping: 18 }}
                          key={tag}
                          type="button"
                          onClick={() => toggleNote(tag)}
                          className={`px-3 py-1 rounded-full border text-sm font-serif transition focus:ring-2 focus:ring-mocha focus:outline-none shadow
                            ${selectedNotes.includes(tag)
                              ? "bg-mocha text-white border-mocha"
                              : "bg-caramel text-espresso border-mocha hover:bg-mocha hover:text-white"}
                          `}
                        >
                          {tag}
                        </motion.button>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <motion.button
                  whileTap={{ scale: 1.12, boxShadow: "0 0 0 4px #f5e0dc" }}
                  whileHover={{ scale: 1.07, backgroundColor: "#f5e0dc" }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  onClick={handleNoteNext}
                  className="mt-3 px-5 py-2 rounded-full font-bold border bg-caramel text-espresso border-mocha shadow hover:bg-mocha hover:text-white focus:ring-2 focus:ring-mocha focus:outline-none transition-all duration-150"
                  disabled={selectedNotes.length === 0}
                >
                  다음
                </motion.button>
              </div>
            )}
            {QUESTIONS[step].type === "location" && (
              <div className="flex flex-col items-center gap-3">
                <motion.button
                  whileTap={{ scale: 1.12, boxShadow: "0 0 0 4px #f5e0dc" }}
                  whileHover={{ scale: 1.07, backgroundColor: "#f5e0dc" }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  onClick={handleLocation}
                  className="px-5 py-2 rounded-full font-bold border bg-caramel text-black border-mocha shadow hover:bg-mocha hover:text-white focus:ring-2 focus:ring-mocha focus:outline-none transition-all duration-150"
                  disabled={locStatus === "loading"}
                >
                  위치 자동 기록 (허용)
                </motion.button>
                <button
                  onClick={handleLocationSkip}
                  className="text-brown-700 underline text-sm"
                  disabled={locStatus === "loading"}
                >
                  위치 기록 안함
                </button>
                {locStatus === "loading" && <div className="text-caramel text-sm">위치 감지 중...</div>}
                {locStatus === "fail" && <div className="text-red-500 text-sm">위치 감지 실패 또는 권한 거부</div>}
                {locStatus === "success" && location && <div className="text-green-700 text-sm">위치 기록 완료: {location.address || location.label}</div>}
              </div>
            )}
            {QUESTIONS[step].type === "rating" && (
              <div className="flex gap-2 justify-center">
                {[1,2,3,4,5].map((n) => (
                  <motion.button
                    key={n}
                    whileTap={{ scale: 1.18 }}
                    whileHover={{ scale: 1.12, color: "#eab308" }}
                    transition={{ type: "spring", stiffness: 300, damping: 18 }}
                    onClick={() => handleRating(n)}
                    className={`text-2xl transition-colors duration-150 ${rating === n ? "text-caramel" : "text-gray-400"}`}
                    style={{ background: "none", border: "none", outline: "none", cursor: "pointer" }}
                  >
                    ★
                  </motion.button>
                ))}
              </div>
            )}
            {QUESTIONS[step].type === "repurchase" && (
              <div className="flex gap-4 justify-center">
                <motion.button
                  whileTap={{ scale: 1.12, boxShadow: "0 0 0 4px #f5e0dc" }}
                  whileHover={{ scale: 1.07, backgroundColor: "#f5e0dc" }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  onClick={() => handleRepurchase(true)}
                  className={`px-4 py-2 rounded-full border font-bold transition-all duration-150 focus:ring-2 focus:ring-mocha focus:outline-none shadow
                    ${repurchase === true ? "bg-mocha text-white border-mocha" : "bg-caramel text-black border-mocha hover:bg-mocha hover:text-white"}`}
                >
                  예
                </motion.button>
                <motion.button
                  whileTap={{ scale: 1.12, boxShadow: "0 0 0 4px #f5e0dc" }}
                  whileHover={{ scale: 1.07, backgroundColor: "#f5e0dc" }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  onClick={() => handleRepurchase(false)}
                  className={`px-4 py-2 rounded-full border font-bold transition-all duration-150 focus:ring-2 focus:ring-mocha focus:outline-none shadow
                    ${repurchase === false ? "bg-mocha text-white border-mocha" : "bg-caramel text-black border-mocha hover:bg-mocha hover:text-white"}`}
                >
                  아니오
                </motion.button>
              </div>
            )}
            {QUESTIONS[step].type === "photo" && (
              <div className="flex flex-col gap-2 items-center">
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="mb-2" />
                {imageUrl && <Image src={imageUrl} alt="업로드 이미지" width={120} height={120} className="rounded-xl object-cover" />}
                {analyzing && <div className="text-mocha text-xs">이미지 분석 중...</div>}
                {analyzeError && <div className="text-red-500 text-xs">{analyzeError}</div>}
                <button onClick={handlePhotoNext} className="mt-2 px-4 py-2 rounded-full bg-mocha text-white font-bold shadow hover:bg-espresso transition text-sm">다음</button>
              </div>
            )}
            {QUESTIONS[step].type === "memo" && (
              <div className="flex flex-col gap-2">
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={3}
                  className="w-full border border-mocha rounded-xl px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-mocha font-serif"
                  placeholder="느낀 점, 분위기 등 자유롭게 기록해보세요."
                />
                <button
                  onClick={handleMemoNext}
                  className="bg-mocha text-white px-5 py-2 rounded-full font-bold shadow hover:bg-espresso transition"
                  disabled={!memo.trim() || saving}
                >
                  {saving ? "저장 중..." : "기록 완료"}
                </button>
                {saveMsg && <div className="text-caramel text-center mt-2">{saveMsg}</div>}
              </div>
            )}
          </div>
        )}
        {/* 완료 메시지 */}
        {step >= QUESTIONS.length && (
          <MessageBubble role="bot" content={"기록 완료 🎉 오늘의 기억은 저장되었어요 ☁️"} />
        )}
      </div>
    </div>
  );
} 