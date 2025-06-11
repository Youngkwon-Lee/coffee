# ☕ Coffee Journey - 개인 맞춤형 커피 플랫폼

## 📋 프로젝트 개요

**Coffee Journey**는 사용자의 커피 경험을 기록하고 분석하여 개인 맞춤형 원두 추천과 카페 큐레이션을 제공하는 Next.js 기반 웹 플랫폼입니다.

## 🚀 주요 기능

### 1. 커피 기록 시스템
- 📝 수동 기록 (원두명, 향미, 추출 방법, 평점)
- 📷 OCR 기반 자동 기록 (Google Cloud Vision API)
- 📊 개인화된 통계 및 분석

### 2. 카페 탐색
- 🗺️ 지도 기반 카페 검색
- 🎯 취향 기반 카페 추천
- 🌤️ 날씨 기반 추천 시스템

### 3. 원두 카탈로그
- ☕ 다양한 원두 정보 제공
- 🔍 필터링 및 검색 기능
- ⭐ 개인화된 추천 알고리즘

### 4. 개인화 서비스
- 📧 주간 커피 리포트
- 📈 취향 분석 및 트렌드
- 🎨 맞춤형 UI/UX

## 🛠️ 기술 스택

### Frontend
- **Next.js 15.3.1** - React 19 메타프레임워크
- **TypeScript 5** - 정적 타입 검사
- **Tailwind CSS 3.4.17** - 유틸리티 기반 스타일링
- **Framer Motion 12.9.4** - 고급 애니메이션
- **Zustand 5.0.4** - 상태 관리
- **React Firebase Hooks 5.1.1** - Firebase 연동

### Backend & Infrastructure
- **Firebase 11.6.1** - 인증, Firestore, 호스팅
- **Firebase Admin 13.4.0** - 서버 사이드 관리
- **Google Cloud Vision API 5.1.0** - OCR 및 이미지 분석
- **OpenAI API 5.1.1** - GPT 기반 AI 분석 및 추천
- **Vercel** - 배포 및 호스팅

### Additional Libraries
- **@react-google-maps/api** - 구글 지도 연동
- **Fuse.js** - 퍼지 검색
- **Recharts** - 데이터 시각화
- **Day.js** - 날짜 처리
- **Heroicons** - 아이콘 시스템

### 크롤링 시스템
- **Python** - 웹 크롤링
- **BeautifulSoup** - HTML 파싱
- **Selenium** - 동적 콘텐츠 처리

## 📁 프로젝트 구조

```
coffee/
├── app/                    # Next.js App Router
│   ├── components/         # 공통 컴포넌트
│   ├── beans/             # 원두 페이지
│   ├── cafes/             # 카페 페이지
│   ├── record/            # 기록 페이지
│   └── api/               # API 라우트
├── coffee_crawler/        # 웹 크롤링 시스템
├── src/                   # 유틸리티 및 설정
├── docs/                  # 프로젝트 문서
└── public/                # 정적 자원
```

## 🎨 색상 시스템

### 통일된 색상 팔레트 (3가지)
- **🟠 주황색 (Primary)**: `from-amber-500 to-orange-500` - 메인 액션
- **🟣 보라색 (Secondary)**: `from-purple-500 to-indigo-500` - 기록/분석
- **⚪ 회색 (Neutral)**: `from-gray-600 to-gray-700` - 보조 기능

## 📱 반응형 디자인

- **모바일 우선** 설계
- **Tailwind CSS** 반응형 유틸리티 활용
- **터치 친화적** 인터페이스

## 🔗 관련 문서

- [UI/UX 디자인 가이드](./ui-ux-guide.md)
- [크롤링 시스템 가이드](./crawling-system.md)
- [프론트엔드 개발 가이드](./frontend-guide.md)
- [백엔드 개발 가이드](./backend-guide.md)
- [체크리스트](./checklist.md)

## 🌐 배포 정보

- **Production URL**: https://coffee-1spg0tilx-22s-projects-de7c705f.vercel.app
- **Platform**: Vercel
- **Environment**: Node.js 18+

## 📄 라이선스

이 프로젝트는 개인 프로젝트입니다. 