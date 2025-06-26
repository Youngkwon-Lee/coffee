/**
 * 로스팅 용어 통일 유틸리티
 * 
 * 다양한 로스팅 표현을 표준 용어로 변환합니다.
 * 약배전 → 라이트, 중배전 → 미디움, 강배전 → 다크
 */

// 표준 로스팅 레벨 정의
export const STANDARD_ROAST_LEVELS = [
  '라이트',
  '미디움라이트', 
  '미디움',
  '미디움다크',
  '다크',
  '풀시티',
  '프렌치',
  '이탈리안'
] as const;

export type StandardRoastLevel = typeof STANDARD_ROAST_LEVELS[number];

// 로스팅 매핑 테이블
const ROAST_MAPPING: { [key: string]: StandardRoastLevel } = {
  // 약배전 → 라이트
  '약배전': '라이트',
  '약': '라이트',
  '라이트': '라이트',
  'light': '라이트',
  '연배전': '라이트',
  '약간배전': '라이트',
  
  // 미디움라이트
  '미디움라이트': '미디움라이트',
  'medium light': '미디움라이트',
  '중약배전': '미디움라이트',
  
  // 중배전 → 미디움
  '중배전': '미디움',
  '중': '미디움',
  '미디움': '미디움',
  'medium': '미디움',
  '보통배전': '미디움',
  '중간배전': '미디움',
  
  // 미디움다크
  '미디움다크': '미디움다크',
  'medium dark': '미디움다크',
  '중강배전': '미디움다크',
  '중간강배전': '미디움다크',
  
  // 강배전 → 다크
  '강배전': '다크',
  '강': '다크',
  '다크': '다크',
  'dark': '다크',
  '진한배전': '다크',
  '깊은배전': '다크',
  
  // 풀시티
  '풀시티': '풀시티',
  'full city': '풀시티',
  '풀시티로스트': '풀시티',
  
  // 프렌치
  '프렌치': '프렌치',
  'french': '프렌치',
  '프렌치로스트': '프렌치',
  '극강배전': '프렌치',
  
  // 이탈리안
  '이탈리안': '이탈리안',
  'italian': '이탈리안',
  '이탈리안로스트': '이탈리안',
  '최강배전': '이탈리안',
};

/**
 * 로스팅 표현을 표준 용어로 변환
 */
export function normalizeRoastLevel(roast: string | undefined | null): StandardRoastLevel | null {
  if (!roast) return null;
  
  const normalized = roast.toLowerCase()
    .replace(/\s+/g, '')  // 공백 제거
    .replace(/배전$/, '') // '배전' 접미사 제거
    .replace(/로스트$/, ''); // '로스트' 접미사 제거
  
  // 직접 매핑
  for (const [key, value] of Object.entries(ROAST_MAPPING)) {
    if (key.toLowerCase().replace(/\s+/g, '') === normalized) {
      return value;
    }
  }
  
  // 부분 매칭
  for (const [key, value] of Object.entries(ROAST_MAPPING)) {
    if (normalized.includes(key.toLowerCase().replace(/\s+/g, ''))) {
      return value;
    }
  }
  
  return null;
}

/**
 * 로스팅 레벨의 강도를 숫자로 반환 (1-8)
 */
export function getRoastIntensity(roast: StandardRoastLevel): number {
  const intensityMap: { [key in StandardRoastLevel]: number } = {
    '라이트': 1,
    '미디움라이트': 2,
    '미디움': 3,
    '미디움다크': 4,
    '다크': 5,
    '풀시티': 6,
    '프렌치': 7,
    '이탈리안': 8,
  };
  
  return intensityMap[roast] || 3;
}

/**
 * 로스팅 레벨에 따른 색상 코드 반환
 */
export function getRoastColor(roast: StandardRoastLevel): string {
  const colorMap: { [key in StandardRoastLevel]: string } = {
    '라이트': '#D2B48C',      // 연한 갈색
    '미디움라이트': '#CD853F', // 모래 갈색
    '미디움': '#A0522D',      // 시에나 갈색
    '미디움다크': '#8B4513',   // 안장 갈색
    '다크': '#654321',        // 다크 갈색
    '풀시티': '#4A4A4A',      // 어두운 회색
    '프렌치': '#2F2F2F',      // 진한 회색
    '이탈리안': '#1C1C1C',    // 거의 검은색
  };
  
  return colorMap[roast] || '#A0522D';
}

/**
 * 여러 로스팅 표현을 일괄 변환
 */
export function normalizeRoastLevels(roasts: string[]): StandardRoastLevel[] {
  return roasts
    .map(normalizeRoastLevel)
    .filter((roast): roast is StandardRoastLevel => roast !== null);
}

/**
 * 로스팅 레벨 표시용 텍스트
 */
export function getRoastDisplayText(roast: StandardRoastLevel): string {
  const displayMap: { [key in StandardRoastLevel]: string } = {
    '라이트': '라이트 (약배전)',
    '미디움라이트': '미디움라이트',
    '미디움': '미디움 (중배전)',
    '미디움다크': '미디움다크',
    '다크': '다크 (강배전)',
    '풀시티': '풀시티',
    '프렌치': '프렌치',
    '이탈리안': '이탈리안',
  };
  
  return displayMap[roast] || roast;
}