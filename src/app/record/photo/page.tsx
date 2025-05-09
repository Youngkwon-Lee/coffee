"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type ChatMessage = {
  type: "bot" | "user";
  text: string;
  imageUrl?: string;
};

// OCR 결과를 보기 좋게 가공하는 함수
function formatOcrResult(data: any) {
  if (!data) return "분석 결과가 없습니다.";
  if (data.beanName) return `☕️ 추출된 텍스트\n${data.beanName}`;
  return "분석 결과가 없습니다.";
}

// OCR 결과 타입 명시
interface OcrResult {
  bean?: string;
  cafe?: string;
  flavor?: string[];
  mood?: string;
  rating?: number;
  review?: string;
  raw_text?: string;
}

// window에 SpeechRecognition 타입 선언 (타입스크립트용)
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function RecordPhotoPage() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([
    { type: "bot", text: "안녕하세요! 커피 사진을 업로드하거나 촬영해 주세요." }
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 설문 폼 상태 타입 명시
  const [form, setForm] = useState<{
    bean: string;
    cafe: string;
    flavor: string[];
    mood: string;
    rating: number;
    review: string;
  }>({
    bean: "",
    cafe: "",
    flavor: [],
    mood: "",
    rating: 0,
    review: ""
  });
  // STT 관련 상태
  const [sttActive, setSttActive] = useState({ flavor: false, mood: false });
  const [sttResult, setSttResult] = useState({ flavor: "", mood: "" });

  // OCR 결과 나오면 설문 폼 자동 채우기
  useEffect(() => {
    if (ocrResult && (ocrResult.bean || ocrResult.cafe || ocrResult.flavor)) {
      setForm(f => ({
        ...f,
        bean: ocrResult.bean || "",
        cafe: ocrResult.cafe || "",
        flavor: Array.isArray(ocrResult.flavor) ? ocrResult.flavor : [],
      }));
    }
  }, [ocrResult]);

  // OCR 결과를 보기 좋게 가공하는 함수
  function formatOcrResult(data: any) {
    if (!data) return "분석 결과가 없습니다.";
    if (data.beanName) return `☕️ 추출된 텍스트\n${data.beanName}`;
    return "분석 결과가 없습니다.";
  }

  // 설문 폼 관련 함수들 (위쪽에 위치)
  const handleFormChange = (field: keyof typeof form, value: string | number | string[]) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  // 파일 선택/촬영 시 미리보기
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, method: "촬영" | "업로드") => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setOcrResult(null);
      setChat(prev => [
        ...prev,
        { type: "user", text: method === "촬영" ? "촬영하기로 사진을 보냈어요!" : "사진을 업로드했어요!" },
        { type: "bot", text: "사진이 업로드되었습니다. OCR 분석을 시작해볼까요?", imageUrl: URL.createObjectURL(file) }
      ]);
    }
  };

  // OCR 분석 요청
  const handleAnalyze = async () => {
    if (!image) return;
    setLoading(true);
    setChat(prev => [...prev, { type: "user", text: "OCR 분석하기 눌렀어요!" }]);
    const formData = new FormData();
    formData.append("image", image); // bean-analyze API는 'image' 필드 사용

    try {
      const res = await fetch("/api/bean-analyze", {
        method: "POST",
        body: formData,
      });
      let data: any = null;
      try {
        data = await res.json();
      } catch (jsonErr) {
        setLoading(false);
        setChat(prev => [
          ...prev,
          { type: "bot", text: "서버에서 올바른 응답을 받지 못했습니다. (JSON 파싱 오류)" }
        ]);
        return;
      }
      setOcrResult(data);
      setLoading(false);
      // OCR 결과(raw_text)와 매칭 결과를 모두 챗봇에 표시
      let resultMsg = `분석 결과가 나왔어요!`;
      if (data.bean || data.cafe) {
        resultMsg += `\n원두명: ${data.bean ?? "-"}\n카페/브랜드: ${data.cafe ?? "-"}`;
        setChat(prev => [
          ...prev,
          { type: "bot", text: resultMsg },
          { type: "bot", text: "입력되었습니다! 아래에서 설문을 이어서 작성해 주세요." }
        ]);
        return;
      } else {
        resultMsg += `\n원두명/카페명을 찾지 못했어요.`;
      }
      resultMsg += `\n\n[추출된 텍스트]\n${data.raw_text ? data.raw_text.trim() : "(없음)"}`;
      setChat(prev => [
        ...prev,
        { type: "bot", text: resultMsg }
      ]);
      // 매칭 실패 시 직접 입력 안내
      if (!data.bean && !data.cafe) {
        setChat(prev => [
          ...prev,
          { type: "bot", text: "원두명과 카페명을 직접 입력해 주세요!" }
        ]);
      }
    } catch (err) {
      setLoading(false);
      setChat(prev => [
        ...prev,
        { type: "bot", text: "서버 요청에 실패했습니다. 네트워크 또는 서버 상태를 확인해 주세요." }
      ]);
    }
  };

  // STT(음성 입력) 시작 함수 (Web Speech API)
  const startSTT = (field: "flavor" | "mood") => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      alert("이 브라우저는 음성 인식을 지원하지 않습니다.");
      return;
    }
    setSttActive(a => ({ ...a, [field]: true }));
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setSttResult(r => ({ ...r, [field]: text }));
      setForm(f => ({ ...f, [field]: text }));
      setSttActive(a => ({ ...a, [field]: false }));
    };
    recognition.onerror = () => setSttActive(a => ({ ...a, [field]: false }));
    recognition.start();
  };

  // 향미 카테고리(기존 manual 스타일)
  const FLAVOR_CATEGORIES = [
    { category: "Fruity", options: ["Citrus", "Berry-like", "Winey", "Floral", "Fruity"] },
    { category: "Nutty & Sweet", options: ["Nutty", "Malty", "Candy-like", "Syrup-like", "Chocolate-like", "Vanilla-like", "Caramel"] },
    { category: "Herby & Spicy", options: ["Herby", "Spicy", "Resinous", "Medicinal"] },
    { category: "Acidity & Sour", options: ["Sour", "Acidic", "Tart"] },
    { category: "Bitter & Others", options: ["Bitter", "Mellow", "Sweet", "Earthy", "Smoky", "Astringent"] },
  ];
  const MOOD_OPTIONS = [
    { emoji: "😌", label: "가라앉아요" },
    { emoji: "😃", label: "활기차요" },
    { emoji: "🥰", label: "설레요" },
    { emoji: "😐", label: "평온해요" },
    { emoji: "😴", label: "졸려요" },
  ];
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const handleCategoryToggle = (category: string) => {
    setOpenCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };
  const handleFlavorClick = (flavor: string) => {
    setForm(f => ({
      ...f,
      flavor: f.flavor.includes(flavor)
        ? f.flavor.filter((v: string) => v !== flavor)
        : [...f.flavor, flavor]
    }));
  };
  // 별점
  const handleRating = (n: number) => setForm(f => ({ ...f, rating: n }));

  // 설문 폼 렌더링 (manual 스타일)
  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">☕️ 커피 사진 기록 챗봇</h1>
      <div className="flex flex-col gap-2 mb-4">
        {chat.map((msg, idx) => (
          <div
            key={idx}
            className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm whitespace-pre-line
              ${msg.type === "bot" ? "bg-gray-100 self-start" : "bg-yellow-200 self-end"}
            `}
          >
            {msg.text}
            {msg.imageUrl && (
              <img src={msg.imageUrl} alt="업로드 미리보기" className="mt-2 w-40 rounded-lg shadow" />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-4">
        {/* 촬영하기 */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={cameraInputRef}
          onChange={e => handleFileChange(e, "촬영")}
          className="hidden"
        />
        <button
          className="px-3 py-2 bg-yellow-400 rounded-lg font-bold"
          onClick={() => {
            setChat(prev => [
              ...prev,
              { type: "bot", text: "촬영을 위해 카메라 권한이 필요할 수 있습니다. 허용을 눌러주세요!" }
            ]);
            cameraInputRef.current?.click();
          }}
        >
          📷 촬영하기
        </button>
        {/* 사진 업로드 */}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={e => handleFileChange(e, "업로드")}
          className="hidden"
        />
        <button
          className="px-3 py-2 bg-rose-300 rounded-lg font-bold"
          onClick={() => fileInputRef.current?.click()}
        >
          🖼️ 사진 업로드
        </button>
      </div>
      {preview && !ocrResult && (
        <button
          className="px-4 py-2 bg-rose-400 text-white rounded-lg font-bold mb-4 w-full"
          onClick={handleAnalyze}
          disabled={loading}
        >
          {loading ? "분석 중..." : "OCR 분석하기"}
        </button>
      )}
      {ocrResult && (
        <form className="mt-6 p-4 bg-white rounded-2xl shadow flex flex-col gap-6 border border-yellow-200">
          <div>
            <label className="font-bold text-yellow-700">원두명</label>
            <input className="w-full border border-yellow-200 rounded-lg px-3 py-2 mt-1 bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-300" value={form.bean} onChange={e => handleFormChange("bean", e.target.value)} />
          </div>
          <div>
            <label className="font-bold text-yellow-700">카페/브랜드</label>
            <input className="w-full border border-yellow-200 rounded-lg px-3 py-2 mt-1 bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-300" value={form.cafe} onChange={e => handleFormChange("cafe", e.target.value)} />
          </div>
          <div>
            <label className="font-bold text-yellow-700">향미(여러 개 선택 가능)</label>
            <div className="flex flex-col gap-2 mt-2">
              {FLAVOR_CATEGORIES.map(cat => (
                <div key={cat.category}>
                  <button type="button" className="w-full text-left px-3 py-2 bg-yellow-100 rounded font-bold mb-1" onClick={() => handleCategoryToggle(cat.category)}>{cat.category}</button>
                  {openCategories.includes(cat.category) && (
                    <div className="flex flex-wrap gap-2 mt-2 ml-4">
                      {cat.options.map(flavor => (
                        <button
                          key={flavor}
                          type="button"
                          className={`px-3 py-1 rounded-full border transition-all duration-150 ${form.flavor.includes(flavor) ? "bg-yellow-400 text-white font-bold border-yellow-400" : "bg-white text-gray-700 border-gray-300"}`}
                          onClick={() => handleFlavorClick(flavor)}
                        >
                          {flavor}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button type="button" className="ml-2 px-2 py-1 text-xs bg-blue-200 rounded" onClick={() => startSTT("flavor")} disabled={sttActive.flavor}>🎤 음성입력</button>
              {sttResult.flavor && <span className="ml-2 text-xs text-gray-500">{sttResult.flavor}</span>}
            </div>
          </div>
          <div>
            <label className="font-bold text-yellow-700">오늘 기분</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {MOOD_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  className={`px-3 py-2 rounded-full border text-2xl ${form.mood === opt.emoji + ' ' + opt.label ? "bg-yellow-400 text-white font-bold border-yellow-400" : "bg-white text-gray-700 border-gray-300"}`}
                  onClick={() => handleFormChange("mood", opt.emoji + ' ' + opt.label)}
                >
                  {opt.emoji} <span className="text-base ml-1">{opt.label}</span>
                </button>
              ))}
              <button type="button" className="ml-2 px-2 py-1 text-xs bg-blue-200 rounded" onClick={() => startSTT("mood")} disabled={sttActive.mood}>🎤 음성입력</button>
              {sttResult.mood && <span className="ml-2 text-xs text-gray-500">{sttResult.mood}</span>}
            </div>
            <input className="w-full border border-yellow-200 rounded-lg px-3 py-2 mt-2 bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-300" value={form.mood} onChange={e => handleFormChange("mood", e.target.value)} placeholder="예: 😴 졸려요" />
          </div>
          <div>
            <label className="font-bold text-yellow-700">평점</label>
            <div className="flex gap-2 items-center mt-2">
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`text-2xl px-2 ${form.rating === n ? "text-yellow-400" : "text-gray-300"}`}
                  onClick={() => handleRating(n)}
                  aria-label={`${n}점`}
                >
                  {form.rating && form.rating >= n ? "★" : "☆"}
                </button>
              ))}
              <span className="ml-2">{form.rating}점</span>
            </div>
          </div>
          <div>
            <label className="font-bold text-yellow-700">한줄평</label>
            <input className="w-full border border-yellow-200 rounded-lg px-3 py-2 mt-1 bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-300" value={form.review} onChange={e => handleFormChange("review", e.target.value)} />
          </div>
          <button type="submit" className="mt-2 px-4 py-2 bg-yellow-400 text-white rounded-lg font-bold shadow hover:bg-yellow-500 transition">저장</button>
        </form>
      )}
    </div>
  );
} 