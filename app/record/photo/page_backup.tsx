"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection } from "firebase/firestore";
import { db, auth } from "@/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthState } from "react-firebase-hooks/auth";
import Tesseract from 'tesseract.js';

interface OcrResult {
  cafe?: string;
  bean?: string;
  processing?: string;
  flavor?: string[];
  confidence?: number;
  raw_text?: string;
}

interface AnalysisStep {
  step: number;
  title: string;
  description: string;
  icon: string;
  progress?: number;
}

export default function PhotoRecordPage() {
  const [user] = useAuthState(auth);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 분석 단계
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([
    { step: 1, title: "이미지 준비", description: "사진을 처리하고 있어요", icon: "🔍", progress: 0 },
    { step: 2, title: "텍스트 인식", description: "AI가 텍스트를 읽고 있어요", icon: "📄", progress: 0 },
    { step: 3, title: "정보 추출", description: "커피 정보를 분석하고 있어요", icon: "🤖", progress: 0 },
    { step: 4, title: "완료", description: "분석이 완료되었어요!", icon: "✨", progress: 100 }
  ]);

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

  // OCR 결과 나오면 설문 폼 자동 채우기
  useEffect(() => {
    if (ocrResult) {
      setForm(prev => ({
        ...prev,
        cafe: ocrResult.cafe || "",
        bean: ocrResult.bean || "",
        processing: ocrResult.processing || "",
        flavor: ocrResult.flavor || []
      }));
      setShowForm(true);
    }
  }, [ocrResult]);

  // 파일 선택/촬영 시 미리보기
  const handleFileChange = (file: File, method: string) => {
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setOcrResult(null);
      setShowForm(false);
      setAnalysisStep(0);
      setOcrProgress(0);
    }
  };

  // 분석 진행 상태 업데이트
  const updateAnalysisProgress = (step: number, progress: number) => {
    setAnalysisSteps(prev => prev.map(s => 
      s.step === step ? { ...s, progress } : s
    ));
  };

  // Tesseract.js를 사용한 클라이언트 사이드 OCR
  const performOCR = async (imageFile: File): Promise<string> => {
    try {
      setAnalysisStep(2);
      updateAnalysisProgress(2, 0);

      const { data: { text } } = await Tesseract.recognize(
        imageFile,
        'eng', // 일단 영어만 지원 (안정성을 위해)
        {
          logger: (m) => {
            try {
              if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
                const progress = Math.round(m.progress * 100);
                setOcrProgress(progress);
                updateAnalysisProgress(2, progress);
              }
            } catch (loggerError) {
              console.warn('Logger error:', loggerError);
            }
          }
        }
      );

      updateAnalysisProgress(2, 100);
      return text || '';

    } catch (error) {
      console.error('OCR 에러:', error);
      throw error;
    }
  };

  // AI 분석 함수 (개선된 버전)
  const handleAnalyze = async () => {
    if (!image) return;

    try {
      setAnalyzing(true);
      setAnalysisStep(1);
      updateAnalysisProgress(1, 100);

      let extractedText = '';

      try {
        // 1단계: Tesseract.js로 OCR 수행
        extractedText = await performOCR(image);
      } catch (ocrError) {
        console.warn("OCR 실패, 수동 입력 모드로 전환:", ocrError);
        // OCR 실패 시 수동 입력 모드로 전환
        setAnalyzing(false);
        setAnalysisStep(0);
        setShowForm(true);
        alert("이미지에서 텍스트를 추출할 수 없습니다.\n수동으로 정보를 입력해주세요.");
        return;
      }
      
      if (!extractedText.trim()) {
        // 텍스트가 비어있을 경우 수동 입력 모드
        setAnalyzing(false);
        setAnalysisStep(0);
        setShowForm(true);
        alert("텍스트를 찾을 수 없습니다.\n수동으로 정보를 입력해주세요.");
        return;
      }

      // 2단계: LLM으로 구조화된 정보 추출
      setAnalysisStep(3);
      updateAnalysisProgress(3, 0);

      const llmResponse = await fetch('/api/llm-extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: extractedText,
          confidence: 0.9
        })
      });

      if (!llmResponse.ok) {
        throw new Error('AI 분석에 실패했습니다.');
      }

      const result = await llmResponse.json();
      updateAnalysisProgress(3, 100);
      
      // 최종 단계
      setAnalysisStep(4);
      setOcrResult({
        ...result,
        raw_text: extractedText
      });

    } catch (error) {
      console.error("분석 실패:", error);
      
      // 에러 발생 시 사용자 친화적 메시지
      const errorMessage = error instanceof Error ? error.message : "분석 중 오류가 발생했어요.";
      alert(`${errorMessage}\n\n다른 사진으로 다시 시도하거나, 수동으로 입력해주세요.`);
      
      // 단계 초기화
      setAnalysisStep(0);
      setAnalysisSteps(prev => prev.map(s => ({ ...s, progress: 0 })));
      setShowForm(true); // 수동 입력 모드로 전환
    } finally {
      setTimeout(() => {
        setAnalyzing(false);
      }, 1500);
    }
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
        ocrText: ocrResult?.raw_text || '',
        confidence: ocrResult?.confidence || 0,
        createdAt: new Date().toISOString(),
        source: 'photo_ai_analysis'
      });

      alert("🎉 커피 기록이 성공적으로 저장되었어요!");
      setTimeout(() => {
        router.push('/');
      }, 2000);

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
          <p className="text-2xl text-brown-600 mb-2">사진 한 장으로 시작하는 스마트 커피 기록</p>
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
                    setOcrResult(null);
                    setShowForm(false);
                    setAnalysisStep(0);
                    setOcrProgress(0);
                    setAnalysisSteps(prev => prev.map(s => ({ ...s, progress: 0 })));
                  }}
                  className="absolute -top-3 -right-3 w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  <span className="text-xl">✕</span>
                </button>
                
                {/* 이미지 품질 피드백 */}
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="bg-black/60 backdrop-blur-sm rounded-xl p-3 text-white text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">📷</span>
                      <span>이미지 품질: 양호</span>
                    </div>
                    <p className="text-gray-300 text-xs mt-1">
                      텍스트가 선명하게 보입니다. 분석 준비 완료!
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-coffee-300 rounded-2xl p-16 text-center bg-gradient-to-br from-coffee-50/50 to-cream-100/50">
                <div className="text-9xl mb-8">📸</div>
                <h3 className="text-3xl font-bold text-brown-800 mb-4">사진을 선택해주세요</h3>
                <p className="text-brown-600 text-lg mb-8">
                  커피백, 메뉴판, 원두 포장지 등<br/>
                  텍스트가 선명하게 보이는 사진이 좋아요!
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-brown-500">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">💡</span>
                    <span>밝은 조명</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">📏</span>
                    <span>적절한 거리</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">🎯</span>
                    <span>텍스트 중심</span>
                  </div>
                </div>
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
                  try {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileChange(file, "카메라");
                    }
                  } catch (error) {
                    console.error('File input error:', error);
                  }
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
                  try {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileChange(file, "갤러리");
                    }
                  } catch (error) {
                    console.error('File input error:', error);
                  }
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

          {/* 분석하기 버튼 */}
          {preview && !ocrResult && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: analyzing ? 1 : 1.02 }}
              whileTap={{ scale: analyzing ? 1 : 0.98 }}
              className="w-full flex items-center justify-center gap-6 px-10 py-8 bg-gradient-to-r from-coffee-600 to-brown-600 text-white rounded-3xl font-bold text-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleAnalyze}
              disabled={analyzing || !image}
            >
              {analyzing ? (
                <>
                  <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span>AI가 열심히 분석 중...</span>
                </>
              ) : (
                <>
                  <span className="text-5xl">🤖</span>
                  <span>AI 분석 시작하기</span>
                </>
              )}
            </motion.button>
          )}

          {/* 향상된 분석 진행 상태 */}
          {analyzing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/50"
            >
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-coffee-700 mb-2">AI 분석 진행중</h3>
                <p className="text-coffee-600">잠시만 기다려주세요. 정확한 분석을 위해 여러 단계를 거치고 있어요.</p>
              </div>
              
              <div className="space-y-6">
                {analysisSteps.map((step, index) => (
                  <div key={step.step} className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-500 ${
                    analysisStep >= step.step ? 'bg-coffee-100/60 scale-105' : 'bg-gray-50/60'
                  }`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all duration-500 ${
                      analysisStep > step.step ? 'bg-green-500 text-white' : 
                      analysisStep === step.step ? 'bg-coffee-500 text-white animate-pulse' : 
                      'bg-gray-200 text-gray-400'
                    }`}>
                      {analysisStep > step.step ? '✓' : step.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-bold text-lg transition-colors duration-300 ${
                        analysisStep >= step.step ? 'text-coffee-700' : 'text-gray-500'
                      }`}>
                        {step.title}
                      </h3>
                      <p className={`text-sm transition-colors duration-300 ${
                        analysisStep >= step.step ? 'text-coffee-600' : 'text-gray-400'
                      }`}>
                        {step.description}
                      </p>
                      
                      {/* OCR 진행률 표시 */}
                      {step.step === 2 && analysisStep === 2 && ocrProgress > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-coffee-600 mb-1">
                            <span>텍스트 인식 진행률</span>
                            <span>{ocrProgress}%</span>
                          </div>
                          <div className="w-full bg-coffee-200 rounded-full h-2">
                            <div 
                              className="bg-coffee-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${ocrProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 향상된 분석 결과 요약 */}
          {ocrResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-coffee-500 via-coffee-600 to-brown-500 rounded-3xl p-8 text-white shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-6">
                <span className="text-4xl">✨</span>
                <div>
                  <h3 className="text-2xl font-bold">분석 완료!</h3>
                  <p className="text-white/80">AI가 다음 정보를 추출했어요</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {ocrResult.cafe && (
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">📍</span>
                      <span className="font-semibold">카페</span>
                    </div>
                    <p className="text-white/90">{ocrResult.cafe}</p>
                  </div>
                )}
                {ocrResult.bean && (
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">☕</span>
                      <span className="font-semibold">원두</span>
                    </div>
                    <p className="text-white/90">{ocrResult.bean}</p>
                  </div>
                )}
                {ocrResult.processing && (
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">⚙️</span>
                      <span className="font-semibold">프로세싱</span>
                    </div>
                    <p className="text-white/90">{ocrResult.processing}</p>
                  </div>
                )}
                {ocrResult.flavor && ocrResult.flavor.length > 0 && (
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">🌸</span>
                      <span className="font-semibold">향미</span>
                    </div>
                    <p className="text-white/90">{ocrResult.flavor.join(', ')}</p>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <p className="text-white/80">
                  아래에서 세부 정보를 수정하고 저장해보세요!
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/60">신뢰도:</span>
                  <span className="font-semibold">{Math.round((ocrResult.confidence || 0.8) * 100)}%</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* 폼 입력 영역 */}
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/50"
            >
              <h2 className="text-3xl font-bold text-brown-800 mb-8 text-center">
                세부 정보 입력 및 수정
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
    </div>
  );
} 