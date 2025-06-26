/**
 * 원산지 매핑 유틸리티
 * 
 * 다양한 원산지 표현을 표준화하고 추출합니다.
 */

// 표준 원산지 목록
export const STANDARD_ORIGINS = [
  '에티오피아',
  '콜롬비아', 
  '과테말라',
  '브라질',
  '자메이카',
  '케냐',
  '코스타리카',
  '페루',
  '인도네시아',
  '온두라스',
  '니카라과',
  '파나마',
  '엘살바도르',
  '볼리비아',
  '에콰도르',
  '베네수엘라',
  '인도',
  '베트남',
  '중국',
  '미얀마',
  '예멘',
  '하와이',
  '푸에르토리코'
] as const;

export type StandardOrigin = typeof STANDARD_ORIGINS[number];

// 원산지 매핑 테이블 (다양한 표기법 → 표준 표기)
const ORIGIN_MAPPING: { [key: string]: StandardOrigin } = {
  // 에티오피아
  '에티오피아': '에티오피아',
  'ethiopia': '에티오피아',
  '이디오피아': '에티오피아',
  '예가체프': '에티오피아',
  'yirgacheffe': '에티오피아',
  '구지': '에티오피아',
  'guji': '에티오피아',
  '시다모': '에티오피아',
  'sidamo': '에티오피아',
  '하라': '에티오피아',
  'harrar': '에티오피아',
  
  // 콜롬비아
  '콜롬비아': '콜롬비아',
  '콜럼비아': '콜롬비아',
  'colombia': '콜롬비아',
  '우일라': '콜롬비아',
  'huila': '콜롬비아',
  '나리뇨': '콜롬비아',
  'narino': '콜롬비아',
  '안티오키아': '콜롬비아',
  'antioquia': '콜롬비아',
  '톨리마': '콜롬비아',
  'tolima': '콜롬비아',
  
  // 과테말라
  '과테말라': '과테말라',
  'guatemala': '과테말라',
  '안티구아': '과테말라',
  'antigua': '과테말라',
  '웨웨테낭고': '과테말라',
  'huehuetenango': '과테말라',
  
  // 브라질
  '브라질': '브라질',
  'brazil': '브라질',
  '상파울로': '브라질',
  'santos': '브라질',
  '세라도': '브라질',
  'cerrado': '브라질',
  '미나스제라이스': '브라질',
  'minas gerais': '브라질',
  
  // 자메이카
  '자메이카': '자메이카',
  'jamaica': '자메이카',
  '블루마운틴': '자메이카',
  'blue mountain': '자메이카',
  
  // 케냐
  '케냐': '케냐',
  'kenya': '케냐',
  'kenya aa': '케냐',
  
  // 코스타리카
  '코스타리카': '코스타리카',
  'costa rica': '코스타리카',
  '따라주': '코스타리카',
  'tarrazu': '코스타리카',
  
  // 페루
  '페루': '페루',
  'peru': '페루',
  '찬차마요': '페루',
  'chanchamayo': '페루',
  
  // 인도네시아
  '인도네시아': '인도네시아',
  'indonesia': '인도네시아',
  '수마트라': '인도네시아',
  'sumatra': '인도네시아',
  '만델링': '인도네시아',
  'mandheling': '인도네시아',
  '자바': '인도네시아',
  'java': '인도네시아',
  '술라웨시': '인도네시아',
  'sulawesi': '인도네시아',
  
  // 온두라스
  '온두라스': '온두라스',
  'honduras': '온두라스',
  
  // 니카라과
  '니카라과': '니카라과',
  'nicaragua': '니카라과',
  
  // 파나마
  '파나마': '파나마',
  'panama': '파나마',
  '게이샤': '파나마',
  'geisha': '파나마',
  '보케테': '파나마',
  'boquete': '파나마',
  
  // 엘살바도르
  '엘살바도르': '엘살바도르',
  'el salvador': '엘살바도르',
  
  // 기타
  '볼리비아': '볼리비아',
  'bolivia': '볼리비아',
  '에콰도르': '에콰도르',
  'ecuador': '에콰도르',
  '인도': '인도',
  'india': '인도',
  '베트남': '베트남',
  'vietnam': '베트남',
  '예멘': '예멘',
  'yemen': '예멘',
  '하와이': '하와이',
  'hawaii': '하와이',
  '코나': '하와이',
  'kona': '하와이',
};

/**
 * 텍스트에서 원산지를 추출
 */
export function extractOrigin(text: string | undefined | null): StandardOrigin | null {
  if (!text) return null;
  
  const normalizedText = text.toLowerCase()
    .replace(/\s+/g, ' ')  // 연속 공백을 하나로
    .trim();
  
  // 직접 매핑 확인
  for (const [key, origin] of Object.entries(ORIGIN_MAPPING)) {
    if (normalizedText.includes(key.toLowerCase())) {
      return origin;
    }
  }
  
  return null;
}

/**
 * 여러 텍스트에서 원산지 추출
 */
export function extractOrigins(texts: (string | undefined | null)[]): StandardOrigin[] {
  const origins = new Set<StandardOrigin>();
  
  texts.forEach(text => {
    const origin = extractOrigin(text);
    if (origin) {
      origins.add(origin);
    }
  });
  
  return Array.from(origins);
}

/**
 * 원산지 국기 이모지 반환
 */
export function getOriginFlag(origin: StandardOrigin): string {
  const flagMap: { [key in StandardOrigin]: string } = {
    '에티오피아': '🇪🇹',
    '콜롬비아': '🇨🇴',
    '과테말라': '🇬🇹',
    '브라질': '🇧🇷',
    '자메이카': '🇯🇲',
    '케냐': '🇰🇪',
    '코스타리카': '🇨🇷',
    '페루': '🇵🇪',
    '인도네시아': '🇮🇩',
    '온두라스': '🇭🇳',
    '니카라과': '🇳🇮',
    '파나마': '🇵🇦',
    '엘살바도르': '🇸🇻',
    '볼리비아': '🇧🇴',
    '에콰도르': '🇪🇨',
    '베네수엘라': '🇻🇪',
    '인도': '🇮🇳',
    '베트남': '🇻🇳',
    '중국': '🇨🇳',
    '미얀마': '🇲🇲',
    '예멘': '🇾🇪',
    '하와이': '🏝️',
    '푸에르토리코': '🇵🇷',
  };
  
  return flagMap[origin] || '🌍';
}

/**
 * 원산지별 특징 설명
 */
export function getOriginDescription(origin: StandardOrigin): string {
  const descriptionMap: { [key in StandardOrigin]: string } = {
    '에티오피아': '커피의 원산지, 꽃향기와 과일향이 특징',
    '콜롬비아': '균형잡힌 맛과 깔끔한 산미',
    '과테말라': '진한 바디감과 스모키한 풍미',
    '브라질': '견과류 향과 초콜릿 풍미',
    '자메이카': '블루마운틴의 고급스러운 맛',
    '케냐': '강한 산미와 와인 같은 풍미',
    '코스타리카': '밝은 산미와 깔끔한 뒷맛',
    '페루': '부드러운 맛과 적당한 산미',
    '인도네시아': '허브향과 풀바디감',
    '온두라스': '달콤함과 균형잡힌 맛',
    '니카라과': '초콜릿과 견과류 풍미',
    '파나마': '게이샤 품종의 화려한 향미',
    '엘살바도르': '달콤한 과일향과 부드러운 맛',
    '볼리비아': '독특한 향미와 깔끔한 뒷맛',
    '에콰도르': '균형잡힌 맛과 부드러운 질감',
    '베네수엘라': '진한 바디감과 초콜릿 풍미',
    '인도': '스파이시한 향과 독특한 캐릭터',
    '베트남': '진한 바디감과 강한 풍미',
    '중국': '부드러운 맛과 은은한 향',
    '미얀마': '독특한 향미 프로파일',
    '예멘': '와인 같은 발효향과 복합적 풍미',
    '하와이': '코나 커피의 부드럽고 달콤한 맛',
    '푸에르토리코': '균형잡힌 맛과 부드러운 질감',
  };
  
  return descriptionMap[origin] || '독특한 지역 특성을 가진 커피';
}