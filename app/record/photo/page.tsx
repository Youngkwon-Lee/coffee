"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection } from "firebase/firestore";
import { db, auth } from "@/firebase";

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
      setActiveStep(2); // 즉시 2단계로 이동
      setChat(prev => [
        ...prev,
        { type: "user", text: `${method}으로 사진을 선택했습니다!` },
        { type: "bot", text: "좋아요! 이제 OCR 분석을 진행해주세요.", imageUrl: URL.createObjectURL(file) }
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
      const rawText = data.raw_text || "";
      const rawTextLower = rawText.toLowerCase();
      
      // 향미 카테고리 정의
      const allFlavorOptions = [
        "Citrus", "Berry-like", "Winey", "Floral", "Fruity",
        "Nutty", "Malty", "Candy-like", "Syrup-like", "Chocolate-like", "Vanilla-like", "Caramel",
        "Herby", "Spicy", "Resinous", "Medicinal",
        "Sour", "Acidic", "Tart",
        "Bitter", "Mellow", "Sweet", "Earthy", "Smoky", "Astringent"
      ];
      
      // 한국어 향미 매핑 (기본)
      const koreanFlavorMap: { [key: string]: string[] } = {
        "블러드 오렌지": ["Citrus", "Fruity"],
        "오렌지": ["Citrus", "Fruity"],
        "넥타린": ["Fruity", "Sweet"],
        "그린티": ["Herby", "Floral"],
        "녹차": ["Herby", "Floral"],
        "달콤함": ["Sweet", "Candy-like"],
        "달콤한": ["Sweet", "Candy-like"],
        "복합적인": ["Fruity", "Sweet"],
        "플로럴": ["Floral"],
        "베리": ["Berry-like"],
        "시트러스": ["Citrus"],
        "초콜릿": ["Chocolate-like"],
        "바닐라": ["Vanilla-like"],
        "카라멜": ["Caramel"],
        "견과류": ["Nutty"],
        "견과": ["Nutty"],
        "스파이시": ["Spicy"],
        "허브": ["Herby"],
        "와인": ["Winey"],
        "산미": ["Acidic", "Tart"],
        "쓴맛": ["Bitter"],
        "부드러운": ["Mellow"],
        "스모키": ["Smoky"],
        "꽃향기": ["Floral"],
        "과일향": ["Fruity"],
        "레몬": ["Citrus"],
        "라임": ["Citrus"],
        "자몽": ["Citrus"],
        "사과": ["Fruity"],
        "배": ["Fruity"],
        "복숭아": ["Fruity"],
        "체리": ["Berry-like"],
        "딸기": ["Berry-like"],
        "블루베리": ["Berry-like"],
        "건포도": ["Fruity", "Sweet"],
        "아몬드": ["Nutty"],
        "헤이즐넛": ["Nutty"],
        "호두": ["Nutty"],
        "피칸": ["Nutty"],
        "꿀": ["Sweet", "Syrup-like"],
        "메이플": ["Sweet", "Syrup-like"],
        "캔디": ["Candy-like"],
        "사탕": ["Candy-like"],
        "시나몬": ["Spicy"],
        "정향": ["Spicy"],
        "계피": ["Spicy"],
        "생강": ["Spicy"],
        "후추": ["Spicy"],
        "흙": ["Earthy"],
        "토양": ["Earthy"],
        "연기": ["Smoky"],
        "탄": ["Smoky"],
        "로스팅": ["Smoky"]
      };
      
      // 기본 매핑으로 향미 추출
      let extractedFlavors: string[] = [];
      const matchedKoreanFlavors: string[] = [];
      
      for (const [korean, englishFlavors] of Object.entries(koreanFlavorMap)) {
        if (rawText.includes(korean)) {
          extractedFlavors.push(...englishFlavors);
          matchedKoreanFlavors.push(korean);
        }
      }
      
      // 기존 매핑에 없는 향미가 있는지 확인하고 GPT API로 추가 처리
      const unmappedText = rawText;
      if (unmappedText && extractedFlavors.length < 3) { // 추출된 향미가 적으면 GPT 사용
        try {
          // 먼저 학습된 데이터 확인
          const learnedRes = await fetch(`/api/learn-update?type=flavor&query=${encodeURIComponent(rawText)}`);
          
          if (learnedRes.ok) {
            const learnedData = await learnedRes.json();
            if (learnedData.found && learnedData.mapped) {
              const learnedFlavors = Array.isArray(learnedData.mapped) ? learnedData.mapped : [learnedData.mapped];
              extractedFlavors.push(...learnedFlavors);
              setChat(prev => [...prev, { type: "bot", text: `🧠 학습된 데이터로 향미를 찾았어요: ${learnedFlavors.join(', ')} (사용횟수: ${learnedData.count}회)` }]);
            } else {
              // 학습된 데이터가 없으면 GPT 사용
              const gptRes = await fetch("/api/gpt-flavor-mapping", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  text: rawText,
                  availableFlavors: allFlavorOptions,
                  existingFlavors: extractedFlavors
                }),
              });
              
              if (gptRes.ok) {
                const gptData = await gptRes.json();
                if (gptData.flavors && Array.isArray(gptData.flavors) && gptData.flavors.length > 0) {
                  extractedFlavors.push(...gptData.flavors);
                  setChat(prev => [...prev, { type: "bot", text: `🤖 AI가 추가 향미를 분석했어요: ${gptData.flavors.join(', ')}` }]);
                  
                  // 새로운 매핑을 학습 데이터에 저장
                  fetch("/api/learn-update", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      type: 'flavor',
                      original: rawText,
                      mapped: gptData.flavors,
                      confidence: 0.8,
                      userId: auth.currentUser?.uid
                    })
                  }).catch(err => console.log("학습 저장 실패:", err));
                }
              }
            }
          }
        } catch (error) {
          console.log("학습 확인 및 GPT 향미 매핑 실패, 기본 매핑만 사용:", error);
        }
      }
      
      // 중복 제거 및 정렬
      extractedFlavors = [...new Set(extractedFlavors)];
      
      // 원두명 확장된 매칭 로직
      const specificBeans = [
        // 에티오피아 원두들 - 다양한 표기법 포함
        { patterns: ["Ethiopia Benti Korbo", "에티오피아 벤티 코르보", "ETHIOPIA BENTI KORBO", "benti korbo", "벤티 코르보", "벤티코르보"], name: "Ethiopia Benti Korbo" },
        { patterns: ["Ethiopia Chelbesa", "에티오피아 첼베사", "chelbesa", "첼베사"], name: "Ethiopia Chelbesa" },
        { patterns: ["Ethiopia Aricha", "에티오피아 아리차", "aricha", "아리차"], name: "Ethiopia Aricha" },
        { patterns: ["Ethiopia Uraga", "에티오피아 우라가", "uraga", "우라가"], name: "Ethiopia Uraga" },
        { patterns: ["Ethiopia Shakiso", "에티오피아 샤키소", "shakiso", "샤키소"], name: "Ethiopia Shakiso" },
        { patterns: ["Ethiopia Yirgacheffe", "에티오피아 예가체프", "yirgacheffe", "예가체프"], name: "Ethiopia Yirgacheffe" },
        { patterns: ["Ethiopia Hambela", "에티오피아 함벨라", "hambela", "함벨라"], name: "Ethiopia Hambela" },
        { patterns: ["Ethiopia Adado", "에티오피아 아다도", "adado", "아다도"], name: "Ethiopia Adado" },
        
        // 콜롬비아 원두들
        { patterns: ["Colombia El Paraiso", "콜롬비아 엘 파라이소", "el paraiso", "엘 파라이소"], name: "Colombia El Paraiso" },
        { patterns: ["Colombia La Palma y El Tucan", "콜롬비아 라 팔마", "la palma", "라 팔마"], name: "Colombia La Palma y El Tucan" },
        { patterns: ["Colombia Las Flores", "콜롬비아 라스 플로레스", "las flores", "라스 플로레스"], name: "Colombia Las Flores" },
        { patterns: ["Colombia La Esperanza", "콜롬비아 라 에스페란사", "la esperanza", "라 에스페란사"], name: "Colombia La Esperanza" },
        { patterns: ["Colombia La Cristalina", "콜롬비아 라 크리스탈리나", "la cristalina", "라 크리스탈리나"], name: "Colombia La Cristalina" },
        
        // 파나마 원두들
        { patterns: ["Panama Elida Estate", "파나마 엘리다", "elida estate", "엘리다"], name: "Panama Elida Estate" },
        { patterns: ["Panama Esmeralda Jaramillo", "파나마 에스메랄다", "esmeralda jaramillo", "에스메랄다"], name: "Panama Esmeralda Jaramillo" },
        { patterns: ["Panama Hartmann Estate", "파나마 하트만", "hartmann estate", "하트만"], name: "Panama Hartmann Estate" },
        
        // 케냐 원두들
        { patterns: ["Kenya Karimikui", "케냐 카리미쿠이", "karimikui", "카리미쿠이"], name: "Kenya Karimikui" },
        { patterns: ["Kenya Gakuyuini", "케냐 가쿠유이니", "gakuyuini", "가쿠유이니"], name: "Kenya Gakuyuini" },
        { patterns: ["Kenya Kiamabara", "케냐 키아마바라", "kiamabara", "키아마바라"], name: "Kenya Kiamabara" },
        
        // 과테말라 원두들
        { patterns: ["Guatemala El Injerto", "과테말라 엘 인헤르토", "el injerto", "엘 인헤르토"], name: "Guatemala El Injerto" },
        { patterns: ["Guatemala La Esperanza", "과테말라 라 에스페란사", "guatemala la esperanza"], name: "Guatemala La Esperanza" },
        
        // 기타 원두들
        { patterns: ["Honduras Santa Barbara", "온두라스 산타 바바라", "santa barbara", "산타 바바라"], name: "Honduras Santa Barbara" },
        { patterns: ["Costa Rica Las Lajas", "코스타리카 라스 라하스", "las lajas", "라스 라하스"], name: "Costa Rica Las Lajas" },
        { patterns: ["Costa Rica Don Mayo", "코스타리카 돈 마요", "don mayo", "돈 마요"], name: "Costa Rica Don Mayo" },
        { patterns: ["El Salvador Los Pirineos", "엘살바도르 로스 피리네오스", "los pirineos", "로스 피리네오스"], name: "El Salvador Los Pirineos" },
        { patterns: ["Rwanda Bumbogo", "르완다 붐보고", "bumbogo", "붐보고"], name: "Rwanda Bumbogo" },
        { patterns: ["Rwanda Gitesi", "르완다 기테시", "gitesi", "기테시"], name: "Rwanda Gitesi" },
        { patterns: ["Burundi Ninga", "부룬디 닝가", "ninga", "닝가"], name: "Burundi Ninga" },
        { patterns: ["Indonesia Wahana Estate", "인도네시아 와하나", "wahana estate", "와하나"], name: "Indonesia Wahana Estate" },
        { patterns: ["Yemen Haraaz", "예멘 하라즈", "haraaz", "하라즈"], name: "Yemen Haraaz" }
      ];
      
      // OCR 텍스트에서 특정 원두명 검색 (먼저 학습된 데이터 확인)
      let foundBean = "";
      
      try {
        const beanLearnedRes = await fetch(`/api/learn-update?type=bean&query=${encodeURIComponent(rawText)}`);
        if (beanLearnedRes.ok) {
          const beanLearnedData = await beanLearnedRes.json();
          if (beanLearnedData.found && beanLearnedData.mapped) {
            foundBean = typeof beanLearnedData.mapped === 'string' ? beanLearnedData.mapped : beanLearnedData.mapped[0];
            setChat(prev => [...prev, { type: "bot", text: `🧠 학습된 원두명 발견: ${foundBean}` }]);
          }
        }
      } catch (error) {
        console.log("학습된 원두명 조회 실패:", error);
      }
      
      // 학습된 데이터에서 찾지 못했으면 기존 매핑 사용
      if (!foundBean) {
        for (const bean of specificBeans) {
          for (const pattern of bean.patterns) {
            if (rawTextLower.includes(pattern.toLowerCase()) || rawText.includes(pattern)) {
              foundBean = bean.name;
        
              // 새로운 매핑을 학습 데이터에 저장
              fetch("/api/learn-update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: 'bean',
                  original: rawText,
                  mapped: bean.name,
                  confidence: 0.9,
                  userId: auth.currentUser?.uid
                })
              }).catch(err => console.log("원두 학습 저장 실패:", err));
              
          break;
        }
          }
          if (foundBean) break;
        }
      }
      
      if (foundBean) {
        data.bean = foundBean;
      }
      
      // 향미 정보 추가
      if (extractedFlavors.length > 0) {
        data.flavor = extractedFlavors;
      }
      
      // 카페명 신뢰도 확인 및 학습
      let finalCafeName = data.cafe;
      
      if (data.cafe) {
        // 학습된 카페명 확인
        try {
          const cafeLearnedRes = await fetch(`/api/learn-update?type=cafe&query=${encodeURIComponent(rawText)}`);
          if (cafeLearnedRes.ok) {
            const cafeLearnedData = await cafeLearnedRes.json();
            if (cafeLearnedData.found && cafeLearnedData.mapped) {
              finalCafeName = typeof cafeLearnedData.mapped === 'string' ? cafeLearnedData.mapped : cafeLearnedData.mapped[0];
              setChat(prev => [...prev, { type: "bot", text: `🧠 학습된 카페명 발견: ${finalCafeName}` }]);
            } else {
              // 기존 카페명 신뢰도 확인
      if (data.cafe === "Fritz Coffee Company" && !rawTextLower.includes("fritz")) {
                finalCafeName = ""; // 카페명 정보 제거
              } else {
                // 새로운 카페명을 학습 데이터에 저장
                fetch("/api/learn-update", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    type: 'cafe',
                    original: rawText,
                    mapped: data.cafe,
                    confidence: 0.8,
                    userId: auth.currentUser?.uid
                  })
                }).catch(err => console.log("카페 학습 저장 실패:", err));
              }
            }
          }
        } catch (error) {
          console.log("학습된 카페명 조회 실패:", error);
          // 기존 로직 유지
          if (data.cafe === "Fritz Coffee Company" && !rawTextLower.includes("fritz")) {
            finalCafeName = "";
          }
        }
      }
      
      // 카페명 정보 업데이트
      if (finalCafeName !== data.cafe) {
        data.cafe = finalCafeName;
      }
      
      setOcrResult(data);
      setActiveStep(3); // 폼 작성 단계로 이동
      
      // 폼에 OCR 결과 자동 입력
      if (data.bean) {
        setForm(f => ({ ...f, bean: data.bean }));
      }
      if (data.cafe) {
        setForm(f => ({ ...f, cafe: data.cafe }));
      }
      if (data.processing) {
        setForm(f => ({ ...f, processing: data.processing }));
      }
      if (extractedFlavors.length > 0) {
        setForm(f => ({ ...f, flavor: extractedFlavors }));
        // 기타 향미 필드에도 원본 한국어 텍스트에서 추출된 향미 표시
        if (matchedKoreanFlavors.length > 0) {
          setForm(f => ({ ...f, otherFlavors: matchedKoreanFlavors.join(', ') }));
        }
      }
      
      // OCR 결과(raw_text)와 매칭 결과를 모두 챗봇에 표시
      let resultMsg = `분석 결과가 나왔어요!`;
      if (data.bean || data.cafe || data.processing || extractedFlavors.length > 0) {
        resultMsg += data.cafe ? `\n카페명: ${data.cafe}` : `\n카페명: (인식 실패)`;
        resultMsg += data.bean ? `\n원두명: ${data.bean}` : `\n원두명: (인식 실패)`;
        if (data.processing) {
          resultMsg += `\n프로세싱: ${data.processing}`;
        }
        if (extractedFlavors.length > 0) {
          resultMsg += `\n향미: ${extractedFlavors.join(', ')}`;
        }
        
        // 향미가 한국어로 인식된 경우 안내 추가
        if (matchedKoreanFlavors.length > 0) {
          resultMsg += `\n\n[원본 향미 설명]\n${matchedKoreanFlavors.join(', ')}`;
        }
        
        setChat(prev => [
          ...prev,
          { type: "bot", text: resultMsg },
          { type: "bot", text: "정보가 자동으로 입력되었습니다! 아래에서 확인하고 수정해 주세요." }
        ]);
      } else {
        resultMsg += `\n원두명/카페명을 찾지 못했어요.`;
        resultMsg += `\n\n[추출된 텍스트]\n${rawText ? rawText.trim() : "(없음)"}`;
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
      if (!auth.currentUser) {
        throw new Error("로그인이 필요합니다.");
      }

      // 향미 목록에 기타 향미 추가 (콤마로 구분된 항목을 분리하여 추가)
      const otherFlavorsArray = form.otherFlavors
        .split(',')
        .map(f => f.trim())
        .filter(f => f.length > 0);
      
      const formData = {
        ...form,
        allFlavors: [...form.flavor, ...otherFlavorsArray],
        createdAt: new Date().toISOString(),
        userId: auth.currentUser.uid
      };
      
      // Firebase에 저장
      await addDoc(collection(db, `users/${auth.currentUser.uid}/records`), formData);
      
      // 성공 메시지 추가
      setChat(prev => [
        ...prev,
        { type: "bot", text: "커피 기록이 성공적으로 저장되었습니다! 😊" }
      ]);
      
      setFormSubmitted(true);
      
      // 3초 후 홈페이지로 이동
      setTimeout(() => {
        router.push('/');
      }, 3000);
      
    } catch (error) {
      console.error('폼 제출 오류:', error);
      
      // 오류 메시지 추가
      setChat(prev => [
        ...prev,
        { type: "bot", text: error instanceof Error ? error.message : "저장 중 오류가 발생했습니다. 다시 시도해주세요." }
      ]);
      
    } finally {
      setSubmitting(false);
    }
  };

  // 설문 폼 렌더링 (순서 변경 및 필드 추가)
  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-coffee-50 to-cream-100 pt-20 pb-20">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-brown-800 mb-4">
            📷 사진으로 기록하기
          </h1>
          <p className="text-brown-600">AI 어시스턴트와 대화하며 커피 기록을 남겨보세요</p>
        </div>

      {/* 진행 단계 표시 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-6 mb-6">
        <div className="flex items-center justify-between">
            <div className={`flex-1 text-center ${activeStep >= 1 ? 'text-coffee-600' : 'text-brown-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-medium ${activeStep >= 1 ? 'bg-coffee-500 text-white' : 'bg-cream-200 text-brown-400'}`}>1</div>
              <p className="text-xs font-medium">사진</p>
          </div>
            <div className={`w-12 h-1 mx-2 rounded-full ${activeStep >= 2 ? 'bg-coffee-500' : 'bg-cream-200'}`}></div>
            <div className={`flex-1 text-center ${activeStep >= 2 ? 'text-coffee-600' : 'text-brown-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-medium ${activeStep >= 2 ? 'bg-coffee-500 text-white' : 'bg-cream-200 text-brown-400'}`}>2</div>
              <p className="text-xs font-medium">분석</p>
          </div>
            <div className={`w-12 h-1 mx-2 rounded-full ${activeStep >= 3 ? 'bg-coffee-500' : 'bg-cream-200'}`}></div>
            <div className={`flex-1 text-center ${activeStep >= 3 ? 'text-coffee-600' : 'text-brown-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-medium ${activeStep >= 3 ? 'bg-coffee-500 text-white' : 'bg-cream-200 text-brown-400'}`}>3</div>
              <p className="text-xs font-medium">완료</p>
          </div>
        </div>
      </div>

        {/* AI 어시스턴트 메인 채팅 영역 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-card shadow-card border border-white/50 p-6">
          <h2 className="text-lg font-display font-bold text-brown-800 mb-4">💬 AI 어시스턴트</h2>
          
          <div className="flex flex-col gap-3 h-[600px] overflow-y-auto p-4 bg-coffee-50 rounded-card border border-coffee-100 mb-4">
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
            {msg.imageUrl && (
                    <div className="mt-3 relative inline-block">
                      <img 
                        src={msg.imageUrl} 
                        alt="업로드된 사진" 
                        className="w-48 h-32 object-cover rounded-lg border border-coffee-200" 
                      />
                      <button 
                        onClick={() => {
                          setPreview(null);
                          setImage(null);
                          setActiveStep(1);
                          setOcrResult(null);
                          setChat(prev => [
                            ...prev.filter((_, i) => i !== idx),
                            { type: "bot", text: "사진이 삭제되었습니다. 새로운 사진을 업로드해주세요." }
                          ]);
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors duration-200 text-xs"
                        aria-label="사진 삭제"
                      >
                        ✕
                      </button>
                    </div>
            )}
                </div>
          </div>
        ))}
      </div>
      
          {/* 사진 선택 버튼들 (처음에만 표시) */}
          {!preview && !formSubmitted && activeStep === 1 && (
            <div className="flex flex-col gap-3 mb-4">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            onChange={e => handleFileChange(e, "촬영")}
            className="hidden"
          />
          <button
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-button font-medium shadow-lg hover:shadow-hover transition-all duration-200"
            onClick={() => {
              setChat(prev => [
                ...prev,
                { type: "bot", text: "촬영을 위해 카메라 권한이 필요할 수 있습니다. 허용을 눌러주세요!" }
              ]);
              cameraInputRef.current?.click();
            }}
          >
                <span className="text-2xl">📷</span> 
                <span>카메라로 촬영</span>
          </button>
          
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={e => handleFileChange(e, "업로드")}
            className="hidden"
          />
          <button
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-brown-500 to-brown-600 text-white rounded-button font-medium shadow-lg hover:shadow-hover transition-all duration-200"
            onClick={() => fileInputRef.current?.click()}
          >
                <span className="text-2xl">🖼️</span> 
                <span>갤러리에서 선택</span>
          </button>
        </div>
      )}
      
      {/* OCR 분석 버튼 */}
          {preview && !ocrResult && activeStep <= 2 && (
            <div className="mb-4">
        <button
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-coffee-600 to-brown-600 text-white rounded-button font-medium shadow-lg hover:shadow-hover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleAnalyze}
          disabled={loading || !image}
        >
          {loading ? (
            <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
                    <span>AI가 분석 중...</span>
            </>
          ) : (
                  <>
                    <span className="text-xl">🤖</span>
                    <span>OCR 분석하기</span>
                  </>
              )}
            </button>
          </div>
          )}

          {/* 폼 입력 영역 (채팅 스타일) */}
          {ocrResult && !formSubmitted && activeStep === 3 && (
            <form ref={formRef} onSubmit={handleFormSubmit} className="space-y-4">
              {/* 기본 정보 */}
              <div className="space-y-3">
                <div className="p-4 bg-coffee-50 rounded-card border border-coffee-200">
                  <label className="block text-sm font-medium text-brown-700 mb-2">
                    카페명 (카페/브랜드) <span className="text-red-500">*</span>
              </label>
              <input 
                    className="w-full px-4 py-3 border border-coffee-200 rounded-button bg-white text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400 focus:border-transparent transition-all duration-200" 
                value={form.cafe} 
                onChange={e => handleFormChange("cafe", e.target.value)} 
                    placeholder="카페명을 입력하세요"
                required
              />
            </div>
            
                <div className="p-4 bg-coffee-50 rounded-card border border-coffee-200">
                  <label className="block text-sm font-medium text-brown-700 mb-2">
                    원두명 <span className="text-red-500">*</span>
              </label>
              <input 
                    className="w-full px-4 py-3 border border-coffee-200 rounded-button bg-white text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400 focus:border-transparent transition-all duration-200" 
                value={form.bean} 
                onChange={e => handleFormChange("bean", e.target.value)} 
                    placeholder="원두명을 입력하세요"
                required
              />
          </div>
          
                <div className="p-4 bg-coffee-50 rounded-card border border-coffee-200">
                  <label className="block text-sm font-medium text-brown-700 mb-3">프로세싱</label>
                  <div className="flex flex-wrap gap-2">
              {PROCESSING_OPTIONS.map(process => (
                <button
                  key={process}
                  type="button"
                        className={`px-4 py-2 rounded-button border transition-all duration-200 text-sm font-medium ${
                          form.processing === process 
                            ? "bg-coffee-500 text-white border-coffee-500 shadow-lg" 
                            : "bg-white text-brown-700 border-coffee-200 hover:bg-coffee-50"
                        }`}
                  onClick={() => handleFormChange("processing", process)}
                >
                  {process}
                </button>
              ))}
            </div>
          </div>
          
                <div className="p-4 bg-coffee-50 rounded-card border border-coffee-200">
                  <label className="block text-sm font-medium text-brown-700 mb-3">향미 (여러 개 선택 가능)</label>
            
                  {/* 선택된 향미 표시 */}
            {form.flavor.length > 0 && (
                    <div className="mb-4 p-3 bg-white rounded-card border border-coffee-100">
                      <p className="text-sm font-medium text-brown-800 mb-2">선택된 향미:</p>
                <div className="flex flex-wrap gap-2">
                  {form.flavor.map(flavor => (
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
                  <div className="space-y-2">
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
                                  form.flavor.includes(flavor) 
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
              
              {/* 기타 향미 직접 입력 */}
                    <div className="pt-2 border-t border-coffee-200">
                      <label className="block text-sm font-medium text-brown-700 mb-2">기타 향미 직접 입력</label>
                <div className="relative">
                  <input 
                          className="w-full px-4 py-2 pr-12 border border-coffee-200 rounded-button bg-white text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400 focus:border-transparent transition-all duration-200 text-sm" 
                    value={form.otherFlavors} 
                    placeholder="OCR에서 추출된 향미 또는 직접 입력 (콤마로 구분)"
                    onChange={e => handleFormChange("otherFlavors", e.target.value)} 
                  />
                  <button 
                    type="button" 
                    onClick={() => startSTT("flavor")} 
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-coffee-500 hover:text-coffee-600 transition-colors duration-200"
                          aria-label="음성 입력"
                  >
                          🎤
                  </button>
                </div>
                      {sttResult.flavor && <p className="text-xs text-brown-500 mt-1">{sttResult.flavor}</p>}
              </div>
            </div>
          </div>
          
                <div className="p-4 bg-coffee-50 rounded-card border border-coffee-200">
                  <label className="block text-sm font-medium text-brown-700 mb-3">평점</label>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  type="button"
                          className={`text-2xl transition-all duration-200 hover:scale-110 ${
                            form.rating >= n ? "text-coffee-400" : "text-brown-300"
                          }`}
                  onClick={() => handleRating(n)}
                  aria-label={`${n}점`}
                >
                          ⭐
                </button>
              ))}
                    </div>
                    <span className="text-sm font-medium text-brown-700">
                      {form.rating ? `${form.rating}점` : "별점 선택"}
                    </span>
            </div>
          </div>
          
                <div className="p-4 bg-coffee-50 rounded-card border border-coffee-200">
                  <label className="block text-sm font-medium text-brown-700 mb-3">오늘의 기분</label>
            
            {/* 기분 옵션 */}
                  <div className="flex flex-wrap gap-2 mb-4">
              {MOOD_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  type="button"
                        className={`flex items-center gap-2 px-3 py-2 rounded-button border transition-all duration-200 text-sm ${
                          form.mood === opt.emoji + ' ' + opt.label 
                            ? "bg-coffee-500 text-white border-coffee-500 shadow-lg" 
                            : "bg-white text-brown-700 border-coffee-200 hover:bg-coffee-50"
                        }`}
                  onClick={() => handleFormChange("mood", opt.emoji + ' ' + opt.label)}
                >
                        <span>{opt.emoji}</span>
                        <span className="font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
            
                  {/* 한줄평 입력 */}
                  <div>
                    <label className="block text-sm font-medium text-brown-700 mb-2">한줄평</label>
            <div className="relative">
                      <textarea 
                        className="w-full px-4 py-3 pr-12 border border-coffee-200 rounded-button bg-white text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400 focus:border-transparent transition-all duration-200 resize-none text-sm"
                        rows={2}
                value={form.review} 
                onChange={e => handleFormChange("review", e.target.value)} 
                        placeholder="오늘 마신 커피에 대한 소감을 자유롭게 남겨보세요"
              />
              <button 
                type="button" 
                onClick={() => startSTT("review")} 
                        className="absolute right-3 top-3 text-coffee-500 hover:text-coffee-600 transition-colors duration-200"
                        aria-label="음성 입력"
              >
                        🎤
              </button>
            </div>
                    {sttResult.review && <p className="text-xs text-brown-500 mt-1">{sttResult.review}</p>}
                  </div>
                </div>
          </div>
          
              {/* 저장 버튼 */}
            <button 
              type="submit" 
              disabled={submitting || !form.bean || !form.cafe} 
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-button font-medium shadow-lg hover:shadow-hover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>저장 중...</span>
                  </>
                ) : (
                  <>
                    <span className="text-xl">💾</span>
                    <span>기록 저장하기</span>
                  </>
                )}
            </button>
        </form>
      )}
      
      {/* 저장 완료 화면 */}
      {formSubmitted && (
            <div className="text-center p-8">
              <div className="text-6xl mb-4 animate-bounce">✅</div>
              <h2 className="text-2xl font-display font-bold text-brown-800 mb-3">저장 완료!</h2>
              <p className="text-brown-600 mb-6">커피 기록이 성공적으로 저장되었습니다.</p>
              <div className="flex flex-col gap-3">
            <button 
              onClick={() => {
                    setFormSubmitted(false);
                  setActiveStep(1);
                  setPreview(null);
                  setImage(null);
                    setOcrResult(null);
                    setForm({
                      cafe: "",
                      bean: "",
                      processing: "",
                      flavor: [],
                      otherFlavors: "",
                      rating: 0,
                      mood: "",
                      review: ""
                    });
                    setChat([
                      { type: "bot", text: "새로운 커피 기록을 시작해볼까요? 사진을 업로드하거나 촬영해 주세요!" }
                    ]);
              }}
                  className="w-full px-6 py-3 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-button font-medium shadow-lg hover:shadow-hover transition-all duration-200"
                >
                  📷 다시 기록하기
            </button>
              <button 
                  onClick={() => router.push('/')} 
                  className="w-full px-6 py-3 bg-gradient-to-r from-brown-500 to-brown-600 text-white rounded-button font-medium shadow-lg hover:shadow-hover transition-all duration-200"
              >
                  🏠 홈으로 돌아가기
              </button>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
} 