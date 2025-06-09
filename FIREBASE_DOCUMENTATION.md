# 🔥 Firebase 데이터베이스 구조 문서

## 📊 **컬렉션 개요**

현재 Firebase Firestore에는 다음 컬렉션들이 있습니다:

```
coffee-37b81 (프로젝트)
├── beans/              # 원두 정보 (메인 컬렉션)
├── cafes/              # 카페 정보
├── monthlyBeans/       # 월간 원두 데이터
├── records/            # 크롤링 기록
└── users/              # 사용자 정보 및 개인화 데이터
    └── [userId]/
        └── favorites_beans/  # 사용자별 찜 목록
```

---

## 🌱 **beans 컬렉션 (메인)**

### **데이터 구조**
```json
{
  "name": "원두명",
  "brand": "카페명/브랜드명",
  "price": "15,000원",
  "origin": "에티오피아",
  "roast": "중배전",
  "flavor": "초콜릿, 너트, 과일",
  "process": "워시드",
  "variety": "헤이룸",
  "producer": "농장명",
  "region": "지역명",
  "altitude": "1,800m",
  "category": "원두",
  "image": "이미지_URL",
  "link": "상품_URL",
  "flavor_notes": "상세_향미_설명",
  "createdAt": "2025-06-09T14:54:50.000Z",
  "lastUpdated": "2025-06-09T14:54:50.000Z",
  "isActive": true
}
```

### **필드 설명**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | string | ✅ | 원두 제품명 |
| `brand` | string | ✅ | 카페/브랜드명 |
| `price` | string | ✅ | 가격 ("15,000원" 형태) |
| `origin` | string | ❌ | 원산지 (국가/지역) |
| `roast` | string | ❌ | 로스팅 정도 (라이트, 미디엄, 다크 등) |
| `flavor` | string | ❌ | 향미 노트 (쉼표로 구분) |
| `process` | string | ❌ | 가공방식 (워시드, 내추럴, 허니 등) |
| `variety` | string | ❌ | 커피 품종 (아라비카, 게이샤 등) |
| `producer` | string | ❌ | 생산농장/농부명 |
| `region` | string | ❌ | 세부 지역 |
| `altitude` | string | ❌ | 재배 고도 |
| `category` | string | ❌ | 상품 카테고리 (원두, 드립백 등) |
| `image` | string | ❌ | 대표 이미지 URL |
| `link` | string | ❌ | 상품 상세페이지 URL |
| `flavor_notes` | string | ❌ | 상세 향미 설명 |
| `createdAt` | timestamp | ✅ | 생성 시간 |
| `lastUpdated` | timestamp | ✅ | 마지막 업데이트 시간 |
| `isActive` | boolean | ✅ | 활성화 상태 (판매 중/단종) |

### **인덱스 설정**
- `brand` (카페별 필터링용)
- `isActive` (활성 상품 조회용)
- `createdAt` (최신순 정렬용)
- `price` (가격대별 필터링용)

---

## 🏪 **cafes 컬렉션**

카페/브랜드 기본 정보를 저장합니다.

```json
{
  "id": "centercoffee",
  "name": "센터커피",
  "website": "https://centercoffee.co.kr",
  "description": "스페셜티 커피 전문점",
  "location": "서울",
  "isActive": true,
  "crawlConfig": {
    "enabled": true,
    "lastCrawled": "2025-06-09T14:54:50.000Z",
    "crawlInterval": "weekly"
  }
}
```

---

## 📅 **monthlyBeans 컬렉션**

월별 원두 통계 및 트렌드 데이터를 저장합니다.

```json
{
  "year": 2025,
  "month": 6,
  "totalBeans": 150,
  "newBeans": 25,
  "discontinuedBeans": 8,
  "topBrands": ["센터커피", "기미사", "로우키"],
  "avgPrice": 28500,
  "popularOrigins": ["에티오피아", "콜롬비아", "파나마"],
  "createdAt": "2025-06-01T00:00:00.000Z"
}
```

---

## 📋 **records 컬렉션**

크롤링 작업 기록을 저장합니다.

```json
{
  "crawlId": "crawl_2025060901",
  "startTime": "2025-06-09T14:54:50.000Z",
  "endTime": "2025-06-09T14:55:20.000Z",
  "totalCafes": 12,
  "successfulCafes": 11,
  "totalBeans": 127,
  "newBeans": 15,
  "updatedBeans": 8,
  "failedCafes": ["fritzcoffee"],
  "status": "completed",
  "errors": []
}
```

---

## 👤 **users 컬렉션**

사용자 정보 및 개인화 데이터를 저장합니다.

### **users/[userId] 구조**
```json
{
  "uid": "user_firebase_uid",
  "email": "user@example.com",
  "displayName": "사용자명",
  "preferences": {
    "favoriteRoast": "medium",
    "favoriteOrigins": ["ethiopia", "colombia"],
    "preferredPriceRange": [20000, 50000]
  },
  "createdAt": "2025-06-09T14:54:50.000Z",
  "lastActive": "2025-06-09T14:54:50.000Z"
}
```

### **users/[userId]/favorites_beans 구조**
```json
{
  "beanId": {
    "addedAt": "2025-06-09T14:54:50.000Z",
    "notes": "개인 메모 (선택사항)"
  }
}
```

---

## 🔐 **Firebase Authentication 설정**

### **인증 제공업체**
- ✅ **Google 로그인** (Gmail 계정으로 로그인)
- ❌ 이메일/비밀번호 (현재 비활성화)
- ❌ 익명 로그인 (현재 비활성화)

### **보안 규칙 (Firestore Rules)**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // beans 컬렉션: 모든 사용자 읽기 가능, 관리자만 쓰기 가능
    match /beans/{beanId} {
      allow read: if true;
      allow write: if false; // 크롤러만 서버 사이드에서 업데이트
    }
    
    // cafes 컬렉션: 모든 사용자 읽기 가능
    match /cafes/{cafeId} {
      allow read: if true;
      allow write: if false;
    }
    
    // users 컬렉션: 본인 데이터만 읽기/쓰기 가능
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // 찜 목록: 본인만 관리 가능
      match /favorites_beans/{beanId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // 통계 데이터: 읽기만 가능
    match /monthlyBeans/{docId} {
      allow read: if true;
      allow write: if false;
    }
    
    match /records/{docId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

### **웹앱에서 인증 사용법**

```typescript
// 로그인
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/firebase";

const provider = new GoogleAuthProvider();
await signInWithPopup(auth, provider);

// 로그아웃
import { signOut } from "firebase/auth";
await signOut(auth);

// 인증 상태 감지
import { onAuthStateChanged } from "firebase/auth";
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("로그인됨:", user.email);
  } else {
    console.log("로그아웃됨");
  }
});
```

---

## 🔄 **자동화 시스템 플로우**

### **크롤링 → Firebase 업데이트 과정**

1. **GitHub Actions** (매월 1일, 15일 실행)
2. **크롤러 실행** → 각 카페 웹사이트에서 원두 정보 수집
3. **데이터 정규화** → Bean 모델로 변환
4. **Firebase 업데이트**:
   - 기존 원두: 가격/정보 변경 감지 후 업데이트
   - 신규 원두: `createdAt` 설정 후 추가
   - 사라진 원두: 2주 후 `isActive: false`로 설정
5. **통계 업데이트** → `monthlyBeans`, `records` 컬렉션 업데이트
6. **Discord 알림** (선택사항)

### **웹앱 실시간 연동**

```typescript
// 실시간 원두 목록 조회
import { collection, onSnapshot, query, where } from "firebase/firestore";

const beansQuery = query(
  collection(db, "beans"),
  where("isActive", "==", true)
);

onSnapshot(beansQuery, (snapshot) => {
  const beans = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  // UI 업데이트
});
```

---

## 📈 **성능 최적화**

### **인덱스 최적화**
- `brand + isActive` (카페별 활성 원두 조회)
- `createdAt desc` (최신 원두 조회)
- `price asc/desc` (가격순 정렬)

### **쿼리 최적화**
- 페이지네이션 사용 (`limit()` + `startAfter()`)
- 필요한 필드만 조회 (`select()`)
- 복합 인덱스 활용

### **비용 최적화**
- 불필요한 실시간 리스너 제거
- 배치 작업으로 대량 업데이트
- 이미지는 Cloud Storage 활용 (현재는 외부 URL)

---

## 🛠 **관리 도구**

### **Firebase Console**
- **프로젝트**: https://console.firebase.google.com/project/coffee-37b81
- **Firestore**: 데이터 직접 조회/수정
- **Authentication**: 사용자 관리
- **Functions**: 서버리스 함수 (향후 확장)

### **로컬 관리 스크립트**
```bash
# Firebase 연결 테스트
python check_firebase.py

# 수동 크롤링 실행
python scripts/run_crawler.py --all

# 특정 카페만 크롤링
python scripts/run_crawler.py --cafe centercoffee

# 통계 확인
python scripts/analyze_data.py
```

---

## 🚀 **향후 확장 계획**

1. **알림 시스템**: 새 원두/가격 변동 시 개인화된 알림
2. **추천 시스템**: 취향 기반 원두 추천 알고리즘
3. **리뷰 시스템**: 사용자 원두 리뷰 및 평점
4. **재고 추적**: 품절/재입고 알림
5. **가격 히스토리**: 원두별 가격 변동 추적
6. **이미지 최적화**: Cloud Storage + CDN 활용
7. **서버리스 함수**: 복잡한 비즈니스 로직 처리

---

*최종 업데이트: 2025-06-09* 