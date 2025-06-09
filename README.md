# ☕️ Coffee Crawler

한국의 다양한 커피 로스터리 웹사이트에서 원두 정보를 자동으로 수집하는 풀스택 프로젝트입니다.

## 🚀 주요 기능

### 🤖 크롤링 시스템
- **다중 카페 지원**: 8개 주요 커피 브랜드 크롤링
- **OCR 지원**: 이미지에서 원산지/가공방식 정보 추출
- **자동 업데이트**: GitHub Actions로 2주마다 자동 실행
- **실시간 알림**: Discord/Slack 웹훅으로 결과 알림
- **Firebase 연동**: 안정적인 데이터 저장 및 관리

### 🌐 웹 애플리케이션
- Firebase Firestore에서 원두 정보 조회 및 표시
- 원두 상세 정보 페이지 제공
- 원두 필터링 및 검색 기능
- 반응형 디자인 (모바일 및 데스크톱 지원)

## 🏪 지원 카페

| 카페 | 상태 | 특징 |
|------|------|------|
| 센터커피 | ✅ | 원산지/가공방식 완벽 추출 |
| 로우키커피 | ✅ | 원산지/가공방식 완벽 추출 |
| 모모스커피 | ✅ | 기본 정보 성공적 추출 |
| 테일러커피 | ✅ | 기본 정보 성공적 추출 |
| 나무사이로 | ✅ | 기본 정보 성공적 추출 |
| 보난자 | ✅ | 기본 정보 성공적 추출 |
| 테라로사 | ✅ | 기본 정보 성공적 추출 |
| 프릳츠커피 | ⚠️ | 이미지 접근 개선됨, 정보 부재 |

## 🤖 자동화 시스템

### GitHub Actions 워크플로우
```yaml
# 2주마다 자동 실행 (매월 1일, 15일 오전 9시 UTC)
schedule:
  - cron: '0 0 1,15 * *'
```

### 주요 작업
1. **자동 크롤링**: 모든 활성 카페에서 원두 정보 수집
2. **데이터 정규화**: 중복 제거 및 데이터 표준화
3. **Firebase 저장**: 수집된 데이터를 Firestore에 저장
4. **결과 리포트**: JSON 형태로 수집 결과 생성
5. **Discord 알림**: 크롤링 완료 및 오류 알림

## 🛠️ 설치 및 설정

### 1. 저장소 클론 및 의존성 설치
```bash
# 저장소 클론
git clone https://github.com/yourusername/coffee-crawler.git
cd coffee-crawler

# Python 가상 환경 설정
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux

# 의존성 설치
pip install -r requirements.txt

# 웹 애플리케이션 의존성 설치
npm install
```

### 2. Firebase 설정
```bash
# Firebase 프로젝트 생성 및 Firestore 활성화
# 서비스 계정 키 다운로드 후 저장
cp firebase_credentials.json your-service-account-key.json
export GOOGLE_APPLICATION_CREDENTIALS="your-service-account-key.json"
```

### 3. GitHub Secrets 설정
Repository → Settings → Secrets and variables → Actions에서 설정:
```bash
FIREBASE_CREDENTIALS=<Firebase 서비스 계정 JSON 전체 내용>
DISCORD_WEBHOOK=<Discord 웹훅 URL> (선택사항)
```

## 🔧 로컬 실행

### 크롤러 실행
```bash
# 모든 활성 카페 크롤링
python scripts/run_crawler.py --all

# 특정 카페 크롤링
python scripts/run_crawler.py --cafe centercoffee

# 테스트 모드 실행
python scripts/run_crawler.py --cafe fritz --test

# 결과를 파일로 저장 (Firebase 저장 없이)
python scripts/run_crawler.py --all --output data/beans.json --dry-run
```

### 웹 애플리케이션 실행
```bash
# 개발 서버 실행
npm run dev

# 빌드 및 프로덕션 서버 실행
npm run build
npm run start
```

## 📊 데이터 수집 현황

### 성공률: 87.5% (7/8 카페)

#### 완벽 추출 (2개 카페)
- **센터커피**: Ethiopia, Costa Rica + Washed, Honey
- **로우키커피**: 콜롬비아 + 워시드

#### 기본 정보 추출 (5개 카페)
- **모모스커피**: 14,000원 
- **테일러커피**: 12,000~16,000원
- **나무사이로**: 16,000원
- **보난자**: 23,000원 + 브라질 원산지
- **테라로사**: 27,500원

## 🌟 고급 기능

### OCR 기반 정보 추출
- EasyOCR 라이브러리 사용
- **27개국 원산지 지원**: 과테말라, 에티오피아, 케냐, 콜롬비아, 브라질, 코스타리카, 온두라스, 파나마, 페루, 볼리비아, 에콰도르, 베네수엘라, 자메이카, 하와이, 인도, 인도네시아, 베트남, 미얀마, 예멘, 르완다, 부룬디, 탄자니아, 우간다, 짐바브웨, 말라위, 마다가스카르
- **20+ 가공방식 지원**: 워시드, 내추럴, 허니, 펄프드 내추럴, 세미워시드, 웻헐드, 아나에로빅, 카보닉 마세레이션, 더블 퍼멘테이션, 블랙/레드/옐로우/화이트 허니, 워터 프로세스 등

## 📁 프로젝트 구조
```
./
├── coffee_crawler/         # 크롤러 시스템 코어
│   ├── crawlers/          # 카페별 크롤러 구현
│   ├── models/            # 데이터 모델
│   ├── processors/        # 데이터 처리 로직
│   └── utils/             # 유틸리티 함수
├── scripts/               # 실행 스크립트
│   └── run_crawler.py     # 메인 크롤러 실행 스크립트
├── config/                # 설정 파일
│   ├── crawler_config.yaml # 카페별 크롤링 설정
│   └── firebase_config.yaml # Firebase 설정
├── src/                   # Next.js 웹 애플리케이션
├── .github/workflows/     # GitHub Actions 워크플로우
├── data/                  # 크롤링 결과 데이터
├── logs/                  # 로그 파일
└── reports/               # 생성된 리포트
```

## 🔄 자동화 워크플로우

1. **GitHub Actions 트리거**: 2주마다 또는 수동 실행
2. **환경 설정**: Python, 시스템 의존성, Firebase 인증
3. **크롤링 실행**: 모든 활성 카페에서 데이터 수집
4. **데이터 처리**: 정규화, 중복 제거, Firebase 저장
5. **리포트 생성**: 수집 통계 및 결과 요약
6. **알림 전송**: Discord로 완료/오류 알림
7. **아티팩트 업로드**: 수집된 데이터와 로그 보관

## 🐛 문제 해결

### 자주 발생하는 오류
1. **403 Forbidden**: User-Agent, Referer 헤더 추가됨
2. **OCR 오류**: CPU 모드로 강제 실행 설정됨
3. **가격 추출 실패**: 다양한 정규식 패턴 적용됨
4. **Firebase 연결 실패**: 인증 파일 경로 확인 필요

### 로그 확인
```bash
# 크롤링 로그 확인
tail -f logs/crawler.log

# GitHub Actions 결과 확인
# Actions 탭 → 실행된 워크플로우 → Artifacts 다운로드
```

## 🎯 수동 실행 방법

### GitHub Actions에서 수동 실행
1. GitHub 저장소의 "Actions" 탭 이동
2. "Coffee Crawler Auto Update" 워크플로우 선택
3. "Run workflow" 버튼 클릭
4. 옵션 설정:
   - **Test mode**: 테스트 모드 활성화
   - **Specific cafe**: 특정 카페만 실행 (선택사항)
5. "Run workflow" 실행

### 결과 확인
1. 실행된 워크플로우 선택
2. "Artifacts" 섹션에서 결과 다운로드
3. `crawl-results-{번호}.zip` 파일 해제
4. `data/`, `reports/`, `logs/` 폴더 확인

## 📈 향후 계획

- [ ] 추가 카페 지원 확대
- [ ] 가격 변동 트렌드 분석
- [ ] 웹 대시보드 기능 강화
- [ ] API 엔드포인트 제공
- [ ] 모바일 앱 연동

## 🤝 기여하기

1. Fork 후 새로운 브랜치 생성
2. 기능 개발 또는 버그 수정
3. 테스트 코드 작성
4. Pull Request 제출

## 📄 라이선스

MIT License

---

**🚨 주의사항**: 이 크롤러는 교육 및 개인 사용 목적으로만 사용하세요. 각 웹사이트의 robots.txt와 이용약관을 준수해야 합니다.
