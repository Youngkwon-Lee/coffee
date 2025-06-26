/**
 * 기존 원두 데이터에 누락된 정보 보완
 * 
 * 로스팅 정보와 원산지 정보가 없는 원두들에 대해
 * 이름 패턴을 분석하여 자동으로 정보를 추가합니다.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

// Firebase 설정 (환경변수에서 가져오기)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 원산지 매핑 테이블
const ORIGIN_PATTERNS = {
  '에티오피아': ['에티오피아', 'ethiopia', '이디오피아', '예가체프', 'yirgacheffe', '구지', 'guji'],
  '콜롬비아': ['콜롬비아', 'colombia', '콜럼비아', '우일라', 'huila', '나리뇨', 'narino'],
  '과테말라': ['과테말라', 'guatemala', '안티구아', 'antigua', '웨웨테낭고'],
  '브라질': ['브라질', 'brazil', '상파울로', 'santos', '세라도', 'cerrado'],
  '자메이카': ['자메이카', 'jamaica', '블루마운틴', 'blue mountain'],
  '케냐': ['케냐', 'kenya', 'kenya aa'],
  '코스타리카': ['코스타리카', 'costa rica', '따라주', 'tarrazu'],
  '페루': ['페루', 'peru', '찬차마요', 'chanchamayo'],
  '인도네시아': ['인도네시아', 'indonesia', '수마트라', 'sumatra', '만델링', 'mandheling', '자바', 'java'],
  '온두라스': ['온두라스', 'honduras'],
  '니카라과': ['니카라과', 'nicaragua'],
  '파나마': ['파나마', 'panama', '게이샤', 'geisha'],
};

// 로스팅 매핑 테이블
const ROAST_PATTERNS = {
  '라이트': ['라이트', 'light', '약배전', '연배전'],
  '미디움': ['미디움', 'medium', '중배전'],
  '미디움다크': ['미디움다크', 'medium dark', '중강배전'],
  '다크': ['다크', 'dark', '강배전', '불어'],
  '풀시티': ['풀시티', 'full city'],
  '프렌치': ['프렌치', 'french', '극강배전'],
  '이탈리안': ['이탈리안', 'italian'],
};

// 브랜드별 기본 로스팅 (추측)
const BRAND_DEFAULT_ROAST = {
  '센터커피': '미디움',
  '프리츠': '미디움',
  '낮은곳에서온': '라이트',
  '테라로사': '미디움',
  '블루보틀': '라이트',
  '스타벅스': '미디움다크',
};

interface Bean {
  id?: string;
  name: string;
  brand?: string;
  flavor?: string;
  roast?: string;
  origin?: string;
  category?: string;
  price?: string;
  image?: string;
  link?: string;
  desc?: string;
  createdAt?: any;
  lastUpdated?: any;
}

async function enhanceBeanData() {
  try {
    console.log('🔄 원두 데이터 보완 시작...');
    
    // 1. 모든 원두 데이터 가져오기
    const beansCollection = collection(db, 'beans');
    const beansSnapshot = await getDocs(beansCollection);
    const beans: Bean[] = [];
    
    beansSnapshot.forEach(doc => {
      beans.push({ id: doc.id, ...doc.data() } as Bean);
    });
    
    console.log(`📊 총 ${beans.length}개 원두 데이터 발견`);
    
    // 2. 누락된 정보 분석
    let missingOrigin = 0;
    let missingRoast = 0;
    let enhanced = 0;
    
    for (const bean of beans) {
      let hasUpdates = false;
      const updates: Partial<Bean> = {};
      
      // 원산지 정보 보완
      if (!bean.origin) {
        missingOrigin++;
        const detectedOrigin = detectOrigin(bean.name, bean.flavor);
        if (detectedOrigin) {
          updates.origin = detectedOrigin;
          hasUpdates = true;
        }
      }
      
      // 로스팅 정보 보완
      if (!bean.roast) {
        missingRoast++;
        const detectedRoast = detectRoast(bean.name, bean.brand);
        if (detectedRoast) {
          updates.roast = detectedRoast;
          hasUpdates = true;
        }
      }
      
      // Firebase 업데이트
      if (hasUpdates && bean.id) {
        try {
          await updateDoc(doc(db, 'beans', bean.id), {
            ...updates,
            lastUpdated: new Date(),
          });
          enhanced++;
          console.log(`✅ ${bean.name} - 보완: ${Object.keys(updates).join(', ')}`);
        } catch (error) {
          console.error(`❌ ${bean.name} 업데이트 실패:`, error);
        }
      }
    }
    
    console.log('\n📈 보완 결과:');
    console.log(`- 원산지 누락: ${missingOrigin}개`);
    console.log(`- 로스팅 누락: ${missingRoast}개`);
    console.log(`- 보완 완료: ${enhanced}개`);
    
  } catch (error) {
    console.error('❌ 데이터 보완 실패:', error);
  }
}

function detectOrigin(name: string, flavor?: string): string | null {
  const searchText = `${name} ${flavor || ''}`.toLowerCase();
  
  for (const [origin, patterns] of Object.entries(ORIGIN_PATTERNS)) {
    for (const pattern of patterns) {
      if (searchText.includes(pattern.toLowerCase())) {
        return origin;
      }
    }
  }
  
  return null;
}

function detectRoast(name: string, brand?: string): string | null {
  const searchText = name.toLowerCase();
  
  // 1. 이름에서 로스팅 패턴 찾기
  for (const [roast, patterns] of Object.entries(ROAST_PATTERNS)) {
    for (const pattern of patterns) {
      if (searchText.includes(pattern.toLowerCase())) {
        return roast;
      }
    }
  }
  
  // 2. 브랜드별 기본 로스팅
  if (brand && BRAND_DEFAULT_ROAST[brand]) {
    return BRAND_DEFAULT_ROAST[brand];
  }
  
  // 3. 기본값 (미디움)
  return '미디움';
}

// 스크립트 실행
if (require.main === module) {
  enhanceBeanData()
    .then(() => {
      console.log('✅ 데이터 보완 완료');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export { enhanceBeanData, detectOrigin, detectRoast };