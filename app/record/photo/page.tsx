"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db, auth } from "@/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthState } from "react-firebase-hooks/auth";
import Link from "next/link";
import { useCustomAlert } from "../../components/CustomAlert";

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
  roast_level?: string;
  origin?: string;
  confidence?: number;
  raw_text?: string;
  source?: string;
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

export default function PhotoRecordPageSimple() {
  const [user] = useAuthState(auth);
  const { showAlert, AlertComponent } = useCustomAlert();
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [analysisError, setAnalysisError] = useState<string>("");
  const [glmUnavailable, setGlmUnavailable] = useState(false);
  const [showValidationHints, setShowValidationHints] = useState(false);
  const [showFlavorWheel, setShowFlavorWheel] = useState(false);
  const [cafeSuggestions, setCafeSuggestions] = useState<string[]>([]);
  const [showCafeSuggestions, setShowCafeSuggestions] = useState(false);

  // 체험 모드 상태
  const [trialCount, setTrialCount] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('coffee_trial_count') || '0');
    }
    return 0;
  });
  const MAX_TRIAL_COUNT = 3;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 자주 방문하는 카페 목록 로드
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (isMounted) {
        await loadFrequentCafes();
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const loadFrequentCafes = async () => {
    if (!user) return;

    try {
      const recordsQuery = query(
        collection(db, "users", user.uid, "records"),
        orderBy("createdAt", "desc"),
        limit(50) // 최근 50개 기록에서 추출
      );
      const recordsSnapshot = await getDocs(recordsQuery);

      // 카페명 빈도 계산
      const cafeFrequency: { [key: string]: number } = {};
      recordsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.cafe && typeof data.cafe === 'string') {
          cafeFrequency[data.cafe] = (cafeFrequency[data.cafe] || 0) + 1;
        }
      });

      // 빈도순으로 정렬하여 상위 10개 추출
      const sortedCafes = Object.entries(cafeFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([cafe]) => cafe);

      setCafeSuggestions(sortedCafes);
    } catch (error) {
      console.error('카페 목록 로드 실패:', error);
    }
  };

  // 설문 폼 상태
  const [form, setForm] = useState({
    cafe: "",
    bean: "",
    processing: "",
    flavor: [] as string[],
    rating: 0,
    mood: "",
    review: "",
    roasting: "",
    brewMethod: ""
  });

  // 분석 결과가 나오면 폼에 자동 입력
  useEffect(() => {
    if (analysisResult) {
      setForm(prev => ({
        ...prev,
        cafe: analysisResult.cafe || "",
        bean: analysisResult.bean || "",
        processing: analysisResult.processing || "",
        flavor: analysisResult.flavor || [],
        roasting: analysisResult.roast_level || ""
      }));
    }
  }, [analysisResult]);

  // 이미지 압축 함수
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = () => {
        // 최대 크기 설정 (OCR 성능과 속도 균형)
        const maxWidth = 1200;
        const maxHeight = 1200;

        let { width, height } = img;

        // 비율 유지하면서 리사이즈
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // 이미지 품질 향상을 위한 필터 적용
        ctx.filter = 'contrast(110%) brightness(105%)';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file); // 압축 실패시 원본 반환
            }
          },
          'image/jpeg',
          0.8 // 80% 품질
        );
      };

      img.src = URL.createObjectURL(file);
    });
  };

  // 파일 선택/촬영 시 미리보기 (이미지 압축 포함)
  const handleFileChange = async (file: File) => {
    if (file) {
      // 파일 크기 제한 (10MB)
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxFileSize) {
        showAlert({
          type: 'error',
          title: '파일 크기 초과',
          message: '이미지 크기가 너무 큽니다. 10MB 이하의 파일을 선택해주세요.'
        });
        return;
      }

      // 지원되는 파일 형식 확인
      const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!supportedTypes.includes(file.type)) {
        showAlert({
          type: 'error',
          title: '지원하지 않는 형식',
          message: 'JPG, PNG, WebP 형식의 이미지만 지원됩니다.'
        });
        return;
      }

      try {
        setAnalysisStep("이미지 최적화 중...");

        // 이미지 압축
        const compressedFile = await compressImage(file);

        setImage(compressedFile);
        const previewUrl = URL.createObjectURL(compressedFile);
        setPreview(previewUrl);
        setAnalysisResult(null);
        setAnalysisStep("");
        setOcrProgress(0);
        setAnalysisError(""); // 에러 상태도 초기화

        // 기존 preview URL 정리
        return () => {
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }
        };

        // 압축 완료 알림
        const originalSize = (file.size / 1024 / 1024).toFixed(1);
        const compressedSize = (compressedFile.size / 1024 / 1024).toFixed(1);
        console.log(`이미지 압축 완료: ${originalSize}MB → ${compressedSize}MB`);

      } catch (error) {
        console.error('이미지 압축 실패:', error);
        // 압축 실패시 원본 사용
        setImage(file);
        setPreview(URL.createObjectURL(file));
        setAnalysisResult(null);
        setAnalysisStep("");
        setOcrProgress(0);
      }
    }
  };

  // GLM-OCR (로컬 Ollama)로 커피 정보 직접 추출
  const performGlmOcr = async (imageFile: File): Promise<AnalysisResult> => {
    setAnalysisStep("로컬 AI(GLM-OCR)로 커피 정보 분석 중...");
    setOcrProgress(30);

    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('mode', 'coffee');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const response = await fetch('/api/glm-ocr', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    setOcrProgress(90);

    if (!response.ok) {
      throw new Error('GLM-OCR 서버 오류');
    }

    const result = await response.json();
    setOcrProgress(100);
    return {
      cafe: result.cafe || '',
      bean: result.bean || '',
      processing: result.processing || '',
      flavor: Array.isArray(result.flavor) ? result.flavor : [],
      roast_level: result.roast_level || '',
      origin: result.origin || '',
      confidence: result.confidence || 0.85,
      raw_text: result.raw_text || '',
    };
  };

  // OCR 수행 (CoffeeScanPro 스타일)
  const performOCR = async (imageFile: File): Promise<string> => {
    if (!Tesseract) {
      throw new Error("Tesseract.js가 로드되지 않았습니다.");
    }

    setAnalysisStep("텍스트 인식 중...");
    setOcrProgress(0);

    try {
      const { data: { text } } = await Tesseract.recognize(
        imageFile,
        'kor+eng',
        {
          logger: (m: any) => {
            if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
              const progress = Math.round(m.progress * 100);
              setOcrProgress(progress);
            }
          },
          // OCR 안정화 파라미터 (영수증/라벨 혼합 텍스트에 유리)
          tessedit_pageseg_mode: 6, // Assume a single uniform block of text
          preserve_interword_spaces: '1',
          user_defined_dpi: '300',
        }
      );

      return text.trim();
    } catch (error) {
      console.error('OCR 에러:', error);
      throw new Error('텍스트 인식에 실패했습니다.');
    }
  };

  // OpenAI로 커피 정보 추출 (CoffeeScanPro 스타일)
  const extractCoffeeInfo = async (text: string): Promise<AnalysisResult> => {
    setAnalysisStep("AI가 커피 정보를 분석 중...");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/api/llm-extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          confidence: 0.9
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('API 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.');
        } else if (response.status >= 500) {
          throw new Error('서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
        }
        throw new Error('AI 분석에 실패했습니다.');
      }

      const result = await response.json();
      return {
        ...result,
        raw_text: text
      };
    } catch (error) {
      console.error('LLM 분석 에러:', error);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.');
        }
        throw error;
      }

      throw new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
    }
  };

  // 전체 분석 프로세스
  const handleAnalyze = async () => {
    if (!image) return;

    // 체험 모드 체크 (로그인하지 않은 경우)
    if (!user && trialCount >= MAX_TRIAL_COUNT) {
      showAlert({
        type: 'warning',
        title: '체험 횟수 초과',
        message: `무료 체험은 ${MAX_TRIAL_COUNT}회까지 가능합니다.\n\n로그인하시면 무제한으로 이용하실 수 있어요!`,
        confirmText: '로그인하기',
        showCancel: true,
        cancelText: '나중에',
        onConfirm: () => {
          // TODO: 로그인 페이지로 이동
          router.push('/login');
        }
      });
      return;
    }

    try {
      setAnalyzing(true);
      setAnalysisError("");
      setGlmUnavailable(false);
      setAnalysisStep("분석 준비 중...");

      let result: AnalysisResult | null = null;

      // 1단계: GLM-OCR (로컬 Ollama)로 직접 추출 시도
      try {
        setAnalysisStep("로컬 AI 연결 확인 중...");
        const healthCheck = await fetch('/api/glm-ocr', { method: 'GET', signal: AbortSignal.timeout(3000) });
        const health = await healthCheck.json();

        if (health.status === 'ok') {
          result = await performGlmOcr(image);
          if (result && result.bean) {
            setAnalysisResult(result);
            setAnalysisStep("분석 완료! (GLM-OCR)");
          } else {
            result = null; // 유의미한 결과 없으면 폴백
          }
        }
      } catch (glmErr) {
        console.log('GLM-OCR 사용 불가, Tesseract+LLM 폴백:', glmErr);
        setGlmUnavailable(true);
      }

      // 2단계: GLM-OCR 실패 시 기존 Tesseract + OpenAI 파이프라인
      if (!result || !result.bean) {
        const extractedText = await performOCR(image);

        if (!extractedText || extractedText.trim().length < 3) {
          setAnalysisError("이미지에서 텍스트를 찾을 수 없습니다. 수동으로 입력해주세요.");
          setAnalysisResult({
            cafe: "", bean: "", processing: "", flavor: [],
            confidence: 0, raw_text: ""
          });
          showAlert({
            type: 'warning',
            title: '텍스트 인식 실패',
            message: '이미지에서 텍스트를 인식할 수 없었습니다.\n\n💡 촬영 팁:\n• 조명이 밝은 곳에서 촬영\n• 텍스트가 선명하게 보이도록 촬영\n• 카메라를 수직으로 정렬\n\n아래에서 직접 입력해주세요.'
          });
          return;
        }

        result = await extractCoffeeInfo(extractedText);
        setAnalysisResult(result);
        setAnalysisStep("분석 완료!");
      }

      // 체험 카운트 증가 (로그인하지 않은 경우)
      if (!user) {
        const newTrialCount = trialCount + 1;
        setTrialCount(newTrialCount);
        if (typeof window !== 'undefined') {
          localStorage.setItem('coffee_trial_count', newTrialCount.toString());
        }
      }

      // 성공 메시지
      setTimeout(() => {
        const remainingTrials = user ? null : MAX_TRIAL_COUNT - (trialCount + 1);
        const trialMessage = !user && remainingTrials !== null && remainingTrials >= 0
          ? `\n\n🎁 무료 체험 ${remainingTrials}회 남았습니다!`
          : '';

        showAlert({
          type: 'success',
          title: 'AI 분석 완료',
          message: `✨ AI 분석이 완료되었습니다!\n아래에서 정보를 확인하고 수정해주세요.${trialMessage}`
        });
      }, 500);

    } catch (error) {
      console.error("분석 실패:", error);
      const errorMessage = error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.";

      // 에러 상태 설정
      setAnalysisError(errorMessage);

      // 분석 실패시 수동 입력 모드로 자동 전환
      setAnalysisResult({
        cafe: "",
        bean: "",
        processing: "",
        flavor: [],
        confidence: 0,
        raw_text: ""
      });

      showAlert({
        type: 'warning',
        title: '자동 분석 실패',
        message: `${errorMessage}\n\n🖋️ 수동 입력 모드로 전환합니다.\n` +
          `아래에서 카페명/원두명/향미를 직접 입력하면 저장은 정상적으로 가능합니다.`
      });

      // 폼으로 스크롤 이동
      setTimeout(() => {
        const formSection = document.querySelector('#coffee-form');
        formSection?.scrollIntoView({ behavior: 'smooth' });
      }, 1000);

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

    // 필수 필드 검증
    if (!user) {
      // 체험 모드: 로컬 저장 후 로그인 유도
      showAlert({
        type: 'warning',
        title: '로그인 후 저장 가능',
        message: '😊 AI 분석 결과가 마음에 드시나요?\n\n로그인하시면 기록을 저장하고\n언제든지 다시 볼 수 있어요!',
        confirmText: '로그인하기',
        showCancel: true,
        cancelText: '나중에',
        onConfirm: () => {
          // 현재 폼 데이터를 로컬 스토리지에 임시 저장
          if (typeof window !== 'undefined') {
            const tempRecord = {
              ...form,
              analysisResult,
              imageUrl: preview,
              createdAt: new Date().toISOString()
            };
            localStorage.setItem('coffee_temp_record', JSON.stringify(tempRecord));
          }
          // TODO: 로그인 페이지로 이동
          router.push('/login');
        },
        onCancel: () => {
          showAlert({
            type: 'info',
            title: '체험 계속하기',
            message: '새로운 사진으로 AI 분석을 계속 체험해보세요! 📸'
          });
        }
      });
      return;
    }

    if (!form.bean?.trim()) {
      setShowValidationHints(true);
      showAlert({
        type: 'error',
        title: '원두명 입력 필요',
        message: '원두명을 입력해주세요.'
      });
      return;
    }

    if (!form.cafe?.trim()) {
      setShowValidationHints(true);
      showAlert({
        type: 'error',
        title: '카페명 입력 필요',
        message: '카페명을 입력해주세요.'
      });
      return;
    }

    // 저신뢰도 결과는 저장 전 재확인(검토 모달)
    if (analysisResult?.confidence !== undefined && analysisResult.confidence < 0.6) {
      const proceed = window.confirm(
        `AI 신뢰도가 ${Math.round(analysisResult.confidence * 100)}%로 낮습니다.\n` +
        `저장 전에 카페/원두/향미를 한 번 더 확인해주세요.\n\n` +
        `확인: 저장 계속 / 취소: 수정하기`
      );
      if (!proceed) return;
    }

    setShowValidationHints(false);

    try {
      setSubmitting(true);

      // undefined 값 제거한 기록 데이터 생성
      const recordData: any = {
        bean: form.bean,
        cafe: form.cafe,
        flavor: form.flavor,
        imageUrl: preview,
        analysisData: analysisResult,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: analysisResult ? 'photo_ai_analysis' : 'photo_manual_input'
      };

      // undefined가 아닌 값만 추가
      if (form.processing) recordData.processing = form.processing;
      if (form.rating) recordData.rating = form.rating;
      if (form.mood) recordData.mood = form.mood;
      if (form.review?.trim()) recordData.review = form.review.trim();

      await addDoc(collection(db, "users", user.uid, "records"), recordData);

      showAlert({
        type: 'success',
        title: '저장 완료',
        message: '🎉 커피 기록이 성공적으로 저장되었어요!\n\n📋 기록을 확인하시겠어요?',
        onConfirm: () => router.push('/history')
      });

      // 폼 초기화
      setForm({
        cafe: "",
        bean: "",
        processing: "",
        flavor: [],
        rating: 0,
        mood: "",
        review: "",
        roasting: "",
        brewMethod: ""
      });
      setImage(null);
      setPreview(null);
      setAnalysisResult(null);

    } catch (error) {
      console.error("저장 실패:", error);
      showAlert({
        type: 'error',
        title: '저장 실패',
        message: '저장에 실패했습니다. 다시 시도해주세요.'
      });
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
    <div className="min-h-screen bg-coffee-dark relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-32 h-32 bg-coffee-gold opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-coffee-gold opacity-5 rounded-full blur-3xl"></div>
      </div>

      <main className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-coffee-light mb-2">
            📸 AI 커피 분석
          </h1>
          <p className="text-coffee-light opacity-70">커피백이나 메뉴판을 촬영해서 AI 분석을 받아보세요</p>
        </motion.div>

        {glmUnavailable && (
          <div className="mb-4 bg-yellow-900/30 border border-yellow-500/40 rounded-xl p-3 text-sm text-yellow-100">
            GLM-OCR 연결이 불안정해 현재는 폴백 엔진(Tesseract + 보조 파서)으로 분석 중입니다.
          </div>
        )}

        {/* Photo Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-coffee p-6 mb-6"
        >
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt="Preview"
                className="w-full max-h-96 object-contain rounded-xl"
              />
              <button
                onClick={() => {
                  setPreview(null);
                  setImage(null);
                  setAnalysisResult(null);
                }}
                className="absolute -top-3 -right-3 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-300"
              >
                <span className="text-lg">✕</span>
              </button>

              {analyzing && (
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="bg-black/70 backdrop-blur-sm rounded-xl p-4 text-white">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="loading-spinner w-6 h-6 rounded-full"></div>
                      <span className="font-semibold">{analysisStep}</span>
                    </div>
                    {ocrProgress > 0 && ocrProgress < 100 && (
                      <div className="w-full bg-white/20 rounded-full h-2">
                        <div
                          className="bg-coffee-gold h-2 rounded-full transition-all duration-300"
                          style={{ width: `${ocrProgress}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-coffee-gold border-opacity-30 rounded-xl p-8 text-center relative">
              {/* 촬영 가이드 프레임 */}
              <div className="relative mx-auto mb-6" style={{ width: '200px', height: '140px' }}>
                <div className="absolute inset-0 border-2 border-coffee-gold border-opacity-50 rounded-lg"></div>
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-coffee-gold"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-coffee-gold"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-coffee-gold"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-coffee-gold"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-4xl text-coffee-gold opacity-70">📸</div>
                </div>
              </div>

              <h3 className="text-xl font-bold text-coffee-light mb-2">사진을 선택해주세요</h3>
              <p className="text-coffee-light opacity-70 text-sm mb-4">
                커피백, 메뉴판, 원두 포장지를 업로드하세요
              </p>

              {/* 촬영 가이드 팁 */}
              <div className="bg-coffee-medium rounded-lg p-4 text-left">
                <h4 className="text-coffee-light font-semibold mb-2 flex items-center gap-2">
                  <span className="text-coffee-gold">💡</span>
                  촬영 가이드
                </h4>
                <ul className="text-coffee-light opacity-70 text-sm space-y-1">
                  <li>• 텍스트가 선명하게 보이도록 촬영하세요</li>
                  <li>• 조명이 충분한 곳에서 촬영하세요</li>
                  <li>• 카메라를 수직으로 정렬하세요</li>
                  <li>• 그림자나 반사가 없도록 주의하세요</li>
                </ul>
              </div>
            </div>
          )}
        </motion.div>

        {/* Photo Selection Buttons */}
        {!preview && (
          <div className="space-y-3 mb-6">
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
              className="btn-primary w-full flex items-center justify-center gap-3 py-4"
              onClick={() => cameraInputRef.current?.click()}
            >
              <span className="text-2xl">📷</span>
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
              className="btn-secondary w-full flex items-center justify-center gap-3 py-4"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="text-2xl">🖼️</span>
              <span>갤러리에서 선택</span>
            </motion.button>
          </div>
        )}

        {/* AI Analysis Button */}
        {preview && !analysisResult && !analyzing && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary w-full flex items-center justify-center gap-3 py-4 mb-6 relative"
            onClick={handleAnalyze}
          >
            <span className="text-2xl">🤖</span>
            <div className="flex flex-col items-center">
              <span>AI 분석 시작하기</span>
              {!user && trialCount < MAX_TRIAL_COUNT && (
                <span className="text-xs opacity-75 mt-1">
                  🎁 무료 체험 {MAX_TRIAL_COUNT - trialCount}회 남음
                </span>
              )}
              {!user && trialCount >= MAX_TRIAL_COUNT && (
                <span className="text-xs opacity-75 mt-1 text-red-200">
                  ⚠️ 로그인 후 무제한 이용
                </span>
              )}
            </div>
          </motion.button>
        )}

        {/* Analysis Progress */}
        {analyzing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-coffee p-8 text-center mb-6"
          >
            <div className="loading-spinner w-16 h-16 rounded-full mx-auto mb-6"></div>
            <h3 className="text-2xl font-bold text-coffee-gold mb-2">AI 분석 진행 중</h3>
            <p className="text-coffee-light opacity-70 text-lg">{analysisStep}</p>
            {ocrProgress > 0 && ocrProgress < 100 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-coffee-light opacity-70 mb-2">
                  <span>진행률</span>
                  <span>{ocrProgress}%</span>
                </div>
                <div className="w-full bg-coffee-medium rounded-full h-3">
                  <div
                    className="bg-coffee-gold h-3 rounded-full transition-all duration-300"
                    style={{ width: `${ocrProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
            <button
              onClick={() => {
                setAnalyzing(false);
                setAnalysisStep("");
                setOcrProgress(0);
                showAlert({
                  type: 'info',
                  title: '분석 취소됨',
                  message: '아래에서 수동으로 입력해주세요.'
                });
              }}
              className="mt-4 px-6 py-2 bg-coffee-medium hover:bg-coffee-light text-coffee-light hover:text-coffee-dark rounded-lg transition-colors text-sm"
            >
              분석 취소
            </button>
          </motion.div>
        )}

        {/* Analysis Results */}
        {analysisResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-coffee p-8 mb-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <span className="text-4xl">✨</span>
                <div>
                  <h3 className="text-2xl font-bold text-coffee-gold">AI 분석 완료!</h3>
                  <p className="text-coffee-light opacity-70">다음 정보를 추출했어요</p>
                  {analysisResult.source && (
                    <p className="text-xs text-coffee-light opacity-50 mt-1">엔진: {analysisResult.source}</p>
                  )}
                </div>
              </div>

              {/* 신뢰도 점수 표시 */}
              {analysisResult.confidence !== undefined && (
                <div className="text-right">
                  <div className="text-sm text-coffee-light opacity-70 mb-1">신뢰도</div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${analysisResult.confidence >= 0.8
                          ? 'bg-green-500'
                          : analysisResult.confidence >= 0.6
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                    />
                    <span className={`font-semibold ${analysisResult.confidence >= 0.8
                        ? 'text-green-500'
                        : analysisResult.confidence >= 0.6
                          ? 'text-yellow-500'
                          : 'text-red-500'
                      }`}>
                      {Math.round(analysisResult.confidence * 100)}%
                    </span>
                  </div>
                  <div className="text-xs text-coffee-light opacity-50 mt-1">
                    {analysisResult.confidence >= 0.8
                      ? '높음'
                      : analysisResult.confidence >= 0.6
                        ? '보통'
                        : '낮음'}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {analysisResult.cafe && (
                <div className="bg-coffee-medium rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">📍</span>
                    <span className="font-semibold text-coffee-light">카페</span>
                  </div>
                  <p className="text-coffee-light opacity-90">{analysisResult.cafe}</p>
                </div>
              )}
              {analysisResult.bean && (
                <div className="bg-coffee-medium rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">☕</span>
                    <span className="font-semibold text-coffee-light">원두</span>
                  </div>
                  <p className="text-coffee-light opacity-90">{analysisResult.bean}</p>
                </div>
              )}
              {analysisResult.processing && (
                <div className="bg-coffee-medium rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">⚙️</span>
                    <span className="font-semibold text-coffee-light">프로세싱</span>
                  </div>
                  <p className="text-coffee-light opacity-90">{analysisResult.processing}</p>
                </div>
              )}
              {analysisResult.flavor && analysisResult.flavor.length > 0 && (
                <div className="bg-coffee-medium rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🌸</span>
                    <span className="font-semibold text-coffee-light">향미</span>
                  </div>
                  <p className="text-coffee-light opacity-90">{analysisResult.flavor.join(', ')}</p>
                </div>
              )}
            </div>

            <p className="text-coffee-light opacity-70 text-center">
              아래에서 정보를 확인하고 수정한 후 저장해보세요!
            </p>
          </motion.div>
        )}

        {/* Manual Input Option */}
        {preview && !analyzing && (
          <div className="text-center mb-6">
            <button
              onClick={() => {
                const formSection = document.querySelector('#coffee-form');
                formSection?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-coffee-gold hover:text-coffee-light underline transition-colors"
            >
              AI 분석 없이 수동으로 입력하기
            </button>
          </div>
        )}

        {/* Coffee Form - AI 분석 완료 후 또는 수동 입력 모드에서 표시 */}
        {(analysisResult || (preview && !analyzing)) && (
          <motion.div
            id="coffee-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card-coffee p-8"
          >
            <h2 className="text-2xl font-bold text-coffee-light mb-6 text-center">
              정보 확인 및 추가 입력
            </h2>

            <form onSubmit={handleFormSubmit} className="space-y-6">
              {/* AI 분석된 정보 표시 */}
              {analyzing && (
                <div className="bg-coffee-medium rounded-lg p-4 mb-6">
                  <h3 className="text-coffee-light font-medium mb-3">AI 분석 중...</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-coffee-medium">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-coffee-gold mr-2"></div>
                      {analysisStep || "이미지를 분석하고 있습니다..."}
                    </div>
                    {ocrProgress > 0 && (
                      <div className="w-full bg-coffee-dark rounded-full h-2">
                        <div
                          className="bg-coffee-gold h-2 rounded-full transition-all duration-300"
                          style={{ width: `${ocrProgress}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {analysisResult && !analyzing && (
                <div className="bg-coffee-medium rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-coffee-light font-medium">AI 분석 결과</h3>
                    <span className="text-xs text-coffee-gold bg-coffee-gold/20 px-2 py-1 rounded">
                      아래에서 수정 가능
                    </span>
                  </div>
                  <div className="space-y-3 text-sm">
                    {analysisResult?.bean && (
                      <div className="bg-coffee-dark/50 p-3 rounded">
                        <div className="flex items-start justify-between">
                          <span className="text-coffee-gold font-medium">원두:</span>
                          <span className="text-coffee-light flex-1 ml-2">{analysisResult.bean}</span>
                        </div>
                      </div>
                    )}
                    {analysisResult?.cafe && (
                      <div className="bg-coffee-dark/50 p-3 rounded">
                        <div className="flex items-start justify-between">
                          <span className="text-coffee-gold font-medium">카페:</span>
                          <span className="text-coffee-light flex-1 ml-2">{analysisResult.cafe}</span>
                        </div>
                      </div>
                    )}
                    {analysisResult?.flavor && analysisResult.flavor.length > 0 && (
                      <div className="bg-coffee-dark/50 p-3 rounded">
                        <div className="flex items-start justify-between">
                          <span className="text-coffee-gold font-medium">향미:</span>
                          <span className="text-coffee-light flex-1 ml-2">{analysisResult.flavor.join(', ')}</span>
                        </div>
                      </div>
                    )}
                    {analysisResult?.processing && (
                      <div className="bg-coffee-dark/50 p-3 rounded">
                        <div className="flex items-start justify-between">
                          <span className="text-coffee-gold font-medium">가공방식:</span>
                          <span className="text-coffee-light flex-1 ml-2">{analysisResult.processing}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-coffee-dark">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-coffee-medium">
                        💡 AI 분석 결과가 정확하지 않다면 아래에서 수정하세요.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const formSection = document.querySelector('#coffee-form');
                          formSection?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="text-xs bg-coffee-gold text-coffee-dark px-3 py-1 rounded-full hover:bg-yellow-400 transition-colors"
                      >
                        수정하러 가기 ↓
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {analysisError && !analyzing && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 mb-6">
                  <h3 className="text-red-300 font-medium mb-3">분석 실패</h3>
                  <p className="text-red-200 text-sm mb-3">
                    {analysisError}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAnalysisError("");
                      // 재분석 로직이 있다면 여기에 추가
                    }}
                    className="text-coffee-gold hover:text-yellow-300 text-sm underline"
                  >
                    다시 시도
                  </button>
                </div>
              )}

              {!analyzing && !analysisResult && image && !analysisError && (
                <div className="bg-coffee-medium rounded-lg p-4 mb-6">
                  <h3 className="text-coffee-light font-medium mb-3">AI 분석 필요</h3>
                  <p className="text-coffee-medium text-sm">
                    이미지를 업로드했습니다. 원두 정보를 자동으로 분석하려면 분석 버튼을 클릭하세요.
                  </p>
                </div>
              )}

              {/* 추가 입력 필드들 */}

              {/* 카페명 (항상 편집 가능) */}
              <div className="relative">
                {analysisResult?.cafe && (
                  <div className="mb-2 p-2 bg-green-900/30 border border-green-500/30 rounded-lg">
                    <span className="text-xs text-green-300">✨ AI 분석: </span>
                    <span className="text-green-200 font-medium">{analysisResult.cafe}</span>
                    <span className="text-xs text-green-300 ml-2">(아래에서 수정 가능)</span>
                  </div>
                )}
                <div className="relative">
                  <label className="block text-coffee-light font-medium mb-2">
                    카페명 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.cafe}
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, cafe: e.target.value }));
                      setShowCafeSuggestions(e.target.value.length > 0 && cafeSuggestions.length > 0);
                    }}
                    onFocus={() => setShowCafeSuggestions(form.cafe.length === 0 && cafeSuggestions.length > 0)}
                    onBlur={() => setTimeout(() => setShowCafeSuggestions(false), 200)}
                    placeholder="카페 이름을 입력하세요"
                    className={`input-coffee w-full ${showValidationHints && !form.cafe?.trim() ? 'border-2 border-red-400 bg-red-900/20' : ''}`}
                    required
                  />
                  {showValidationHints && !form.cafe?.trim() && (
                    <p className="text-xs text-red-300 mt-1">카페명을 입력해주세요.</p>
                  )}

                  {/* 자동완성 드롭다운 */}
                  {showCafeSuggestions && (
                    <div className="absolute z-10 w-full mt-1 bg-coffee-dark border border-coffee-medium rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {cafeSuggestions
                        .filter(cafe =>
                          form.cafe.length === 0 ||
                          cafe.toLowerCase().includes(form.cafe.toLowerCase())
                        )
                        .map((cafe, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              setForm(prev => ({ ...prev, cafe }));
                              setShowCafeSuggestions(false);
                            }}
                            className="w-full text-left px-4 py-3 text-coffee-light hover:bg-coffee-medium transition-colors flex items-center gap-3"
                          >
                            <span className="text-coffee-gold">☕</span>
                            <span>{cafe}</span>
                          </button>
                        ))
                      }
                      {form.cafe.length === 0 && cafeSuggestions.length > 0 && (
                        <div className="px-4 py-2 text-coffee-light opacity-50 text-sm border-b border-coffee-medium">
                          자주 방문하는 카페
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 원두명 (항상 편집 가능) */}
              <div>
                {analysisResult?.bean && (
                  <div className="mb-2 p-2 bg-green-900/30 border border-green-500/30 rounded-lg">
                    <span className="text-xs text-green-300">✨ AI 분석: </span>
                    <span className="text-green-200 font-medium">{analysisResult.bean}</span>
                    <span className="text-xs text-green-300 ml-2">(아래에서 수정 가능)</span>
                  </div>
                )}
                <label className="block text-coffee-light font-medium mb-2">
                  원두명 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.bean}
                  onChange={(e) => setForm(prev => ({ ...prev, bean: e.target.value }))}
                  placeholder="원두 이름을 입력하세요"
                  className={`input-coffee w-full ${showValidationHints && !form.bean?.trim() ? 'border-2 border-red-400 bg-red-900/20' : ''}`}
                  required
                />
                {showValidationHints && !form.bean?.trim() && (
                  <p className="text-xs text-red-300 mt-1">원두명을 입력해주세요.</p>
                )}
              </div>

              {/* 가공방식 (항상 편집 가능) */}
              <div>
                {analysisResult?.processing && (
                  <div className="mb-2 p-2 bg-green-900/30 border border-green-500/30 rounded-lg">
                    <span className="text-xs text-green-300">✨ AI 분석: </span>
                    <span className="text-green-200 font-medium">{analysisResult.processing}</span>
                    <span className="text-xs text-green-300 ml-2">(아래에서 수정 가능)</span>
                  </div>
                )}
                <label className="block text-coffee-light font-medium mb-2">가공방식</label>
                <select
                  value={form.processing}
                  onChange={(e) => setForm(prev => ({ ...prev, processing: e.target.value }))}
                  className="input-coffee w-full"
                >
                  <option value="">선택하세요</option>
                  {PROCESSING_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              {/* 로스팅 단계 */}
              <div>
                <label className="block text-coffee-light font-medium mb-2">로스팅 단계</label>
                <select
                  value={form.roasting || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, roasting: e.target.value }))}
                  className="input-coffee w-full"
                >
                  <option value="">선택하세요</option>
                  <option value="Light">Light (라이트)</option>
                  <option value="Medium-Light">Medium-Light (미디엄 라이트)</option>
                  <option value="Medium">Medium (미디엄)</option>
                  <option value="Medium-Dark">Medium-Dark (미디엄 다크)</option>
                  <option value="Dark">Dark (다크)</option>
                  <option value="French">French (프렌치)</option>
                </select>
              </div>

              {/* 추출 방식 */}
              <div>
                <label className="block text-coffee-light font-medium mb-2">추출 방식</label>
                <select
                  value={form.brewMethod || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, brewMethod: e.target.value }))}
                  className="input-coffee w-full"
                >
                  <option value="">선택하세요</option>
                  <option value="Espresso">에스프레소</option>
                  <option value="Americano">아메리카노</option>
                  <option value="Drip">드립커피</option>
                  <option value="French Press">프렌치 프레스</option>
                  <option value="V60">V60</option>
                  <option value="Chemex">케멕스</option>
                  <option value="Aeropress">에어로프레스</option>
                  <option value="Cold Brew">콜드브루</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              {/* 평점 */}
              {!form.rating && (
                <div>
                  <label className="block text-coffee-light font-medium mb-2">평점을 추가해주세요</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, rating: star }))}
                        className={`text-3xl transition-colors ${star <= form.rating ? 'text-coffee-gold' : 'text-coffee-light opacity-30'
                          }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 향미 입력 (AI 분석 결과 포함) */}
              <div>
                {analysisResult?.flavor && analysisResult.flavor.length > 0 && (
                  <div className="mb-2 p-2 bg-green-900/30 border border-green-500/30 rounded-lg">
                    <span className="text-xs text-green-300">✨ AI 분석: </span>
                    <span className="text-green-200 font-medium">{analysisResult.flavor.join(', ')}</span>
                    <span className="text-xs text-green-300 ml-2">(아래에서 수정 가능)</span>
                  </div>
                )}
                <label className="block text-coffee-light font-medium mb-2">향미</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {form.flavor.map((flavor) => (
                    <span
                      key={flavor}
                      className="bg-coffee-gold text-coffee-dark px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2"
                    >
                      {flavor}
                      <button
                        type="button"
                        onClick={() => removeFlavor(flavor)}
                        className="text-coffee-dark hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.values(FLAVOR_CATEGORIES).flatMap(category => category.items)
                    .filter(flavor => !form.flavor.includes(flavor))
                    .slice(0, 12)
                    .map((flavor) => (
                      <button
                        key={flavor}
                        type="button"
                        onClick={() => addFlavor(flavor)}
                        className="px-3 py-1 rounded-full text-sm transition-colors bg-coffee-medium text-coffee-light hover:bg-coffee-gold hover:text-coffee-dark"
                      >
                        {flavor}
                      </button>
                    ))}
                </div>
              </div>

              {/* 리뷰 */}
              <div>
                <label className="block text-coffee-light font-medium mb-2">리뷰 (선택사항)</label>
                <textarea
                  value={form.review}
                  onChange={(e) => setForm(prev => ({ ...prev, review: e.target.value }))}
                  placeholder="커피에 대한 감상을 적어보세요"
                  rows={3}
                  className="input-coffee w-full resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={!form.bean || !form.cafe || submitting}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {submitting ? "저장 중..." : "저장하기"}
                </button>
                {analysisResult && (
                  <button
                    type="button"
                    onClick={() => {
                      // 분석 결과 섹션으로 스크롤
                      const analysisSection = document.querySelector('.card-coffee:has(.text-coffee-gold)');
                      analysisSection?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="btn-secondary px-6"
                  >
                    분석 결과 보기
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        )}
      </main>

      <AlertComponent />
    </div>
  );
} 