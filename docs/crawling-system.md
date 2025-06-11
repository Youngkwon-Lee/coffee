# 🕷️ 크롤링 시스템 가이드

## 📁 시스템 구조

```
coffee_crawler/
├── __init__.py                 # 패키지 초기화
├── README.md                   # 크롤링 시스템 문서
├── crawlers/                   # 크롤러 모듈
│   ├── base_crawler.py         # 기본 크롤러 클래스
│   ├── html_crawler.py         # HTML 페이지 크롤러
│   ├── shopify_rss_crawler.py  # Shopify RSS 크롤러
│   └── selenium_crawler.py     # Selenium 기반 크롤러
├── models/                     # 데이터 모델
│   ├── bean.py                 # 원두 모델
│   └── cafe.py                 # 카페 모델
├── processors/                 # 데이터 처리 모듈
│   ├── bean_mapper.py          # 원두 매핑
│   ├── change_detector.py      # 변경 감지
│   ├── duplicate_checker.py    # 중복 검사
│   └── normalizer.py           # 데이터 정규화
├── storage/                    # 저장소 모듈
│   ├── bean_repository.py      # 원두 저장소
│   ├── batch_processor.py      # 일괄 처리
│   └── firebase_client.py      # Firebase 클라이언트
└── utils/                      # 유틸리티 모듈
    ├── config_loader.py        # 설정 로더
    ├── http_client.py          # HTTP 클라이언트
    ├── logger.py               # 로거
    ├── notification.py         # 알림 시스템
    └── sample_data.py          # 샘플 데이터 생성
```

## 🎯 주요 기능

### 1. 카페 정보 크롤링
- **네이버 플레이스** 카페 정보 수집
- **카카오맵** 위치 및 리뷰 정보
- **인스타그램** 해시태그 기반 이미지

### 2. 원두 정보 크롤링
- **온라인 쇼핑몰** 원두 상품 정보
- **로스터리 웹사이트** 상세 스펙
- **커피 리뷰 사이트** 평점 및 후기

### 3. 데이터 처리
- **중복 제거** 및 정규화
- **AI 기반 분류** (향미, 특징)
- **이미지 최적화** 및 저장

## 🛠️ 기술 스택

### 크롤링 도구
```python
# 필수 라이브러리
import requests           # HTTP 요청
import beautifulsoup4     # HTML 파싱
import selenium          # 동적 콘텐츠
import scrapy            # 대규모 크롤링
```

### 데이터 처리
```python
# 데이터 처리
import pandas            # 데이터 분석
import numpy             # 수치 계산
import pillow            # 이미지 처리
import opencv-python     # 이미지 분석
```

### AI/ML 도구
```python
# AI 분석
import openai            # GPT API
import transformers      # 자연어 처리
import scikit-learn      # 머신러닝
```

## 🔧 설정 및 실행

### 환경 설정
```bash
# 가상환경 생성
python -m venv crawler_env

# 가상환경 활성화 (Windows)
crawler_env\Scripts\activate

# 가상환경 활성화 (Mac/Linux)
source crawler_env/bin/activate

# 의존성 설치
pip install -r requirements.txt
```

### 환경 변수
```bash
# .env 파일 생성
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
OPENAI_API_KEY=your_openai_key
NAVER_CLIENT_ID=your_naver_id
NAVER_CLIENT_SECRET=your_naver_secret
```

### 실행 방법
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

## 📊 데이터 모델

### 카페 데이터 구조
```python
@dataclass
class CafeData:
    id: str                          # 고유 ID
    name: str                        # 카페명
    address: str                     # 주소
    lat: float                       # 위도
    lng: float                       # 경도
    phone: Optional[str]             # 전화번호
    hours: Optional[str]             # 운영시간
    rating: Optional[float]          # 평점
    review_count: Optional[int]      # 리뷰 수
    tags: List[str]                  # 태그
    features: Dict[str, bool]        # 특징
    menu: List[Dict]                 # 메뉴
    images: List[str]                # 이미지 URL
    flavor_profile: Optional[str]    # 향미 프로필
    price_range: Optional[str]       # 가격대
    created_at: datetime             # 생성일
    updated_at: datetime             # 수정일
```

### 원두 데이터 구조
```python
@dataclass  
class BeanData:
    id: str                          # 고유 ID
    name: str                        # 원두명
    brand: str                       # 브랜드
    origin: str                      # 원산지
    variety: Optional[str]           # 품종
    process: Optional[str]           # 가공 방법
    roast_level: Optional[str]       # 로스팅 레벨
    flavor_notes: List[str]          # 향미 노트
    price: Optional[float]           # 가격
    weight: Optional[str]            # 무게
    description: Optional[str]       # 설명
    images: List[str]                # 이미지 URL
    rating: Optional[float]          # 평점
    reviews: List[Dict]              # 리뷰
    availability: bool               # 재고 여부
    created_at: datetime             # 생성일
    updated_at: datetime             # 수정일
```

## 🔄 크롤링 워크플로우

### 1. 데이터 수집
```python
# 기본 크롤러 클래스
class BaseCrawler:
    def __init__(self, config):
        self.config = config
        self.session = requests.Session()
        
    def crawl(self, target_url):
        """기본 크롤링 메서드"""
        response = self.session.get(target_url)
        return self.parse(response)
        
    def parse(self, response):
        """HTML 파싱 (오버라이드 필요)"""
        raise NotImplementedError
```

### 2. 데이터 검증
```python
class DataValidator:
    @staticmethod
    def validate_cafe(data: CafeData) -> bool:
        """카페 데이터 유효성 검사"""
        if not data.name or not data.address:
            return False
        if not (-90 <= data.lat <= 90):
            return False
        if not (-180 <= data.lng <= 180):
            return False
        return True
```

### 3. 중복 제거
```python
class DuplicateRemover:
    def __init__(self):
        self.existing_ids = set()
        
    def is_duplicate(self, data) -> bool:
        """중복 데이터 확인"""
        unique_key = f"{data.name}_{data.address}"
        if unique_key in self.existing_ids:
            return True
        self.existing_ids.add(unique_key)
        return False
```

### 4. AI 분석
```python
class AIProcessor:
    def __init__(self, openai_key):
        self.client = openai.OpenAI(api_key=openai_key)
        
    def analyze_flavor(self, description: str) -> List[str]:
        """향미 분석"""
        prompt = f"다음 커피 설명에서 향미를 추출해주세요: {description}"
        response = self.client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}]
        )
        return self.parse_flavors(response.choices[0].message.content)
```

## ⚡ 성능 최적화

### 동시성 처리
```python
import asyncio
import aiohttp

class AsyncCrawler:
    async def crawl_multiple(self, urls):
        """비동기 다중 크롤링"""
        async with aiohttp.ClientSession() as session:
            tasks = [self.crawl_single(session, url) for url in urls]
            return await asyncio.gather(*tasks)
```

### 캐싱 전략
```python
import redis
from functools import wraps

def cached(expire_time=3600):
    """Redis 캐싱 데코레이터"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = f"{func.__name__}:{hash(str(args) + str(kwargs))}"
            cached_result = redis_client.get(key)
            if cached_result:
                return pickle.loads(cached_result)
            result = func(*args, **kwargs)
            redis_client.setex(key, expire_time, pickle.dumps(result))
            return result
        return wrapper
    return decorator
```

### 요청 제한
```python
import time
from datetime import datetime, timedelta

class RateLimiter:
    def __init__(self, max_requests=100, time_window=3600):
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = []
        
    def wait_if_needed(self):
        """요청 제한 확인 및 대기"""
        now = datetime.now()
        # 시간 윈도우 내 요청 필터링
        self.requests = [req_time for req_time in self.requests 
                        if now - req_time < timedelta(seconds=self.time_window)]
        
        if len(self.requests) >= self.max_requests:
            sleep_time = self.time_window - (now - self.requests[0]).total_seconds()
            time.sleep(max(0, sleep_time))
            
        self.requests.append(now)
```

## 🚨 에러 처리

### 재시도 메커니즘
```python
import time
from functools import wraps

def retry(max_attempts=3, delay=1, backoff=2):
    """재시도 데코레이터"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            attempts = 0
            current_delay = delay
            
            while attempts < max_attempts:
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    attempts += 1
                    if attempts == max_attempts:
                        raise e
                    time.sleep(current_delay)
                    current_delay *= backoff
                    
        return wrapper
    return decorator
```

### 로깅 시스템
```python
import logging
from datetime import datetime

class CrawlerLogger:
    def __init__(self, name):
        self.logger = logging.getLogger(name)
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)
        
    def log_crawl_start(self, target):
        self.logger.info(f"크롤링 시작: {target}")
        
    def log_crawl_success(self, target, count):
        self.logger.info(f"크롤링 완료: {target} - {count}개 수집")
        
    def log_crawl_error(self, target, error):
        self.logger.error(f"크롤링 실패: {target} - {error}")
```

## 📈 모니터링

### 진행 상황 추적
```python
from tqdm import tqdm
import json

class ProgressTracker:
    def __init__(self, total_items):
        self.total = total_items
        self.processed = 0
        self.progress_bar = tqdm(total=total_items, desc="크롤링 진행")
        
    def update(self, increment=1):
        self.processed += increment
        self.progress_bar.update(increment)
        
    def save_checkpoint(self, filename="checkpoint.json"):
        """진행 상황 저장"""
        checkpoint = {
            "total": self.total,
            "processed": self.processed,
            "timestamp": datetime.now().isoformat()
        }
        with open(filename, 'w') as f:
            json.dump(checkpoint, f)
```

## 🔒 보안 고려사항

### User-Agent 로테이션
```python
import random

class UserAgentRotator:
    def __init__(self):
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
        ]
        
    def get_random_ua(self):
        return random.choice(self.user_agents)
```

### 프록시 관리
```python
class ProxyManager:
    def __init__(self, proxy_list):
        self.proxies = proxy_list
        self.current_index = 0
        
    def get_next_proxy(self):
        proxy = self.proxies[self.current_index]
        self.current_index = (self.current_index + 1) % len(self.proxies)
        return proxy
```

## 📅 스케줄링

### Cron 작업 설정
```bash
# 매일 새벽 2시 크롤링 실행
0 2 * * * /path/to/python /path/to/coffee_crawler/main.py

# 매주 일요일 전체 데이터 갱신
0 1 * * 0 /path/to/python /path/to/coffee_crawler/main.py --full-update
```

### Python 스케줄러
```python
import schedule
import time

def daily_crawl():
    """일일 크롤링 작업"""
    crawler = CafeCrawler()
    crawler.run_incremental()

def weekly_full_update():
    """주간 전체 업데이트"""
    crawler = CafeCrawler()
    crawler.run_full_update()

# 스케줄 설정
schedule.every().day.at("02:00").do(daily_crawl)
schedule.every().sunday.at("01:00").do(weekly_full_update)

# 스케줄러 실행
while True:
    schedule.run_pending()
    time.sleep(60)
``` 