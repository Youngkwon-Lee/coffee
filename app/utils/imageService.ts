// 이미지 서비스 유틸리티

// Unsplash 커피 이미지 컬렉션
const COFFEE_BEAN_IMAGES = [
  "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=300&h=300&fit=crop", // 원두 클로즈업
  "https://images.unsplash.com/photo-1587734195503-904fca47e0d9?w=300&h=300&fit=crop", // 원두 포대
  "https://images.unsplash.com/photo-1610632380989-680fe40816c6?w=300&h=300&fit=crop", // 볶은 원두
  "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300&h=300&fit=crop", // 원두 스쿱
  "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=300&h=300&fit=crop", // 원두 그릇
  "https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=300&h=300&fit=crop", // 원두 더미
  "https://images.unsplash.com/photo-1546949891-65993c84d4c9?w=300&h=300&fit=crop", // 원두 자루
  "https://images.unsplash.com/photo-1596040469693-6c23fb1b6d84?w=300&h=300&fit=crop", // 원두 핸드드립
];

const CAFE_IMAGES = [
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&h=200&fit=crop", // 카페 인테리어
  "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=300&h=200&fit=crop", // 모던 카페
  "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=300&h=200&fit=crop", // 카페 테이블
  "https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=300&h=200&fit=crop", // 카페 바
  "https://images.unsplash.com/photo-1506619216599-9d16d0903dfd?w=300&h=200&fit=crop", // 빈티지 카페
  "https://images.unsplash.com/photo-1516487266042-46c9a1162bb7?w=300&h=200&fit=crop", // 산업풍 카페
  "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=300&h=200&fit=crop", // 나무 카페
  "https://images.unsplash.com/photo-1442975631115-c4f7b05b8a2c?w=300&h=200&fit=crop", // 화이트 카페
];

// 문자열 해시 함수 (같은 이름은 같은 이미지)
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit로 변환
  }
  return Math.abs(hash);
}

// 원두 이름을 기반으로 일관된 이미지 반환
export function getBeanImage(beanName: string): string {
  if (!beanName) return "/images/coffee-placeholder.svg";
  
  const index = hashString(beanName) % COFFEE_BEAN_IMAGES.length;
  return COFFEE_BEAN_IMAGES[index];
}

// 카페 이름을 기반으로 일관된 이미지 반환
export function getCafeImage(cafeName: string): string {
  if (!cafeName) return "/images/coffee-placeholder.svg";
  
  const index = hashString(cafeName) % CAFE_IMAGES.length;
  return CAFE_IMAGES[index];
}

// 지역별 카페 이미지 (더 정확한 매칭)
export function getCafeImageByLocation(cafeName: string, location?: string): string {
  // 특정 카페 체인별 매칭
  const cafeNameLower = cafeName.toLowerCase();
  
  if (cafeNameLower.includes('스타벅스')) {
    return "https://images.unsplash.com/photo-1516486392848-8b67ef89f113?w=300&h=200&fit=crop";
  }
  if (cafeNameLower.includes('이디야')) {
    return "https://images.unsplash.com/photo-1506619216599-9d16d0903dfd?w=300&h=200&fit=crop";
  }
  if (cafeNameLower.includes('센터')) {
    return "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=300&h=200&fit=crop";
  }
  if (cafeNameLower.includes('프릳츠')) {
    return "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=300&h=200&fit=crop";
  }
  
  // 기본: 이름 기반 해시
  return getCafeImage(cafeName);
}

// 원두 원산지별 이미지 매칭
export function getBeanImageByOrigin(beanName: string, origin?: string): string {
  const originLower = (origin || beanName).toLowerCase();
  
  if (originLower.includes('ethiopia') || originLower.includes('에티오피아')) {
    return "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300&h=300&fit=crop";
  }
  if (originLower.includes('colombia') || originLower.includes('콜롬비아')) {
    return "https://images.unsplash.com/photo-1587734195503-904fca47e0d9?w=300&h=300&fit=crop";
  }
  if (originLower.includes('brazil') || originLower.includes('브라질')) {
    return "https://images.unsplash.com/photo-1610632380989-680fe40816c6?w=300&h=300&fit=crop";
  }
  if (originLower.includes('kenya') || originLower.includes('케냐')) {
    return "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=300&h=300&fit=crop";
  }
  
  // 기본: 이름 기반 해시
  return getBeanImage(beanName);
}