# 🎨 UI/UX 디자인 가이드

## 🎯 디자인 철학

**Coffee Journey**는 **개인의 커피 여정을 따뜻하고 직관적으로 기록**하는 플랫폼을 지향합니다.

### 핵심 가치
- **🔥 따뜻함 (Warmth)**: 커피의 온기를 담은 색상과 인터랙션
- **✨ 단순함 (Simplicity)**: 복잡하지 않은 명확한 인터페이스
- **📱 접근성 (Accessibility)**: 모든 사용자가 쉽게 사용할 수 있는 디자인
- **🎨 개인화 (Personalization)**: 사용자별 맞춤형 경험 제공

## 🎨 색상 시스템

### 주요 색상 팔레트 (3가지 통일)

#### 🟠 Primary (주황색) - 메인 액션
```css
/* 따뜻한 주황색 계열 */
--primary-50: #fef7cd;
--primary-500: #f59e0b;  /* 주요 버튼, 강조 */
--primary-600: #d97706;  /* 호버 상태 */
--primary-gradient: linear-gradient(to right, #f59e0b, #ea580c);
```
**사용 영역**: 메인 CTA 버튼, 로고, 강조 요소

#### 🟣 Secondary (보라색) - 기록/분석
```css
/* 신비로운 보라색 계열 */
--secondary-500: #8b5cf6;  /* 기록 관련 */
--secondary-600: #7c3aed;  /* 분석 관련 */
--secondary-gradient: linear-gradient(to right, #8b5cf6, #6366f1);
```
**사용 영역**: 기록 페이지, 통계/분석, 개인화 기능

#### ⚪ Neutral (회색) - 보조 기능
```css
/* 차분한 회색 계열 */
--neutral-600: #4b5563;  /* 보조 텍스트 */
--neutral-700: #374151;  /* 기본 텍스트 */
--neutral-gradient: linear-gradient(to right, #4b5563, #374151);
```
**사용 영역**: 보조 버튼, 텍스트, 비활성 상태

### 색상 사용 규칙
1. **Primary (주황)**: 주요 액션 (로그인, 기록 저장 등)
2. **Secondary (보라)**: 기록/분석 관련 기능
3. **Neutral (회색)**: 취소, 비활성, 보조 텍스트

## 📐 타이포그래피

### 폰트 계층 구조
```css
/* 제목 */
.text-3xl { font-size: 1.875rem; font-weight: 700; } /* 메인 헤딩 */
.text-2xl { font-size: 1.5rem; font-weight: 600; }   /* 서브 헤딩 */
.text-xl  { font-size: 1.25rem; font-weight: 600; }  /* 카드 제목 */

/* 본문 */
.text-lg   { font-size: 1.125rem; font-weight: 400; } /* 큰 본문 */
.text-base { font-size: 1rem; font-weight: 400; }     /* 기본 본문 */
.text-sm   { font-size: 0.875rem; font-weight: 400; } /* 작은 텍스트 */
```

### 텍스트 색상
```css
.text-gray-900  /* 메인 제목 */
.text-gray-700  /* 기본 본문 */
.text-gray-500  /* 보조 텍스트 */
.text-gray-400  /* 비활성 텍스트 */
```

## 🔲 컴포넌트 시스템

### 버튼 디자인

#### Primary 버튼
```tsx
<button className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
  기록하기
</button>
```

#### Secondary 버튼
```tsx
<button className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200">
  분석 보기
</button>
```

#### Neutral 버튼
```tsx
<button className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-2 rounded-lg font-medium">
  취소
</button>
```

### 카드 디자인
```tsx
<div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-200 p-6 border border-gray-100">
  {/* 카드 내용 */}
</div>
```

### 입력 필드
```tsx
<input className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all duration-200" />
```

## 📱 반응형 디자인

### 브레이크포인트
```css
/* Tailwind CSS 기본 브레이크포인트 활용 */
sm: 640px   /* 모바일 가로 */
md: 768px   /* 태블릿 */
lg: 1024px  /* 작은 데스크톱 */
xl: 1280px  /* 큰 데스크톱 */
```

### 모바일 우선 설계
1. **기본**: 모바일 (360px~640px)
2. **확장**: 태블릿, 데스크톱 순서로 확장
3. **터치 친화적**: 최소 44px 터치 타겟 크기

### 그리드 시스템
```tsx
{/* 모바일: 1열, 태블릿: 2열, 데스크톱: 3열 */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* 카드들 */}
</div>
```

## ✨ 애니메이션 & 인터랙션

### Framer Motion 패턴
```tsx
// 페이지 전환
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

// 카드 호버
const cardVariants = {
  hover: { 
    scale: 1.02, 
    boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
    transition: { duration: 0.2 }
  }
};
```

### CSS 애니메이션
```css
/* 부드러운 전환 */
.transition-smooth {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 버튼 호버 효과 */
.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.1);
}
```

## 📋 페이지별 디자인 가이드

### 메인 페이지
- **히어로 섹션**: 시간별 인사말 + 개인화 메시지
- **통계 카드**: 3개 열 그리드 (모바일: 1열)
- **빠른 액션**: 플로팅 버튼 + 하단 고정 네비게이션

### 기록 페이지
- **탭 네비게이션**: 수동/사진 기록 구분
- **단계별 폼**: 진행률 표시
- **즉시 피드백**: 실시간 유효성 검사

### 카페/원두 페이지
- **필터 바**: 상단 고정
- **카드 리스트**: 무한 스크롤
- **지도 뷰**: 토글 가능

## 🔍 사용성 (UX) 원칙

### 1. 직관적인 네비게이션
- **명확한 라벨**: "기록하기", "카페 찾기" 등
- **일관된 위치**: 주요 버튼은 항상 같은 위치
- **시각적 피드백**: 현재 페이지 표시

### 2. 효율적인 입력
- **자동완성**: 커피명, 카페명 등
- **기본값 제공**: 자주 사용하는 값 미리 설정
- **한 번에 완료**: 최소한의 단계로 작업 완료

### 3. 개인화 경험
- **맞춤형 추천**: 사용자 취향 기반
- **진행률 표시**: "10개 기록 달성!" 등
- **시간별 메시지**: 아침/점심/저녁 다른 인사

### 4. 오류 처리
```tsx
// 친화적인 오류 메시지
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
  <p className="text-red-700">앗! 사진을 분석하는데 문제가 생겼어요. 다시 시도해주세요.</p>
</div>
```

## 📊 접근성 (Accessibility)

### WCAG 2.1 AA 준수
1. **색상 대비**: 최소 4.5:1 비율 유지
2. **키보드 탐색**: 모든 기능 키보드로 접근 가능
3. **스크린 리더**: alt 텍스트, aria-label 활용
4. **포커스 표시**: 명확한 포커스 상태 표시

### 코드 예시
```tsx
<button 
  className="..."
  aria-label="커피 기록 추가하기"
  role="button"
  tabIndex={0}
>
  <span className="sr-only">커피 기록 추가</span>
  ➕
</button>
```

## 🎪 상태 디자인

### 로딩 상태
```tsx
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
</div>
```

### 빈 상태
```tsx
<div className="text-center py-12">
  <div className="text-6xl mb-4">☕</div>
  <h3 className="text-lg font-semibold text-gray-900 mb-2">
    아직 기록된 커피가 없어요
  </h3>
  <p className="text-gray-500 mb-6">
    첫 번째 커피 기록을 시작해보세요!
  </p>
  <button className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-xl">
    기록하기
  </button>
</div>
```

### 성공 상태
```tsx
<div className="bg-green-50 border border-green-200 rounded-lg p-4">
  <div className="flex items-center">
    <span className="text-green-500 text-xl mr-3">✅</span>
    <p className="text-green-700 font-medium">
      커피 기록이 성공적으로 저장되었습니다!
    </p>
  </div>
</div>
```

## 🏃‍♂️ 성능 최적화

### 이미지 최적화
- **Next.js Image 컴포넌트** 사용
- **lazy loading** 적용
- **WebP 형식** 우선 사용

### 애니메이션 최적화
- **transform/opacity** 속성 우선 사용
- **will-change** 적절히 활용
- **GPU 가속** 활용

### 로딩 전략
- **스켈레톤 UI** 활용
- **점진적 로딩** 구현
- **중요 콘텐츠 우선** 표시

## ✅ 체크리스트

### 디자인 완료 체크
- [ ] 3가지 색상 팔레트 일관성 유지
- [ ] 모바일 최소 44px 터치 타겟 크기
- [ ] 색상 대비 4.5:1 이상 유지
- [ ] 로딩/오류/빈 상태 디자인 포함
- [ ] 애니메이션 duration 200ms 이내
- [ ] 키보드 네비게이션 지원
- [ ] 스크린 리더 호환성 확인

### UX 검증 항목
- [ ] 3번의 클릭/탭으로 주요 기능 접근 가능
- [ ] 오류 발생 시 명확한 해결 방법 제시
- [ ] 사용자 피드백 즉시 표시
- [ ] 개인화 요소 포함
- [ ] 다양한 디바이스에서 테스트 완료 