import { NextRequest, NextResponse } from 'next/server';
import vision from '@google-cloud/vision';
import beans from '@/data/beansList_sample.json';

export const runtime = 'nodejs';

// 표준 Google Cloud 인증 방식
let client: any;

try {
  // 1. 표준 환경변수 방식 (GOOGLE_APPLICATION_CREDENTIALS)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    client = new vision.ImageAnnotatorClient();
  }
  // 2. JSON 문자열 방식 (Vercel 등 서버리스 환경)
  else if (process.env.GOOGLE_CLOUD_CREDENTIALS_JSON) {
    client = new vision.ImageAnnotatorClient({
      credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS_JSON),
    });
  }
  // 3. 로컬 환경에서는 파일 기반 인증
  else {
    client = new vision.ImageAnnotatorClient({
      keyFilename: './firebase_credentials.json',
    });
  }
} catch (error) {
  console.log('Vision API 초기화 실패:', error);
  // API 키가 없으면 null로 설정
  client = null;
}

// Bean 타입 정의
interface Bean {
  name: string;
  brand: string;
  flavors?: string[];
}

// 문자열 전처리(소문자, 특수문자/공백 제거)
function normalize(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/gi, "");
}

// name, brand, name의 각 단어까지 부분 매칭 점수 합산 - 개선 버전
function findBestBean(text: string) {
  const normText = normalize(text);
  let best = null;
  let maxScore = 0;
  let minScoreThreshold = 15; // 최소 점수 임계값 상향 조정 (5 -> 15)
  
  for (const bean of beans as Bean[]) {
    const normName = normalize(bean.name);
    const normBrand = normalize(bean.brand);
    const origin = bean.name.split(/\s+/)[0]; // 첫 단어를 산지로 가정 (Ethiopia 등)
    
    let score = 0;
    
    // 정확한 이름 매칭에 가중치 부여
    if (normText.includes(normName)) score += normName.length * 3;
    
    // 카페/브랜드 매칭 - 더 높은 임계값 요구
    if (normText.includes(normBrand)) {
      // 브랜드명이 완전히 일치할 때만 높은 점수 부여
      if (normText.includes(normBrand) && normBrand.length > 4) {
        score += normBrand.length * 2;
      } else {
        // 부분 일치는 낮은 점수
        score += 3;
      }
    }
    
    // 산지명 매칭 (Ethiopia, Colombia 등)
    if (normText.includes(normalize(origin))) score += origin.length * 2;
    
    // 이름의 각 단어 매칭 (최소 3자 이상 단어만)
    const nameWords = normName.split(/\s+/);
    for (const word of nameWords) {
      if (word.length > 2 && normText.includes(word)) {
        score += word.length;
        
        // 숫자가 포함된 경우 (#1, #2 등) 추가 가중치 - 정확한 숫자 일치 요구
        if (/\d/.test(word)) {
          const numMatch = word.match(/(\d+)/);
          const textNumMatch = normText.match(/(\d+)/);
          
          // 숫자가 정확히 일치할 때만 점수 부여
          if (numMatch && textNumMatch && numMatch[1] === textNumMatch[1]) {
            score += 10;
          } else {
            // 숫자가 다르면 점수 감소
            score -= 5;
          }
        }
      }
    }
    
    // 향미 매칭 (있는 경우)
    if (bean.flavors && Array.isArray(bean.flavors)) {
      for (const flavor of bean.flavors) {
        const normFlavor = normalize(flavor);
        if (normText.includes(normFlavor)) {
          score += normFlavor.length;
        }
      }
    }
    
    if (score > maxScore) {
      best = bean;
      maxScore = score;
    }
  }
  
  // 최소 점수 임계값보다 낮으면 매칭 실패로 간주
  return maxScore >= minScoreThreshold ? best : null;
}

// OCR 텍스트에서 프로세싱 방식 추출
function extractProcessing(text: string) {
  // 프로세싱 매핑 (동일한 프로세싱의 다른 표현들)
  const processingMappings = {
    "Washed": ["Washed", "Fully Washed", "F/W", "WASHED", "F.W.", "Wet Process", "습식가공", "Wet"],
    "Natural": ["Natural", "NATURAL", "Natural Process", "NAT", "Dry Process", "건식가공", "Dry", "Sun-dried", "내추럴", "드라이", "선드라이"],
    "Honey": ["Honey", "Honey Process", "White Honey", "Yellow Honey", "Red Honey", "Black Honey", "HONEY", "Semi-washed", "허니", "펄프드 내추럴"],
    "Anaerobic": ["Anaerobic", "Anaerobic Fermentation", "Anaerobico", "Anaero", "AN", "무산소발효", "혐기성", "아나에어로빅"],
    "Carbonic Maceration": ["Carbonic Maceration", "CM", "Carbonic", "카보닉"],
    "Lactic": ["Lactic", "Lactic Fermentation", "LACTIC", "유산균발효"],
    "Yeast": ["Yeast", "Yeast Inoculated", "Yeast Fermentation", "이스트 발효"],
    "Thermal": ["Thermal", "Thermal Fermentation", "온열 발효"],
    "Experimental": ["Experimental", "Exp. Process", "실험적 가공", "실험가공"],
    "Double Fermentation": ["Double Fermentation", "DF", "2x Fermentation", "Double Anaerobic"],
    "Co-Fermented": ["Co-Fermented", "Co-Ferment", "Co-Fermentation", "Flavor-added", "과일함침", "CoF", "Flavored"],
    "Washed Anaerobic": ["Washed Anaerobic", "Anaerobic Washed", "W/A", "Washed + Anaerobic"],
    "Natural Anaerobic": ["Natural Anaerobic", "Anaerobic Natural", "N/A", "Natural + Anaerobic"],
    "Honey Anaerobic": ["Honey Anaerobic", "Anaerobic Honey", "H/A", "Honey + Anaerobic"],
    "Pulped Natural": ["Pulped Natural", "P.N.", "Semi-Washed", "반습식가공"],
    "Wet Hulled": ["Wet Hulled", "Giling Basah", "W.H.", "인도네시아 방식"],
    "Decaf": ["Decaf", "Decaffeinated", "DECAF", "Swiss Water Process"],
    "Monsooned": ["Monsooned", "Aged", "Monsoon Malabar", "Monsooned Process", "Aged / Monsooned"]
  };
  
  // 텍스트에서 프로세싱 방식 찾기 (매핑 사용)
  for (const [mainProcess, aliases] of Object.entries(processingMappings)) {
    for (const alias of aliases) {
      if (text.includes(alias)) {
        return mainProcess; // 표준화된 프로세싱 이름 반환
      }
    }
  }
  
  // 프로세싱 관련 패턴 검색
  const processingPatterns = [
    /[Pp]rocess(?:ing)?[:：]?\s*([A-Za-z]+)/,
    /[Pp]rocess(?:ing)?[:：]?\s*([^\n.,]+)/,
    /프로세스[:：]?\s*([^\n.,]+)/,
    /가공방식[:：]?\s*([^\n.,]+)/
  ];
  
  for (const pattern of processingPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim().length > 0) {
      const processText = match[1].trim();
      
      // 매핑에서 찾아보기
      for (const [mainProcess, aliases] of Object.entries(processingMappings)) {
        for (const alias of aliases) {
          if (processText.toLowerCase().includes(alias.toLowerCase())) {
            return mainProcess;
          }
        }
      }
      
      return processText;
    }
  }
  
  return null;
}

// OCR 텍스트에서 향미(flavor) 추출 (영문/한글) - 개선 버전
function extractFlavors(text: string) {
  // 영문 flavor: 다양한 패턴 (Notes:, Flavor:, Tasting Notes: 등으로 시작하는 라인)
  const engFlavorPatterns = [
    /[Nn]otes?[:：]?\s*([^.]+)/,
    /[Ff]lavou?rs?[:：]?\s*([^.]+)/,
    /[Tt]asting [Nn]otes?[:：]?\s*([^.]+)/,
    /[Bb]ergamot,([^.]+)/
  ];
  
  // 한글 flavor: 다양한 패턴
  const korFlavorPatterns = [
    /향미[:：]?\s*([가-힣\s,.·]+)/,
    /풍미[:：]?\s*([가-힣\s,.·]+)/,
    /노트[:：]?\s*([가-힣\s,.·]+)/
  ];

  let flavors: string[] = [];
  
  // 영문 패턴 시도
  for (const pattern of engFlavorPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].split(/,|and|·/).map(f => f.trim());
      flavors = [...flavors, ...extracted];
      break;
    }
  }
  
  // 한글 패턴 시도
  for (const pattern of korFlavorPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].split(/,|·/).map(f => f.trim());
      flavors = [...flavors, ...extracted];
      break;
    }
  }

  // 특정 향미 키워드 찾기 (패턴 매칭 실패 시)
  // 더 확장된 향미 키워드 목록
  const flavorKeywords = [
    // 기본 향미
    "Chocolate", "Nutty", "Fruity", "Floral", "Citrus", "Berry", "Caramel",
    "초콜릿", "고소한", "과일향", "꽃향", "시트러스", "베리", "카라멜",
    
    // 구체적 과일 향미
    "Orange", "Nectarine", "Peach", "Apple", "Grape", "Lemon", "Lime", "Strawberry", "Blueberry", 
    "Raspberry", "Blackberry", "Mango", "Pineapple", "Banana", "Melon", "Cherry", "Plum",
    "오렌지", "넥타린", "복숭아", "사과", "포도", "레몬", "라임", "딸기", "블루베리",
    "라즈베리", "블랙베리", "망고", "파인애플", "바나나", "멜론", "체리", "자두",
    
    // 꽃/허브 향미
    "Jasmine", "Rose", "Lavender", "Earl Grey", "Green Tea", "Chamomile", "Mint", "Basil",
    "자스민", "장미", "라벤더", "얼그레이", "녹차", "그린 티", "카모마일", "민트", "바질",
    
    // 달콤한 향미
    "Honey", "Maple", "Brown Sugar", "Toffee", "Vanilla", "Molasses", "Marshmallow",
    "꿀", "메이플", "흑설탕", "토피", "바닐라", "당밀", "마시멜로",
    
    // 견과류/곡물 향미
    "Almond", "Hazelnut", "Peanut", "Walnut", "Coffee", "Cereal", "Malt", "Grain",
    "아몬드", "헤이즐넛", "땅콩", "호두", "커피", "시리얼", "맥아", "곡물",
    
    // 특성 관련 키워드
    "Sweet", "Sour", "Bitter", "Tart", "Creamy", "Smooth", "Complex", "Bold", "Rich", "Clean",
    "달콤함", "신맛", "쓴맛", "타르트", "크리미", "부드러움", "복합적", "진한", "풍부한", "깔끔한"
  ];
  
  if (flavors.length === 0 || true) { // 항상 추가 향미 확인
    for (const keyword of flavorKeywords) {
      if (text.includes(keyword) && !flavors.includes(keyword)) {
        flavors.push(keyword);
      }
    }
  }
  
  return flavors.filter(f => f.length > 1);
}

// OCR 텍스트에서 카페명 추출 - 개선 버전
function extractCafe(text: string) {
  // 알려진 카페/로스터리 목록
  const knownCafes = [
    "Fritz", "FRITZ", "Fritz Coffee", "Fritz Coffee Company",
    "Bean Brothers", "BEAN BROTHERS",
    "Anthracite", "ANTHRACITE",
    "Terarosa", "TERAROSA",
    "Momento", "MOMENTO",
    "Coffee Libre", "COFFEE LIBRE",
    "Momos", "MOMOS", "Momos Coffee",
    "Tailor", "TAILOR", "Tailor Coffee"
  ];
  
  // 알려진 카페명 매칭 시도
  for (const cafe of knownCafes) {
    if (text.includes(cafe)) {
      return cafe;
    }
  }
  
  // 대문자+영문, 한글 단어 중 3자 이상인 패턴 찾기
  const cafePatterns = [
    /([A-Z]{3,}(?:\s+[A-Z]+)?)/g,  // 대문자 연속 3자 이상 + 선택적 공백과 대문자
    /([A-Z][a-z]{2,}(?:\s+(?:[A-Z][a-z]+))?)/g  // 카멜케이스 단어(Coffee 등)
  ];
  
  for (const pattern of cafePatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      // 산지명이나 일반 단어 제외
      const excludeWords = ["ETHIOPIA", "COLOMBIA", "KENYA", "COFFEE", "BEANS"];
      if (!excludeWords.includes(match[1])) {
        return match[1];
      }
    }
  }
  
  // 기존 방식도 유지 (대문자+영문/한글 단어 중 4자 이상)
  const cafeMatch = text.match(/[A-Z가-힣]{4,}/g);
  if (cafeMatch) return cafeMatch[0];
  
  return null;
}

// OCR 텍스트에서 원두명 추출 - 개선 버전
function extractBean(text: string) {
  // 한글/영문 주요 산지명 (키워드 확장)
  const origins = [
    '에티오피아', '예가체프', '콜롬비아', '케냐', '브라질', '예멘', '과테말라', '파나마', '코스타리카', '인도네시아',
    'Ethiopia', 'Yirgacheffe', 'Colombia', 'Kenya', 'Brazil', 'Yemen', 'Guatemala', 'Panama', 'Costa Rica', 'Indonesia',
    'Honduras', 'El Salvador', 'Rwanda', 'Burundi'
  ];
  
  // 자주 등장하는 구체적인 원두명 목록
  const specificBeans = [
    // 에티오피아 원두
    "Ethiopia Benti Korbo", "Ethiopia Chelbesa", "Ethiopia Aricha", 
    "Ethiopia Uraga", "Ethiopia Shakiso", "Ethiopia Yirgacheffe", 
    "Ethiopia Hambela", "Ethiopia Adado",
    
    // 콜롬비아 원두
    "Colombia El Paraiso", "Colombia La Palma y El Tucan", 
    "Colombia Las Flores", "Colombia La Esperanza", 
    "Colombia La Cristalina",
    
    // 파나마 원두
    "Panama Elida Estate", "Panama Esmeralda Jaramillo", 
    "Panama Hartmann Estate",
    
    // 케냐 원두
    "Kenya Karimikui", "Kenya Gakuyuini", "Kenya Kiamabara",
    
    // 과테말라 원두
    "Guatemala El Injerto", "Guatemala La Esperanza",
    
    // 기타 국가 원두
    "Honduras Santa Barbara", "Costa Rica Las Lajas", 
    "Costa Rica Don Mayo", "El Salvador Los Pirineos",
    "Rwanda Bumbogo", "Rwanda Gitesi", "Burundi Ninga",
    "Indonesia Wahana Estate", "Yemen Haraaz"
  ];
  
  // 먼저 목록에서 완전/부분 일치하는 원두명 찾기
  for (const beanName of specificBeans) {
    // 완전 일치
    if (text.includes(beanName)) {
      return beanName;
    }
    
    // 대소문자 구분 없이 일치
    if (text.toLowerCase().includes(beanName.toLowerCase())) {
      return beanName;
    }
    
    // 국가명과 지역명 분리해서 확인 (예: Ethiopia + Benti Korbo)
    const parts = beanName.split(" ");
    if (parts.length >= 2) {
      const country = parts[0];
      const region = parts.slice(1).join(" ");
      
      if (text.toLowerCase().includes(country.toLowerCase()) && 
          text.toLowerCase().includes(region.toLowerCase())) {
        return beanName;
      }
    }
  }
  
  const lines = text.split(/\n|\r/);
  
  // 1. 먼저 "원두명:" 또는 "Bean:" 등의 명시적 라벨이 있는지 확인
  const beanLabelPatterns = [
    /원두명[:：]?\s*([^\n]+)/,
    /원두[:：]?\s*([^\n]+)/,
    /[Bb]ean(?:\s+[Nn]ame)?[:：]?\s*([^\n]+)/
  ];
  
  for (const pattern of beanLabelPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim().length > 0) {
      return match[1].trim();
    }
  }
  
  // 2. 산지명이 포함된 라인 찾기 (길이 제한 완화: 40자 → 80자)
  for (const line of lines) {
    for (const origin of origins) {
      if (line.includes(origin) && line.length < 80) {
        // 특정 단어를 포함하는 라인에서 ":" 이후의 텍스트만 추출
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1 && colonIndex < line.length - 1) {
          return line.substring(colonIndex + 1).trim();
        }
        return line.trim();
      }
    }
  }
  
  // 3. 위 방법으로 찾지 못했을 경우, 짧은 라인(15자 이상 50자 미만) 중에서 특정 키워드 포함 검사
  const beanKeywords = ["Coffee", "Blend", "Single Origin", "Specialty", "커피", "블렌드", "싱글 오리진"];
  for (const line of lines) {
    if (line.length >= 15 && line.length < 50) {
      for (const keyword of beanKeywords) {
        if (line.includes(keyword)) {
          return line.trim();
        }
      }
    }
  }
  
  // 4. 마지막으로, 국가명만이라도 추출
  for (const line of lines) {
    for (const origin of origins) {
      if (line.includes(origin)) {
        // 국가명만 찾았을 경우, 국가명으로 시작하는 문구 반환
        const startIndex = line.indexOf(origin);
        const endIndex = line.indexOf(",", startIndex);
        if (endIndex > startIndex) {
          return line.substring(startIndex, endIndex).trim();
        } else {
          // 콤마가 없으면 공백 또는 줄 끝까지
          const spaceIndex = line.indexOf(" ", startIndex + origin.length);
          if (spaceIndex > startIndex) {
            return line.substring(startIndex, spaceIndex).trim();
          } else {
            return origin; // 최소한 국가명만이라도 반환
          }
        }
      }
    }
  }
  
  return null;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('image') as File | null;
  if (!file) {
    return NextResponse.json({ error: "이미지 파일이 필요합니다." }, { status: 400 });
  }
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    // API 클라이언트가 초기화되지 않은 경우
    if (!client) {
      throw new Error('Google Cloud Vision API 초기화 실패 - 환경변수를 확인하세요');
    }
    
    // Vision API로 이미지 분석
    const [result] = await client.textDetection({ image: { content: buffer } });
    const text = result.fullTextAnnotation?.text || "";

    // beans DB에서 가장 유사한 원두 찾기
    const bestBean = findBestBean(text);

    if (bestBean) {
      return NextResponse.json({
        bean: bestBean.name,
        cafe: bestBean.brand,
        flavor: bestBean.flavors,
        processing: extractProcessing(text),
        raw_text: text
      });
    } else {
      // beans DB 매칭 실패 시 OCR 텍스트에서 직접 추출
      const bean = extractBean(text);
      const cafe = extractCafe(text);
      const flavor = extractFlavors(text);
      const processing = extractProcessing(text);
      return NextResponse.json({
        bean,
        cafe,
        flavor,
        processing,
        raw_text: text
        });
      }
    } catch (error) {
      console.error('Vision API 오류:', error);
      
      // API 실패 시 mock 데이터 반환 (에러 메시지 포함)
      return NextResponse.json({
        bean: "샘플 원두명",
        cafe: "샘플 카페", 
        flavor: ["Sour"],
        processing: "Natural",
        raw_text: `OCR 분석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}. Google Cloud Vision API 환경변수(GOOGLE_APPLICATION_CREDENTIALS 또는 GOOGLE_CLOUD_CREDENTIALS_JSON)를 Vercel에 설정해주세요.`,
        error: "API_KEY_MISSING"
      });
    }
  } 