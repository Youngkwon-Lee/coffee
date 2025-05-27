# ☕ 원두 자동 동기화 시스템

원두 자동 동기화 시스템은 다양한 커피 로스터리 웹사이트에서 원두 정보를 자동으로 수집하여 Firebase Firestore에 저장하고, 웹 애플리케이션을 통해 보여주는 풀스택 프로젝트입니다.

## 프로젝트 구성

이 프로젝트는 두 가지 주요 구성 요소로 이루어져 있습니다:

1. **크롤러 시스템 (Python)**: 다양한 커피 브랜드 웹사이트에서 원두 정보를 수집하는 자동화된 크롤러
2. **웹 애플리케이션 (Next.js)**: 수집된 원두 정보를 보여주는 웹 인터페이스

## 1. 크롤러 시스템

### 주요 기능
- 다양한 형식의 웹사이트(Shopify, HTML 등) 크롤링 지원
- 수집된 원두 정보 정규화 및 중복 제거
- 기존 데이터와 비교하여 변경사항 감지
- Firebase Firestore에 데이터 저장

### 실행 방법
```bash
# 특정 카페 크롤링
python scripts/run_crawler.py --cafe centercoffee

# 모든 활성화된 카페 크롤링
python scripts/run_crawler.py --all

# 테스트 모드 실행
python scripts/run_crawler.py --cafe fritz --test
```

자세한 내용은 [크롤러 README](./coffee_crawler/README.md)를 참조하세요.

## 2. 웹 애플리케이션

### 주요 기능
- Firebase Firestore에서 원두 정보 조회 및 표시
- 원두 상세 정보 페이지 제공
- 원두 필터링 및 검색 기능
- 반응형 디자인 (모바일 및 데스크톱 지원)

### 실행 방법
```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프로덕션 서버 실행
npm run start
```

### 웹 애플리케이션 기술 스택
- [Next.js](https://nextjs.org) - React 프레임워크
- [Tailwind CSS](https://tailwindcss.com) - 스타일링
- [Firebase](https://firebase.google.com) - 백엔드 및 데이터베이스

## 설치 및 설정

### 요구사항
- Python 3.8 이상
- Node.js 18 이상
- Firebase 계정

### 설치 단계
1. 저장소 클론
   ```bash
   git clone https://github.com/yourusername/coffee-crawler.git
   cd coffee-crawler
   ```

2. 크롤러 설정
   ```bash
   # Python 가상 환경 설정
   python -m venv venv
   venv\Scripts\activate  # Windows
   source venv/bin/activate  # macOS/Linux

   # 의존성 설치
   pip install -r requirements.txt

   # 설정 파일 구성
   cp config/crawler_config.yaml.example config/crawler_config.yaml
   cp config/firebase_config.yaml.example config/firebase_config.yaml
   ```

3. 웹 애플리케이션 설정
   ```bash
   # 의존성 설치
   npm install

   # 환경 변수 설정
   cp .env.example .env.local
   ```

4. Firebase 설정
   - Firebase 콘솔에서 새 프로젝트 생성
   - Firestore 데이터베이스 생성
   - 서비스 계정 키 다운로드 및 `secret/serviceAccountKey.json`에 저장

## 프로젝트 구조
```
./
├── coffee_crawler/         # 크롤러 시스템
├── src/                    # 웹 애플리케이션 소스 코드
├── config/                 # 설정 파일
├── scripts/                # 실행 스크립트
├── tests/                  # 테스트 코드
├── public/                 # 정적 파일
└── logs/                   # 로그 파일
```

## 개발 체크리스트
현재 진행 상황은 [원두자동동기화_체크리스트.md](./원두자동동기화_체크리스트.md) 파일에서 확인할 수 있습니다.

## 기여 방법
이 프로젝트에 기여하고 싶으시다면 다음 단계를 따르세요:

1. 이 저장소를 포크합니다.
2. 새 기능 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경 사항을 커밋합니다 (`git commit -m 'Add some amazing feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다.

## 라이선스
이 프로젝트는 MIT 라이선스를 따릅니다.

# 커피 원두 크롤러

GitHub Actions를 사용하여 자동으로 커피 원두 정보를 수집하는 크롤러입니다.

## 기능

- 매주 월요일 UTC 03:00 (한국시간 12:00)에 자동으로 실행
- 주요 커피 사이트에서 원두 정보 수집
- 수집한 데이터는 JSON 형식으로 저장
- 이전 데이터와 비교하여 변경사항 확인

## 수동 실행 방법

1. GitHub 저장소의 "Actions" 탭으로 이동
2. "Coffee Bean Crawler" 워크플로우 선택
3. "Run workflow" 버튼 클릭
4. "Run workflow" 확인

## 데이터 확인 방법

1. GitHub 저장소의 "Actions" 탭으로 이동
2. 실행된 워크플로우 선택
3. "Artifacts" 섹션에서 "crawling-results-{번호}" 다운로드
4. 압축 파일 해제 후 `data` 폴더 내 JSON 파일 확인

## 로컬 환경에서 실행 방법

```bash
# 의존성 설치
pip install -r requirements.txt

# 크롤러 실행
python scripts/run_crawler.py --all --output data/beans_manual.json
```

## 주의사항

- 크롤링은 해당 웹사이트의 이용약관을 준수하여 사용해야 합니다.
- 과도한 요청은 IP 차단의 원인이 될 수 있습니다.
