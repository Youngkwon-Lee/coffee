"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection } from "firebase/firestore";
import { db, auth } from "@/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthState } from "react-firebase-hooks/auth";

// Tesseract.js 동적 import (에러 방지)
let Tesseract: any = null;
if (typeof window !== "undefined") {
  import('tesseract.js').then(module => {
    Tesseract = module.default;
  }).catch(err => {
    console.warn("Tesseract.js 로드 실패:", err);
  });
}

interface AnalysisResult {
  cafe?: string;
  bean?: string;
  processing?: string;
  flavor?: string[];
  confidence?: number;
  raw_text?: string;
}

// 커피 플레이버 휠 데이터 (이미지 기반)
const FLAVOR_CATEGORIES = {
  "과일": {
    color: "bg-pink-500",
    items: ["딸기", "블루베리", "라즈베리", "체리", "자두", "복숭아", "살구", "사과", "배", "포도", "오렌지", "레몬", "라임", "자몽"]
  },
  "베리": {
    color: "bg-purple-500", 
    items: ["블랙베리", "블랙커런트", "크랜베리", "건포도", "자두"]
  },
  "감귤": {
    color: "bg-orange-500",
    items: ["오렌지", "자몽", "레몬", "라임", "만다린", "탠져린"]
  },
  "열대과일": {
    color: "bg-yellow-500",
    items: ["망고", "파인애플", "파파야", "패션프루트", "구아바", "코코넛"]
  },
  "꽃": {
    color: "bg-pink-300",
    items: ["장미", "재스민", "라벤더", "바이올렛", "히비스커스", "엘더플라워"]
  },
  "허브": {
    color: "bg-green-400",
    items: ["바질", "로즈마리", "타임", "민트", "세이지", "오레가노"]
  },
  "향신료": {
    color: "bg-red-500",
    items: ["계피", "정향", "육두구", "카다몬", "생강", "후추", "바닐라", "아니스"]
  },
  "견과류": {
    color: "bg-amber-600",
    items: ["아몬드", "헤이즐넛", "호두", "피칸", "마카다미아", "땅콩", "캐슈넛"]
  },
  "초콜릿": {
    color: "bg-amber-800",
    items: ["다크초콜릿", "밀크초콜릿", "화이트초콜릿", "코코아", "카카오닙스"]
  },
  "캐러멜": {
    color: "bg-amber-700",
    items: ["캐러멜", "토피", "버터스카치", "메이플시럽", "꿀", "몰라세스"]
  },
  "구움": {
    color: "bg-amber-500",
    items: ["토스트", "비스킷", "브레드", "시리얼", "그래놈", "말트"]
  },
  "스모키": {
    color: "bg-gray-600",
    items: ["연기", "탄", "재", "타르", "담배", "가죽"]
  },
  "어스": {
    color: "bg-stone-600", 
    items: ["흙", "이끼", "버섯", "나무", "삼나무", "허브"]
  },
  "와인": {
    color: "bg-red-600",
    items: ["적포도주", "백포도주", "포트와인", "셰리", "브랜디"]
  }
};

export default function PhotoRecordPageWithWheel() {
  const [user] = useAuthState(auth);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [showFlavorWheel, setShowFlavorWheel] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 설문 폼 상태
  const [form, setForm] = useState({
    cafe: "",
    bean: "",
    processing: "",
    flavor: [] as string[],
    rating: 0,
    mood: "",
    review: ""
  });

  // 분석 결과가 나오면 폼에 자동 입력
  useEffect(() => {
    if (analysisResult) {
      setForm(prev => ({
        ...prev,
        cafe: analysisResult.cafe || "",
        bean: analysisResult.bean || "",
        processing: analysisResult.processing || "",
        flavor: analysisResult.flavor || []
      }));
    }
  }, [analysisResult]);

  // 파일 선택/촬영 시 미리보기
  const handleFileChange = (file: File) => {
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setAnalysisResult(null);
      setAnalysisStep("");
      setOcrProgress(0);
    }
  };

  // OCR 수행
  const performOCR = async (imageFile: File): Promise<string> => {
    if (!Tesseract) {
      throw new Error("Tesseract.js가 로드되지 않았습니다.");
    }

    setAnalysisStep("텍스트 인식 중...");
    setOcrProgress(0);

    try {
      const { data: { text } } = await Tesseract.recognize(
        imageFile,
        'eng',
        {
          logger: (m: any) => {
            if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
              const progress = Math.round(m.progress * 100);
              setOcrProgress(progress);
            }
          }
        }
      );

      return text.trim();
    } catch (error) {
      console.error('OCR 에러:', error);
      throw new Error('텍스트 인식에 실패했습니다.');
    }
  };

  // OpenAI로 커피 정보 추출
  const extractCoffeeInfo = async (text: string): Promise<AnalysisResult> => {
    setAnalysisStep("AI가 커피 정보를 분석 중...");

    try {
      const response = await fetch('/api/llm-extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          confidence: 0.9
        })
      });

      if (!response.ok) {
        throw new Error('AI 분석에 실패했습니다.');
      }

      const result = await response.json();
      return {
        ...result,
        raw_text: text
      };
    } catch (error) {
      console.error('LLM 분석 에러:', error);
      throw new Error('AI 분석에 실패했습니다.');
    }
  };

  // 전체 분석 프로세스
  const handleAnalyze = async () => {
    if (!image) return;

    try {
      setAnalyzing(true);
      setAnalysisStep("분석 준비 중...");

      const extractedText = await performOCR(image);
      
      if (!extractedText) {
        alert("이미지에서 텍스트를 찾을 수 없습니다.\n수동으로 입력해주세요.");
        return;
      }

      const result = await extractCoffeeInfo(extractedText);
      
      setAnalysisResult(result);
      setAnalysisStep("분석 완료!");
      
      setTimeout(() => {
        alert("🎉 AI 분석이 완료되었습니다!\n아래에서 정보를 확인하고 수정해주세요.");
      }, 500);

    } catch (error) {
      console.error("분석 실패:", error);
      const errorMessage = error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.";
      alert(`${errorMessage}\n\n수동으로 입력해주세요.`);
    } finally {
      setTimeout(() => {
        setAnalyzing(false);
        setAnalysisStep("");
      }, 2000);
    }
  };

  // 향미 추가
  const addFlavor = (flavor: string) => {
    if (!form.flavor.includes(flavor)) {
      setForm(prev => ({
        ...prev,
        flavor: [...prev.flavor, flavor]
      }));
    }
  };

  // 향미 제거
  const removeFlavor = (flavor: string) => {
    setForm(prev => ({
      ...prev,
      flavor: prev.flavor.filter(f => f !== flavor)
    }));
  };

  // 플레이버 휠에서 향미 선택
  const handleFlavorWheelSelect = (flavor: string) => {
    addFlavor(flavor);
  };

  // 폼 제출
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.bean || !form.cafe) return;

    try {
      setSubmitting(true);
      
      await addDoc(collection(db, "users", user.uid, "coffee_records"), {
        ...form,
        imageUrl: preview,
        analysisData: analysisResult,
        createdAt: new Date().toISOString(),
        source: analysisResult ? 'photo_ai_analysis' : 'photo_manual_input'
      });

      alert("🎉 커피 기록이 성공적으로 저장되었어요!");
      
      setForm({
        cafe: "",
        bean: "",
        processing: "",
        flavor: [],
        rating: 0,
        mood: "",
        review: ""
      });
      setImage(null);
      setPreview(null);
      setAnalysisResult(null);

    } catch (error) {
      console.error("저장 실패:", error);
      alert("저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const PROCESSING_OPTIONS = ["Natural", "Washed", "Honey", "Anaerobic", "Semi-washed", "기타"];
  const MOOD_OPTIONS = [
    { emoji: "😊", label: "행복해요" },
    { emoji: "☕", label: "카페인 충전" },
    { emoji: "🌅", label: "상쾌해요" },
    { emoji: "💪", label: "에너지 충만" },
    { emoji: "😌", label: "편안해요" },
    { emoji: "🔥", label: "열정적" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-coffee-50 to-cream-100 pt-20 pb-16">
      <div className="container mx-auto px-4 max-w-4xl">
        
        {/* 헤더 */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-brown-800 via-coffee-700 to-brown-800 bg-clip-text text-transparent mb-4">
            AI 커피 분석
          </h1>
          <p className="text-2xl text-brown-600 mb-2">사진으로 시작하는 스마트 커피 기록</p>
          <p className="text-brown-500 text-lg">커피백, 메뉴판, 원두 포장지를 촬영해서 AI 분석을 받아보세요</p>
        </motion.div>

        {/* 메인 컨텐츠 */}
        <div className="space-y-8">
          
          {/* 사진 영역 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/50"
          >
            {preview ? (
              <div className="relative">
                <img 
                  src={preview} 
                  alt="선택된 사진" 
                  className="w-full h-80 object-cover rounded-2xl border border-coffee-200 shadow-lg" 
                />
                <button 
                  onClick={() => {
                    setPreview(null);
                    setImage(null);
                    setAnalysisResult(null);
                  }}
                  className="absolute -top-3 -right-3 w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  <span className="text-xl">✕</span>
                </button>
                
                {/* 분석 상태 표시 */}
                {analyzing && (
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-black/70 backdrop-blur-sm rounded-xl p-4 text-white">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        <span className="font-semibold">{analysisStep}</span>
                      </div>
                      {ocrProgress > 0 && ocrProgress < 100 && (
                        <div className="w-full bg-white/20 rounded-full h-2">
                          <div 
                            className="bg-coffee-400 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${ocrProgress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-coffee-300 rounded-2xl p-16 text-center bg-gradient-to-br from-coffee-50/50 to-cream-100/50">
                <div className="text-9xl mb-8">📸</div>
                <h3 className="text-3xl font-bold text-brown-800 mb-4">사진을 선택해주세요</h3>
                <p className="text-brown-600 text-lg mb-8">
                  커피백, 메뉴판, 원두 포장지 등<br/>
                  텍스트가 있는 커피 관련 사진을 업로드하세요!
                </p>
              </div>
            )}
          </motion.div>

          {/* 사진 선택 버튼들 */}
          {!preview && (
            <div className="space-y-6">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChange(file);
                }}
                ref={cameraInputRef}
                className="hidden"
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-6 px-10 py-8 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-3xl font-bold text-2xl shadow-2xl hover:shadow-3xl transition-all duration-300"
                onClick={() => cameraInputRef.current?.click()}
              >
                <span className="text-5xl">📷</span> 
                <span>사진 촬영하기</span>
              </motion.button>
              
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChange(file);
                }}
                ref={fileInputRef}
                className="hidden"
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-6 px-10 py-8 bg-gradient-to-r from-brown-500 to-brown-600 text-white rounded-3xl font-bold text-2xl shadow-2xl hover:shadow-3xl transition-all duration-300"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="text-5xl">🖼️</span> 
                <span>갤러리에서 선택</span>
              </motion.button>
            </div>
          )}

          {/* AI 분석 버튼 */}
          {preview && !analysisResult && !analyzing && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-6 px-10 py-8 bg-gradient-to-r from-coffee-600 to-brown-600 text-white rounded-3xl font-bold text-2xl shadow-2xl hover:shadow-3xl transition-all duration-300"
              onClick={handleAnalyze}
            >
              <span className="text-5xl">🤖</span>
              <span>AI 분석 시작하기</span>
            </motion.button>
          )}

          {/* 분석 진행 중 상태 */}
          {analyzing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/50 text-center"
            >
              <div className="w-16 h-16 border-4 border-coffee-200 border-t-coffee-500 rounded-full animate-spin mx-auto mb-6"></div>
              <h3 className="text-2xl font-bold text-coffee-700 mb-2">AI 분석 진행 중</h3>
              <p className="text-coffee-600 text-lg">{analysisStep}</p>
              {ocrProgress > 0 && ocrProgress < 100 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm text-coffee-600 mb-2">
                    <span>진행률</span>
                    <span>{ocrProgress}%</span>
                  </div>
                  <div className="w-full bg-coffee-200 rounded-full h-3">
                    <div 
                      className="bg-coffee-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${ocrProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* 분석 결과 */}
          {analysisResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-coffee-500 via-coffee-600 to-brown-500 rounded-3xl p-8 text-white shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-6">
                <span className="text-4xl">✨</span>
                <div>
                  <h3 className="text-2xl font-bold">AI 분석 완료!</h3>
                  <p className="text-white/80">다음 정보를 추출했어요</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {analysisResult.cafe && (
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">📍</span>
                      <span className="font-semibold">카페</span>
                    </div>
                    <p className="text-white/90">{analysisResult.cafe}</p>
                  </div>
                )}
                {analysisResult.bean && (
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">☕</span>
                      <span className="font-semibold">원두</span>
                    </div>
                    <p className="text-white/90">{analysisResult.bean}</p>
                  </div>
                )}
                {analysisResult.processing && (
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">⚙️</span>
                      <span className="font-semibold">프로세싱</span>
                    </div>
                    <p className="text-white/90">{analysisResult.processing}</p>
                  </div>
                )}
                {analysisResult.flavor && analysisResult.flavor.length > 0 && (
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">🌸</span>
                      <span className="font-semibold">향미</span>
                    </div>
                    <p className="text-white/90">{analysisResult.flavor.join(', ')}</p>
                  </div>
                )}
              </div>
              
              <p className="text-white/80 text-center">
                아래에서 정보를 확인하고 수정한 후 저장해보세요!
              </p>
            </motion.div>
          )}

          {/* 수동 분석 버튼 */}
          {preview && !analyzing && (
            <div className="text-center">
              <button
                onClick={() => {
                  const formSection = document.querySelector('#coffee-form');
                  formSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-brown-600 hover:text-brown-800 underline transition-colors"
              >
                AI 분석 없이 수동으로 입력하기
              </button>
            </div>
          )}

          {/* 폼 입력 영역 */}
          {preview && (
            <motion.div
              id="coffee-form"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/50"
            >
              <h2 className="text-3xl font-bold text-brown-800 mb-8 text-center">
                {analysisResult ? "정보 확인 및 수정" : "커피 정보 입력"}
              </h2>
              
              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 카페명 */}
                  <div>
                    <label className="block text-lg font-semibold text-brown-700 mb-3">
                      카페명 <span className="text-red-500">*</span>
                    </label>
                    <input 
                      className="w-full px-6 py-4 border-2 border-coffee-200 rounded-2xl bg-white text-brown-700 focus:outline-none focus:ring-4 focus:ring-coffee-400/30 focus:border-coffee-400 transition-all duration-300 text-lg" 
                      value={form.cafe} 
                      onChange={e => setForm(prev => ({...prev, cafe: e.target.value}))} 
                      placeholder="카페명을 입력하세요"
                      required
                    />
                  </div>
                  
                  {/* 원두명 */}
                  <div>
                    <label className="block text-lg font-semibold text-brown-700 mb-3">
                      원두명 <span className="text-red-500">*</span>
                    </label>
                    <input 
                      className="w-full px-6 py-4 border-2 border-coffee-200 rounded-2xl bg-white text-brown-700 focus:outline-none focus:ring-4 focus:ring-coffee-400/30 focus:border-coffee-400 transition-all duration-300 text-lg" 
                      value={form.bean} 
                      onChange={e => setForm(prev => ({...prev, bean: e.target.value}))} 
                      placeholder="원두명을 입력하세요"
                      required
                    />
                  </div>
                </div>

                {/* 프로세싱 */}
                <div>
                  <label className="block text-lg font-semibold text-brown-700 mb-4">프로세싱</label>
                  <div className="flex flex-wrap gap-3">
                    {PROCESSING_OPTIONS.map(process => (
                      <button
                        key={process}
                        type="button"
                        className={`px-6 py-3 rounded-2xl border-2 transition-all duration-300 font-semibold ${
                          form.processing === process 
                            ? "bg-coffee-500 text-white border-coffee-500 shadow-lg" 
                            : "bg-white text-brown-700 border-coffee-200 hover:bg-coffee-50 hover:border-coffee-300"
                        }`}
                        onClick={() => setForm(prev => ({...prev, processing: process}))}
                      >
                        {process}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 향미 선택 (개선된 버전) */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-lg font-semibold text-brown-700">향미</label>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowFlavorWheel(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <span className="text-2xl">🎯</span>
                      <span>플레이버 휠로 선택</span>
                    </motion.button>
                  </div>
                  
                  {/* 선택된 향미들 */}
                  {form.flavor.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-brown-600 mb-2">선택된 향미:</h4>
                      <div className="flex flex-wrap gap-2">
                        {form.flavor.map((flavor, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-2 px-4 py-2 bg-coffee-100 text-coffee-700 rounded-xl border border-coffee-200 shadow-sm"
                          >
                            <span className="font-medium">{flavor}</span>
                            <button
                              type="button"
                              onClick={() => removeFlavor(flavor)}
                              className="text-coffee-500 hover:text-red-500 transition-colors text-lg"
                            >
                              ✕
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* 텍스트 입력 */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="향미를 직접 입력하세요 (예: 초콜릿, 견과류)"
                      className="flex-1 px-4 py-3 border-2 border-coffee-200 rounded-xl bg-white text-brown-700 focus:outline-none focus:ring-4 focus:ring-coffee-400/30 focus:border-coffee-400 transition-all duration-300"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          const value = input.value.trim();
                          if (value) {
                            addFlavor(value);
                            input.value = '';
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = (e.target as HTMLButtonElement).previousElementSibling as HTMLInputElement;
                        const value = input.value.trim();
                        if (value) {
                          addFlavor(value);
                          input.value = '';
                        }
                      }}
                      className="px-6 py-3 bg-coffee-500 text-white rounded-xl hover:bg-coffee-600 transition-colors font-semibold"
                    >
                      추가
                    </button>
                  </div>
                </div>

                {/* 평점 */}
                <div>
                  <label className="block text-lg font-semibold text-brown-700 mb-4">평점</label>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      {[1,2,3,4,5].map(n => (
                        <button
                          key={n}
                          type="button"
                          className={`text-4xl transition-all duration-300 hover:scale-110 ${
                            form.rating >= n ? "text-coffee-400" : "text-brown-300"
                          }`}
                          onClick={() => setForm(prev => ({...prev, rating: n}))}
                        >
                          ⭐
                        </button>
                      ))}
                    </div>
                    <span className="text-lg font-semibold text-brown-700">
                      {form.rating ? `${form.rating}점` : "별점 선택"}
                    </span>
                  </div>
                </div>

                {/* 기분 */}
                <div>
                  <label className="block text-lg font-semibold text-brown-700 mb-4">오늘의 기분</label>
                  <div className="flex flex-wrap gap-3">
                    {MOOD_OPTIONS.map(opt => (
                      <button
                        key={opt.label}
                        type="button"
                        className={`flex items-center gap-3 px-6 py-3 rounded-2xl border-2 transition-all duration-300 font-semibold ${
                          form.mood === opt.emoji + ' ' + opt.label 
                            ? "bg-coffee-500 text-white border-coffee-500 shadow-lg" 
                            : "bg-white text-brown-700 border-coffee-200 hover:bg-coffee-50 hover:border-coffee-300"
                        }`}
                        onClick={() => setForm(prev => ({...prev, mood: opt.emoji + ' ' + opt.label}))}
                      >
                        <span className="text-xl">{opt.emoji}</span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 한줄평 */}
                <div>
                  <label className="block text-lg font-semibold text-brown-700 mb-3">한줄평</label>
                  <textarea 
                    className="w-full px-6 py-4 border-2 border-coffee-200 rounded-2xl bg-white text-brown-700 focus:outline-none focus:ring-4 focus:ring-coffee-400/30 focus:border-coffee-400 transition-all duration-300 resize-none text-lg"
                    rows={3}
                    value={form.review} 
                    onChange={e => setForm(prev => ({...prev, review: e.target.value}))} 
                    placeholder="오늘 마신 커피에 대한 소감을 자유롭게 남겨보세요"
                  />
                </div>

                {/* 저장 버튼 */}
                <motion.button 
                  type="submit" 
                  disabled={submitting || !form.bean || !form.cafe}
                  whileHover={{ scale: submitting ? 1 : 1.02 }}
                  whileTap={{ scale: submitting ? 1 : 0.98 }}
                  className="w-full flex items-center justify-center gap-4 px-8 py-6 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-2xl font-bold text-xl shadow-2xl hover:shadow-3xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      <span>저장 중...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl">💾</span>
                      <span>커피 기록 저장하기</span>
                    </>
                  )}
                </motion.button>
              </form>
            </motion.div>
          )}
        </div>
      </div>

      {/* 플레이버 휠 모달 */}
      <AnimatePresence>
        {showFlavorWheel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowFlavorWheel(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-4xl font-bold text-brown-800 mb-2">커피 플레이버 휠</h2>
                  <p className="text-brown-600">카테고리를 선택해서 향미를 추가해보세요! 🎯</p>
                </div>
                <button
                  onClick={() => setShowFlavorWheel(false)}
                  className="w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-300 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {Object.entries(FLAVOR_CATEGORIES).map(([category, data]) => (
                  <motion.div
                    key={category}
                    whileHover={{ scale: 1.02, y: -5 }}
                    className={`${data.color} rounded-2xl p-6 text-white shadow-lg hover:shadow-2xl transition-all duration-300`}
                  >
                    <h3 className="text-xl font-bold mb-4 text-center">{category}</h3>
                    <div className="space-y-2">
                      {data.items.map((flavor) => (
                        <motion.button
                          key={flavor}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            handleFlavorWheelSelect(flavor);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                            form.flavor.includes(flavor)
                              ? 'bg-white/30 border-2 border-white shadow-lg'
                              : 'bg-white/10 hover:bg-white/20 border-2 border-transparent'
                          }`}
                        >
                          {form.flavor.includes(flavor) && <span className="mr-1">✓</span>}
                          {flavor}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <div className="mt-8 text-center">
                <div className="mb-6">
                  <p className="text-brown-600 text-lg mb-2">
                    선택된 향미: <span className="font-bold text-coffee-600">{form.flavor.length}개</span>
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {form.flavor.slice(0, 10).map((flavor, index) => (
                      <span key={index} className="px-3 py-1 bg-coffee-100 text-coffee-700 rounded-lg text-sm font-medium">
                        {flavor}
                      </span>
                    ))}
                    {form.flavor.length > 10 && (
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">
                        +{form.flavor.length - 10}개 더
                      </span>
                    )}
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowFlavorWheel(false)}
                  className="px-8 py-4 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  선택 완료 ({form.flavor.length}개)
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 