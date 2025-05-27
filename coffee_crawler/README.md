# ☕ Coffee Crawler (원두 자동 동기화 시스템)

## 소개
Coffee Crawler는 다양한 커피 로스터리 웹사이트에서 원두 정보를 자동으로 수집하여 Firebase Firestore에 저장하는 시스템입니다. 이 프로젝트는 다음과 같은 기능을 제공합니다:

- 다양한 형식의 웹사이트(Shopify, HTML, 동적 로딩 페이지 등) 크롤링 지원
- 수집된 원두 정보 정규화 및 중복 제거
- 기존 데이터와 비교하여 변경사항 감지
- Firebase Firestore에 데이터 저장
- 크롤링 성공/실패 시 알림 기능

## 설치 방법

### 요구사항
- Python 3.8 이상
- pip (파이썬 패키지 관리자)
- Chrome 웹 브라우저 (Selenium 크롤러 사용 시)

### 설치 단계
1. 저장소 클론
   ```bash
   git clone https://github.com/yourusername/coffee-crawler.git
   cd coffee-crawler
   ```

2. 가상 환경 생성 및 활성화
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate

   # macOS/Linux
   python -m venv venv
   source venv/bin/activate
   ```

3. 의존성 설치
   ```bash
   pip install -r requirements.txt
   ```

4. 설정 파일 구성
   ```bash
   # config 디렉토리에 설정 파일 생성
   cp config/crawler_config.yaml.example config/crawler_config.yaml
   cp config/firebase_config.yaml.example config/firebase_config.yaml
   ```

## 사용 방법

### 기본 사용법
```bash
# 특정 카페 크롤링
python scripts/run_crawler.py --cafe centercoffee

# 모든 활성화된 카페 크롤링
python scripts/run_crawler.py --all

# 테스트 모드 (제한된 데이터만 수집)
python scripts/run_crawler.py --cafe fritz --test

# 결과를 파일로 저장 (Firebase에 저장하지 않음)
python scripts/run_crawler.py --cafe centercoffee --output beans.json --dry-run

# 로깅 레벨 조정
python scripts/run_crawler.py --cafe centercoffee --verbose

# 알림 활성화
python scripts/run_crawler.py --cafe centercoffee --notify
```

### 설정 파일 구성

#### crawler_config.yaml
```yaml
# 크롤러 기본 설정
crawler:
  user_agent: "Coffee Bean Crawler/0.1.0"
  request_timeout: 30
  retry_count: 3
  retry_delay: 5

# 카페별 크롤러 설정
cafes:
  centercoffee:
    label: "센터커피"
    type: "selenium"  # 동적 로딩 페이지를 위한 Selenium 크롤러 사용
    url: "https://centercoffee.co.kr/collections/coffee"
    schedule: "0 0 * * 1"  # 매주 월요일 자정
    active: true
    headless: true  # 헤드리스 모드 활성화
    wait_timeout: 10  # 페이지 로딩 대기 시간 (초)
    selectors:
      product_list_container: ".product-list"
      product_item: ".product-item"
      product_link: "a.product-item__link"
      product_title: ".product-item__title"
      product_price: ".product-item__price"
      product_image: "img.product-image"
      fetch_product_detail: true  # 상세 페이지도 크롤링
      product_detail_container: ".product-detail"
      product_description: ".product-description"

  fritz:
    label: "프릳츠커피"
    type: "html"
    url: "https://fritz.co.kr/shop/beans"
    schedule: "0 0 1 * *"  # 매월 1일 자정
    active: true
    selectors:
      products: ".product-item"
      name: ".product-title"
      price: ".product-price"
      image: "img.product-image"
```

#### firebase_config.yaml
```yaml
firebase:
  project_id: "your-firebase-project-id"
  auth_method: "key_file"  # 'env_var' 또는 'key_file'
  key_file_path: "secret/serviceAccountKey.json"
  
  firestore:
    collection_beans: "beans"
    collection_cafes: "cafes"
    collection_logs: "crawl_logs"
```

### 알림 설정

알림 기능을 사용하려면 다음 환경 변수를 설정하세요:

#### 이메일 알림
```bash
# 이메일 알림 활성화
export NOTIFICATION_EMAIL_ENABLED=true
export NOTIFICATION_EMAIL_FROM=your-email@gmail.com
export NOTIFICATION_EMAIL_TO=recipient@example.com
export NOTIFICATION_EMAIL_SMTP_HOST=smtp.gmail.com
export NOTIFICATION_EMAIL_SMTP_PORT=587
export NOTIFICATION_EMAIL_USERNAME=your-email@gmail.com
export NOTIFICATION_EMAIL_PASSWORD=your-app-password
```

#### Slack 알림
```bash
# Slack 알림 활성화
export NOTIFICATION_SLACK_ENABLED=true
export NOTIFICATION_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/xxx/xxx
```

#### Discord 알림
```bash
# Discord 알림 활성화
export NOTIFICATION_DISCORD_ENABLED=true
export NOTIFICATION_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx/xxx
```

## 프로젝트 구조
```
coffee_crawler/
├── crawlers/              # 크롤러 모듈
│   ├── base_crawler.py    # 기본 크롤러 클래스
│   ├── html_crawler.py    # HTML 페이지 크롤러
│   ├── shopify_rss_crawler.py  # Shopify RSS 크롤러
│   └── selenium_crawler.py  # Selenium 기반 크롤러
│
├── models/                # 데이터 모델
│   ├── bean.py            # 원두 모델
│   └── cafe.py            # 카페 모델
│
├── processors/            # 데이터 처리 모듈
│   ├── bean_mapper.py     # 원두 매핑
│   ├── change_detector.py # 변경 감지
│   ├── duplicate_checker.py # 중복 검사
│   └── normalizer.py      # 데이터 정규화
│
├── storage/               # 데이터 저장 모듈
│   ├── bean_repository.py # 원두 저장소
│   ├── batch_processor.py # 일괄 처리
│   └── firebase_client.py # Firebase 클라이언트
│
├── utils/                 # 유틸리티 함수
│   ├── config_loader.py   # 설정 로더
│   ├── http_client.py     # HTTP 클라이언트
│   ├── logger.py          # 로거
│   ├── notification.py    # 알림 시스템
│   └── sample_data.py     # 샘플 데이터 생성
│
├── __init__.py            # 패키지 초기화
└── README.md              # 이 문서
```

## 테스트
```bash
# 모든 테스트 실행
python -m pytest tests/

# 특정 테스트 실행
python -m pytest tests/test_html_crawler.py

# 테스트 커버리지 확인
python -m pytest --cov=coffee_crawler tests/
```

## 크롤러 확장하기

### 새로운 크롤러 추가
새로운 크롤러를 추가하려면 다음 단계를 따르세요:

1. `crawlers` 디렉토리에 새로운 크롤러 클래스 파일 생성
2. `BaseCrawler` 클래스 상속
3. `_crawl_impl` 메서드 구현
4. `config/crawler_config.yaml`에 새 크롤러 설정 추가
5. `coffee_crawler/crawlers/__init__.py`에 크롤러 등록

예시:
```python
from coffee_crawler.crawlers.base_crawler import BaseCrawler

class CustomCrawler(BaseCrawler):
    def _crawl_impl(self, test_mode=False):
        # 크롤링 로직 구현
        return beans_data
```

### Selenium 크롤러 사용
동적 로딩 페이지를 크롤링해야 할 경우 Selenium 크롤러를 사용하세요:

1. `config/crawler_config.yaml` 파일에서 `type`을 `selenium`으로 설정
2. 필요한 Selenium 관련 설정 추가 (headless 모드, 대기 시간 등)
3. CSS 선택자 설정

예시:
```yaml
mycafe:
  label: "내 카페"
  type: "selenium"
  url: "https://example.com/coffee"
  active: true
  headless: true
  wait_timeout: 10
  page_load_delay: 2
  selectors:
    product_list_container: ".products"
    product_item: ".product"
    product_link: "a"
    product_title: ".title"
    product_price: ".price"
    product_image: "img"
```

## 주의사항
- 과도한 요청을 방지하기 위해 적절한 지연 시간을 설정하세요.
- 각 웹사이트의 robots.txt 및 이용약관을 준수하세요.
- 크롤링 실패 시 로그를 확인하여 문제를 해결하세요.
- 한글 인코딩 문제가 발생할 경우 정규화 모듈에서 자동으로 처리됩니다.

## 라이선스
이 프로젝트는 MIT 라이선스를 따릅니다. 