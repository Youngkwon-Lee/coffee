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
  processing?: string;
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
  const [submitting, setSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [activeStep, setActiveStep] = useState(1); // 1: 업로드, 2: 분석, 3: 폼 작성
  const [chat, setChat] = useState<ChatMessage[]>([
    { type: "bot", text: "안녕하세요! 커피 사진을 업로드하거나 촬영해 주세요." }
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // 설문 폼 상태 타입 명시 (수정됨: processing, otherFlavors 추가)
  const [form, setForm] = useState<{
    cafe: string;
    bean: string;
    processing: string;
    flavor: string[];
    otherFlavors: string;
    rating: number;
    mood: string;
    review: string;
  }>({
    cafe: "",
    bean: "",
    processing: "",
    flavor: [],
    otherFlavors: "",
    rating: 0,
    mood: "",
    review: ""
  });
  
  // STT 관련 상태
  const [sttActive, setSttActive] = useState({ flavor: false, mood: false, review: false });
  const [sttResult, setSttResult] = useState({ flavor: "", mood: "", review: "" });

  // OCR 결과 나오면 설문 폼 자동 채우기
  useEffect(() => {
    if (ocrResult) {
      const standardFlavors = getAllFlavorOptions();
      const ocrFlavors = ocrResult.flavor || [];
      
      // 표준 향미 리스트에 있는 항목과 없는 항목 분리
      const standardFlavorMatches: string[] = [];
      const otherFlavorMatches: string[] = [];
      
      ocrFlavors.forEach(flavor => {
        // 정확히 일치하는 항목이 있는지 확인
        if (standardFlavors.includes(flavor)) {
          standardFlavorMatches.push(flavor);
        } else {
          // 부분 일치하는 항목 찾기
          const similarFlavor = standardFlavors.find(std => 
            std.toLowerCase().includes(flavor.toLowerCase()) || 
            flavor.toLowerCase().includes(std.toLowerCase())
          );
          
          if (similarFlavor) {
            standardFlavorMatches.push(similarFlavor);
          } else {
            otherFlavorMatches.push(flavor);
          }
        }
      });
      
      // 원두 텍스트에서 추가 향미 확인 (예: 오렌지, 넥타린, 그린 티 등)
      const rawText = ocrResult.raw_text || "";
      
      // 추가 향미 키워드
      const extraFlavorKeywords = [
        "Orange", "Nectarine", "Green Tea", "Sweet", "오렌지", "넥타린", "그린 티", "달콤함"
      ];
      
      // 원두 텍스트에서 직접 추가 향미 추출
      extraFlavorKeywords.forEach(keyword => {
        if (rawText.includes(keyword) && 
            !standardFlavorMatches.includes(keyword) && 
            !otherFlavorMatches.includes(keyword)) {
          otherFlavorMatches.push(keyword);
        }
      });
      
      // Natural과 Dry 매핑
      let processing = ocrResult.processing || "";
      if (processing === "Dry") {
        processing = "Natural";
      }

      // 원두명에 대한 특별 처리 (Ethiopia Benti Korbo 등의 특정 원두명 확인)
      const rawTextLower = rawText.toLowerCase();
      let beanName = ocrResult.bean || "";
      
      // 원두명 확인 로직 (특정 패턴 확인)
      // Ethiopia Benti Korbo와 같은 패턴 확인
      const specialBeanPatterns = [
        /ethiopia\s+benti\s+korbo/i,
        /에티오피아\s+벤티\s+코르보/i
      ];
      
      for (const pattern of specialBeanPatterns) {
        const match = rawTextLower.match(pattern);
        if (match) {
          beanName = match[0].charAt(0).toUpperCase() + match[0].slice(1); // 첫 글자 대문자로
          break;
        }
      }
      
      // OCR에서 특정 값을 추출하지 못했을 때 비워두기
      if (ocrResult.cafe === "Fritz Coffee Company" && !rawTextLower.includes("fritz")) {
        // 실제로 Fritz 텍스트가 발견되지 않았으면 비워둠
        setForm(f => ({
          ...f,
          cafe: "", // 빈 값으로 설정
          bean: beanName || "", // 수정된 원두명 또는 원래 원두명 사용
          processing: processing,
          flavor: standardFlavorMatches,
          otherFlavors: otherFlavorMatches.join(', ')
        }));
      } else {
        setForm(f => ({
          ...f,
          cafe: ocrResult.cafe || "",
          bean: beanName || "",
          processing: processing,
          flavor: standardFlavorMatches,
          otherFlavors: otherFlavorMatches.join(', ')
        }));
      }
    }
  }, [ocrResult]);

  // 모든 향미 옵션을 배열로 반환하는 헬퍼 함수
  const getAllFlavorOptions = () => {
    return FLAVOR_CATEGORIES.flatMap(cat => cat.options);
  };

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
      setActiveStep(2); // 분석 단계로 이동
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
      
      if (!res.ok) {
        throw new Error(`OCR 분석 중 오류가 발생했습니다. 상태 코드: ${res.status}`);
      }
      
      const data = await res.json();
      
      // 원시 텍스트 확인
      const rawTextLower = (data.raw_text || "").toLowerCase();
      
      // 다양한 원두명 패턴 확인 - 주요 원두명 목록
      const specificBeans = [
        "Ethiopia Benti Korbo", "Ethiopia Chelbesa", "Ethiopia Aricha", 
        "Ethiopia Uraga", "Ethiopia Shakiso", "Ethiopia Yirgacheffe", 
        "Ethiopia Hambela", "Ethiopia Adado",
        "Colombia El Paraiso", "Colombia La Palma y El Tucan", 
        "Colombia Las Flores", "Colombia La Esperanza", 
        "Colombia La Cristalina",
        "Panama Elida Estate", "Panama Esmeralda Jaramillo", 
        "Panama Hartmann Estate",
        "Kenya Karimikui", "Kenya Gakuyuini", "Kenya Kiamabara",
        "Guatemala El Injerto", "Guatemala La Esperanza",
        "Honduras Santa Barbara", "Costa Rica Las Lajas", 
        "Costa Rica Don Mayo", "El Salvador Los Pirineos",
        "Rwanda Bumbogo", "Rwanda Gitesi", "Burundi Ninga",
        "Indonesia Wahana Estate", "Yemen Haraaz"
      ];
      
      // OCR 텍스트에서 특정 원두명 검색
      for (const beanName of specificBeans) {
        // 원두명 키워드 분리 (예: Ethiopia + Benti + Korbo)
        const keywords = beanName.toLowerCase().split(/\s+/);
        const allKeywordsPresent = keywords.every(keyword => 
          rawTextLower.includes(keyword)
        );
        
        // 모든 키워드가 있으면 해당 원두명으로 설정
        if (allKeywordsPresent) {
          data.bean = beanName;
          break;
        }
      }
      
      // 카페명 신뢰도 확인
      if (data.cafe === "Fritz Coffee Company" && !rawTextLower.includes("fritz")) {
        data.cafe = ""; // 카페명 정보 제거
      }
      
      setOcrResult(data);
      setActiveStep(3); // 폼 작성 단계로 이동
      
      // OCR 결과(raw_text)와 매칭 결과를 모두 챗봇에 표시
      let resultMsg = `분석 결과가 나왔어요!`;
      if (data.bean || data.cafe || data.processing) {
        resultMsg += data.cafe ? `\n카페명: ${data.cafe}` : `\n카페명: (인식 실패)`;
        resultMsg += data.bean ? `\n원두명: ${data.bean}` : `\n원두명: (인식 실패)`;
        if (data.processing) {
          resultMsg += `\n프로세싱: ${data.processing}`;
        }
        if (data.flavor && data.flavor.length > 0) {
          resultMsg += `\n향미: ${data.flavor.join(', ')}`;
        }
        
        // 원두명이 인식되었으나 확실하지 않은 경우 안내 추가
        if (data.bean && !specificBeans.includes(data.bean)) {
          resultMsg += `\n\n* 원두명이 정확하지 않을 수 있습니다. 필요시 수정해주세요.`;
        }
        
        setChat(prev => [
          ...prev,
          { type: "bot", text: resultMsg },
          { type: "bot", text: "입력되었습니다! 아래에서 설문을 이어서 작성해 주세요." }
        ]);
      } else {
        resultMsg += `\n원두명/카페명을 찾지 못했어요.`;
        resultMsg += `\n\n[추출된 텍스트]\n${data.raw_text ? data.raw_text.trim() : "(없음)"}`;
        setChat(prev => [
          ...prev,
          { type: "bot", text: resultMsg },
          { type: "bot", text: "원두명과 카페명을 직접 입력해 주세요!" }
        ]);
      }
    } catch (error) {
      console.error('OCR 분석 오류:', error);
      setChat(prev => [
        ...prev,
        { type: "bot", text: "OCR 분석 중 오류가 발생했습니다. 다시 시도하거나 직접 입력해주세요." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // STT(음성 입력) 시작 함수 (Web Speech API)
  const startSTT = (field: "flavor" | "mood" | "review") => {
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
      
      if (field === "review") {
        setForm(f => ({ ...f, [field]: text }));
      } else if (field === "flavor") {
        setForm(f => ({ ...f, otherFlavors: text }));
      } else {
        setForm(f => ({ ...f, [field]: text }));
      }
      
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
  
  // 프로세싱 옵션 목록
  const PROCESSING_OPTIONS = [
    "Washed", 
    "Natural", 
    "Honey", 
    "Anaerobic",
    "Carbonic Maceration",
    "Lactic",
    "Yeast",
    "Thermal",
    "Experimental",
    "Double Fermentation",
    "Co-Fermented",
    "Washed Anaerobic",
    "Natural Anaerobic",
    "Honey Anaerobic",
    "Pulped Natural",
    "Wet Hulled",
    "Decaf",
    "Monsooned"
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

  // 폼 제출 처리
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // 향미 목록에 기타 향미 추가 (콤마로 구분된 항목을 분리하여 추가)
      const otherFlavorsArray = form.otherFlavors
        .split(',')
        .map(f => f.trim())
        .filter(f => f.length > 0);
      
      const formData = {
        ...form,
        allFlavors: [...form.flavor, ...otherFlavorsArray]
      };
      
      // 여기에 실제 데이터 저장 로직 추가 (Firebase, API 호출 등)
      // 예시: await saveToDatabase(formData);
      
      // 테스트용 setTimeout (실제 저장 로직으로 대체 필요)
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 성공 메시지 추가
      setChat(prev => [
        ...prev,
        { type: "bot", text: "커피 기록이 성공적으로 저장되었습니다! 😊" }
      ]);
      
      setFormSubmitted(true);
      
      // 3초 후 홈페이지로 이동 (선택사항)
      setTimeout(() => {
        router.push('/'); // 또는 다른 페이지로 리디렉션
      }, 3000);
      
    } catch (error) {
      console.error('폼 제출 오류:', error);
      
      // 오류 메시지 추가
      setChat(prev => [
        ...prev,
        { type: "bot", text: "저장 중 오류가 발생했습니다. 다시 시도해주세요." }
      ]);
      
    } finally {
      setSubmitting(false);
    }
  };

  // 설문 폼 렌더링 (순서 변경 및 필드 추가)
  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      {/* 진행 단계 표시 */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className={`w-1/3 text-center ${activeStep >= 1 ? 'text-yellow-500 font-bold' : 'text-gray-400'}`}>
            <div className={`rounded-full h-8 w-8 flex items-center justify-center mx-auto mb-1 ${activeStep >= 1 ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
            <p className="text-xs">사진 업로드</p>
          </div>
          <div className={`w-1/3 text-center ${activeStep >= 2 ? 'text-yellow-500 font-bold' : 'text-gray-400'}`}>
            <div className={`rounded-full h-8 w-8 flex items-center justify-center mx-auto mb-1 ${activeStep >= 2 ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
            <p className="text-xs">OCR 분석</p>
          </div>
          <div className={`w-1/3 text-center ${activeStep >= 3 ? 'text-yellow-500 font-bold' : 'text-gray-400'}`}>
            <div className={`rounded-full h-8 w-8 flex items-center justify-center mx-auto mb-1 ${activeStep >= 3 ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
            <p className="text-xs">정보 저장</p>
          </div>
        </div>
        <div className="h-1 w-full bg-gray-200 rounded mt-2">
          <div className={`h-full bg-yellow-500 rounded transition-all duration-300 ${activeStep === 1 ? 'w-1/6' : activeStep === 2 ? 'w-1/2' : 'w-full'}`}></div>
        </div>
      </div>

      <h1 className="text-xl font-bold mb-4">☕️ 커피 사진 기록 챗봇</h1>
      <div className="flex flex-col gap-2 mb-4 max-h-60 overflow-y-auto p-2 bg-gray-50 rounded-lg">
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
      
      {/* 파일 선택 버튼들 */}
      {!formSubmitted && activeStep === 1 && (
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
            className="flex-1 px-3 py-3 bg-yellow-400 rounded-lg font-bold flex items-center justify-center"
            onClick={() => {
              setChat(prev => [
                ...prev,
                { type: "bot", text: "촬영을 위해 카메라 권한이 필요할 수 있습니다. 허용을 눌러주세요!" }
              ]);
              cameraInputRef.current?.click();
            }}
          >
            <span className="mr-2 text-xl">📷</span> 촬영하기
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
            className="flex-1 px-3 py-3 bg-rose-300 rounded-lg font-bold flex items-center justify-center"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="mr-2 text-xl">🖼️</span> 사진 업로드
          </button>
        </div>
      )}
      
      {/* 이미지 미리보기 (크게) */}
      {preview && !formSubmitted && (
        <div className="mb-4 text-center">
          <div className="relative inline-block">
            <img 
              src={preview} 
              alt="커피 사진" 
              className="max-h-64 rounded-lg shadow-md mx-auto" 
            />
            <button 
              onClick={() => {
                setPreview(null);
                setImage(null);
                setActiveStep(1);
              }}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
              aria-label="이미지 삭제"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      {/* OCR 분석 버튼 */}
      {preview && !ocrResult && !formSubmitted && activeStep === 2 && (
        <button
          className="px-4 py-3 bg-rose-400 text-white rounded-lg font-bold mb-4 w-full flex items-center justify-center"
          onClick={handleAnalyze}
          disabled={loading || !image}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              분석 중...
            </>
          ) : (
            <>OCR 분석하기</>
          )}
        </button>
      )}
      
      {/* OCR 결과 폼 */}
      {ocrResult && !formSubmitted && activeStep === 3 && (
        <form ref={formRef} onSubmit={handleFormSubmit} className="mt-6 p-4 bg-white rounded-2xl shadow flex flex-col gap-6 border border-yellow-200">
          {/* 상단 저장 버튼 (모바일에서 편리하게) */}
          <div className="sticky top-0 z-10 bg-white py-2 -mt-2 -mx-2 px-2 rounded-t-2xl border-b border-yellow-100">
            <button 
              type="submit" 
              disabled={submitting || !form.bean || !form.cafe} 
              className="w-full px-4 py-2 bg-yellow-400 text-white rounded-lg font-bold shadow hover:bg-yellow-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  저장 중...
                </>
              ) : (
                <>저장하기</>
              )}
            </button>
          </div>
          
          {/* 기본 정보 섹션 */}
          <div className="bg-yellow-50 p-3 rounded-lg">
            <h3 className="text-sm font-semibold text-yellow-800 mb-3">기본 정보</h3>
            
            {/* [1] 카페명 (카페/브랜드) */}
            <div className="mb-3">
              <label className="text-sm font-bold text-yellow-700 flex items-center">
                카페명 (카페/브랜드)
                <span className="ml-1 text-red-500">*</span>
              </label>
              <input 
                className="w-full border border-yellow-200 rounded-lg px-3 py-2 mt-1 bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-300" 
                value={form.cafe} 
                onChange={e => handleFormChange("cafe", e.target.value)} 
                required
              />
            </div>
            
            {/* [2] 원두명 */}
            <div>
              <label className="text-sm font-bold text-yellow-700 flex items-center">
                원두명
                <span className="ml-1 text-red-500">*</span>
              </label>
              <input 
                className="w-full border border-yellow-200 rounded-lg px-3 py-2 mt-1 bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-300" 
                value={form.bean} 
                onChange={e => handleFormChange("bean", e.target.value)} 
                required
              />
            </div>
          </div>
          
          {/* [3] 프로세싱 */}
          <div className="border-t border-yellow-100 pt-4">
            <label className="text-sm font-bold text-yellow-700">프로세싱</label>
            <div className="flex flex-wrap gap-2 mt-2 mb-2 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded-lg">
              {PROCESSING_OPTIONS.map(process => (
                <button
                  key={process}
                  type="button"
                  className={`px-3 py-1 rounded-full border transition-all duration-150 text-sm ${form.processing === process ? "bg-yellow-400 text-white font-bold border-yellow-400" : "bg-white text-gray-700 border-gray-300"}`}
                  onClick={() => handleFormChange("processing", process)}
                >
                  {process}
                </button>
              ))}
            </div>
            <input 
              className="w-full border border-yellow-200 rounded-lg px-3 py-2 mt-1 bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-300" 
              value={form.processing} 
              placeholder="직접 입력 (ex: Washed, Natural, ...)"
              onChange={e => handleFormChange("processing", e.target.value)} 
            />
          </div>
          
          {/* [4] 향미 (여러 개 선택 가능) */}
          <div className="border-t border-yellow-100 pt-4">
            <label className="text-sm font-bold text-yellow-700">향미(여러 개 선택 가능)</label>
            
            {/* 선택된 향미 표시 영역 */}
            {form.flavor.length > 0 && (
              <div className="mt-2 mb-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-xs font-medium text-yellow-800 mb-2">선택된 향미:</p>
                <div className="flex flex-wrap gap-2">
                  {form.flavor.map(flavor => (
                    <div 
                      key={flavor} 
                      className="px-3 py-1 bg-yellow-400 text-white rounded-full font-medium flex items-center text-sm"
                    >
                      {flavor}
                      <button 
                        type="button" 
                        className="ml-1 text-xs bg-yellow-500 hover:bg-yellow-600 rounded-full w-4 h-4 flex items-center justify-center"
                        onClick={() => handleFlavorClick(flavor)}
                      >×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex flex-col gap-2 mt-2">
              {FLAVOR_CATEGORIES.map(cat => (
                <div key={cat.category}>
                  <button type="button" className="w-full text-left px-3 py-2 bg-yellow-100 rounded font-bold mb-1 text-sm" onClick={() => handleCategoryToggle(cat.category)}>{cat.category}</button>
                  {openCategories.includes(cat.category) && (
                    <div className="flex flex-wrap gap-2 mt-2 ml-4">
                      {cat.options.map(flavor => (
                        <button
                          key={flavor}
                          type="button"
                          className={`px-3 py-1 rounded-full border transition-all duration-150 text-sm ${form.flavor.includes(flavor) ? "bg-yellow-400 text-white font-bold border-yellow-400" : "bg-white text-gray-700 border-gray-300"}`}
                          onClick={() => handleFlavorClick(flavor)}
                        >
                          {flavor}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {/* 기타 향미 직접 입력 */}
              <div className="mt-3">
                <label className="text-xs font-medium text-gray-700">기타 향미 직접 입력</label>
                <div className="relative">
                  <input 
                    className="w-full border border-yellow-200 rounded-lg px-3 py-2 mt-1 bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-300" 
                    value={form.otherFlavors} 
                    placeholder="OCR에서 추출된 향미 또는 직접 입력 (콤마로 구분)"
                    onChange={e => handleFormChange("otherFlavors", e.target.value)} 
                  />
                  <button 
                    type="button" 
                    className="absolute right-2 top-3 px-2 py-1 text-xs bg-blue-200 rounded"
                    onClick={() => startSTT("flavor")} 
                    disabled={sttActive.flavor}
                  >
                    {sttActive.flavor ? "인식 중..." : "🎤 음성입력"}
                  </button>
                </div>
                {sttResult.flavor && <span className="text-xs text-gray-500 mt-1">{sttResult.flavor}</span>}
              </div>
            </div>
          </div>
          
          {/* [5] 평점 (별점) */}
          <div className="border-t border-yellow-100 pt-4">
            <label className="text-sm font-bold text-yellow-700">평점</label>
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
          
          {/* [6] 한줄평 및 오늘의 기분 */}
          <div className="border-t border-yellow-100 pt-4">
            <label className="text-sm font-bold text-yellow-700">한줄평 및 오늘의 기분</label>
            
            {/* 기분 옵션 */}
            <div className="flex flex-wrap gap-2 mt-2 mb-2">
              {MOOD_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  className={`px-3 py-2 rounded-full border text-2xl ${form.mood === opt.emoji + ' ' + opt.label ? "bg-yellow-400 text-white font-bold border-yellow-400" : "bg-white text-gray-700 border-gray-300"}`}
                  onClick={() => handleFormChange("mood", opt.emoji + ' ' + opt.label)}
                >
                  {opt.emoji} <span className="text-sm ml-1">{opt.label}</span>
                </button>
              ))}
            </div>
            
            {/* 한줄평 */}
            <div className="relative">
              <input 
                className="w-full border border-yellow-200 rounded-lg px-3 py-2 mt-2 bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-300" 
                value={form.review} 
                onChange={e => handleFormChange("review", e.target.value)} 
                placeholder="한줄평을 입력해주세요" 
              />
              <button 
                type="button" 
                className="absolute right-2 top-3 px-2 py-1 text-xs bg-blue-200 rounded"
                onClick={() => startSTT("review")} 
                disabled={sttActive.review}
              >
                {sttActive.review ? "인식 중..." : "🎤 음성입력"}
              </button>
            </div>
            {sttResult.review && <span className="text-xs text-gray-500 mt-1">{sttResult.review}</span>}
          </div>
          
          {/* 하단 저장 버튼 */}
          <div className="flex gap-3 mt-4 sticky bottom-0">
            <button 
              type="submit" 
              disabled={submitting || !form.bean || !form.cafe} 
              className="mt-2 flex-1 px-4 py-3 bg-yellow-400 text-white rounded-lg font-bold shadow hover:bg-yellow-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "저장 중..." : "저장하기"}
            </button>
          </div>
        </form>
      )}
      
      {/* 저장 완료 화면 */}
      {formSubmitted && (
        <div className="mt-6 p-6 bg-green-50 rounded-xl border border-green-200 text-center">
          <div className="text-3xl mb-2">✅</div>
          <h2 className="text-xl font-bold text-green-800 mb-2">저장 완료!</h2>
          <p className="text-green-700">커피 기록이 성공적으로 저장되었습니다.</p>
          <button 
            onClick={() => router.push('/')} 
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg font-medium"
          >
            홈으로 돌아가기
          </button>
        </div>
      )}
      
      {/* 하단 고정 푸터 (업로드/분석 단계에서만 표시) */}
      {(activeStep === 1 || activeStep === 2) && !formSubmitted && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 flex justify-center">
          <div className="max-w-lg w-full flex">
            <button 
              onClick={() => {
                if (activeStep === 2) {
                  setActiveStep(1);
                  setPreview(null);
                  setImage(null);
                }
              }}
              className={`flex-1 px-3 py-2 ${activeStep === 1 ? 'bg-gray-200 text-gray-500' : 'bg-yellow-200 text-yellow-800'} rounded-lg mx-1 text-center`}
              disabled={activeStep === 1}
            >
              {activeStep === 1 ? "← 이전" : "← 다시 업로드"}
            </button>
            
            {activeStep === 2 && (
              <button 
                onClick={handleAnalyze}
                disabled={loading || !image}
                className="flex-1 px-3 py-2 bg-yellow-400 text-white rounded-lg mx-1 text-center font-bold"
              >
                {loading ? "분석 중..." : "분석하기 →"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 