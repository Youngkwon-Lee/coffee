# 🚀 백엔드 개발 가이드

## 🏗️ 아키텍처 개요

### 서버리스 아키텍처
```
Client (Next.js) 
    ↓ HTTP/HTTPS
API Routes (Next.js)
    ↓ SDK
Firebase Services
    ├── Authentication (사용자 인증)
    ├── Firestore (데이터베이스)
    ├── Storage (파일 저장)
    └── Functions (서버리스 함수)
    ↓ REST API
External APIs
    ├── Google Cloud Vision (OCR)
    ├── OpenAI API (AI 분석)
    └── Weather API (날씨 정보)
```

## 🔥 Firebase 설정

### 프로젝트 초기화
```typescript
// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCcy5cm_7diVnjW0EmbejXWzvwqsDr53gw",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "coffee-37b81.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "coffee-37b81",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "coffee-37b81.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "931541737029",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:931541737029:web:3f24a512e5c157f837cd2c",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-FGG9QFL7M9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
```

### 인증 시스템
```typescript
// utils/auth.ts
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User
} from 'firebase/auth';
import { auth } from '@/firebase';

export class AuthService {
  private googleProvider = new GoogleAuthProvider();

  async signInWithEmail(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { user: userCredential.user, error: null };
    } catch (error) {
      return { user: null, error: error.message };
    }
  }

  async signUpWithEmail(email: string, password: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return { user: userCredential.user, error: null };
    } catch (error) {
      return { user: null, error: error.message };
    }
  }

  async signInWithGoogle() {
    try {
      const result = await signInWithPopup(auth, this.googleProvider);
      return { user: result.user, error: null };
    } catch (error) {
      return { user: null, error: error.message };
    }
  }

  async signOut() {
    try {
      await signOut(auth);
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getCurrentUser(): User | null {
    return auth.currentUser;
  }
}

export const authService = new AuthService();
```

## 🗃️ 데이터베이스 스키마

### Firestore 컬렉션 구조
```
/users/{userId}
├── profile (document)
│   ├── displayName: string
│   ├── email: string
│   ├── photoURL: string
│   ├── preferences: object
│   └── createdAt: timestamp
├── /coffee_records (subcollection)
│   └── {recordId}
│       ├── beanName: string
│       ├── brand: string
│       ├── origin: string
│       ├── flavor: array<string>
│       ├── rating: number
│       ├── brewMethod: string
│       ├── notes: string
│       ├── imageUrl: string
│       └── createdAt: timestamp
├── /favorites (subcollection)
│   └── {cafeId}
│       ├── cafeId: string
│       ├── cafeName: string
│       └── addedAt: timestamp
└── /settings (subcollection)
    └── preferences
        ├── emailNotifications: boolean
        ├── favoriteBrewMethods: array<string>
        └── flavorPreferences: array<string>

/cafes/{cafeId}
├── name: string
├── address: string
├── lat: number
├── lng: number
├── phone: string
├── hours: object
├── rating: number
├── reviewCount: number
├── tags: array<string>
├── features: object
├── menu: array<object>
├── images: array<string>
├── flavorProfile: string
├── priceRange: string
├── createdAt: timestamp
└── updatedAt: timestamp

/beans/{beanId}
├── name: string
├── brand: string
├── origin: string
├── variety: string
├── process: string
├── roastLevel: string
├── flavorNotes: array<string>
├── price: number
├── weight: string
├── description: string
├── images: array<string>
├── rating: number
├── reviews: array<object>
├── availability: boolean
├── createdAt: timestamp
└── updatedAt: timestamp
```

### 데이터 모델 타입
```typescript
// types/models.ts
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  preferences: UserPreferences;
  createdAt: string;
}

export interface UserPreferences {
  favoriteBrewMethods: string[];
  flavorPreferences: string[];
  emailNotifications: boolean;
  preferredCafeTypes: string[];
}

export interface CoffeeRecord {
  id: string;
  userId: string;
  beanName: string;
  brand: string;
  origin: string;
  flavor: string[];
  rating: number;
  brewMethod: string;
  grindSize?: string;
  waterTemp?: number;
  brewTime?: number;
  notes?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Cafe {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  website?: string;
  hours: OpeningHours;
  rating: number;
  reviewCount: number;
  tags: string[];
  features: CafeFeatures;
  menu: MenuItem[];
  images: string[];
  flavorProfile: string;
  priceRange: string;
  createdAt: string;
  updatedAt: string;
}

export interface Bean {
  id: string;
  name: string;
  brand: string;
  origin: string;
  variety?: string;
  process?: string;
  roastLevel: string;
  flavorNotes: string[];
  price: number;
  weight: string;
  description: string;
  images: string[];
  rating: number;
  reviews: Review[];
  availability: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## 🛣️ API 라우트

### 커피 기록 분석 API
```typescript
// app/api/bean-analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleCloudVisionService } from '@/services/GoogleCloudVisionService';
import { OpenAIService } from '@/services/OpenAIService';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: '이미지 URL이 필요합니다' },
        { status: 400 }
      );
    }

    // Google Cloud Vision으로 OCR 수행
    const visionService = new GoogleCloudVisionService();
    const extractedText = await visionService.extractText(imageUrl);

    // OpenAI로 텍스트 분석
    const openAIService = new OpenAIService();
    const analysis = await openAIService.analyzeCoffeeText(extractedText);

    return NextResponse.json({
      extractedText,
      analysis,
      success: true
    });

  } catch (error) {
    console.error('Bean analysis error:', error);
    return NextResponse.json(
      { error: '분석 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
```

### GPT 추천 API
```typescript
// app/api/gpt-recommend/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { OpenAIService } from '@/services/OpenAIService';
import { getAuthUser } from '@/utils/auth-utils';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const { userPreferences, recentRecords } = await request.json();

    const openAIService = new OpenAIService();
    const recommendations = await openAIService.generateRecommendations({
      userId: user.uid,
      preferences: userPreferences,
      history: recentRecords
    });

    return NextResponse.json({
      recommendations,
      success: true
    });

  } catch (error) {
    console.error('GPT recommendation error:', error);
    return NextResponse.json(
      { error: '추천 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
```

### 이메일 리포트 API
```typescript
// app/api/send-coffee-report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { EmailService } from '@/services/EmailService';
import { getAuthUser } from '@/utils/auth-utils';
import { generateWeeklyReport } from '@/services/ReportService';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const { email, reportType = 'weekly' } = await request.json();

    // 주간 리포트 생성
    const reportData = await generateWeeklyReport(user.uid);

    // 이메일 발송
    const emailService = new EmailService();
    await emailService.sendWeeklyReport(email, reportData);

    return NextResponse.json({
      message: '이메일이 성공적으로 발송되었습니다',
      success: true
    });

  } catch (error) {
    console.error('Email report error:', error);
    return NextResponse.json(
      { error: '이메일 발송 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
```

## 🧠 AI 서비스

### OpenAI 서비스
```typescript
// services/OpenAIService.ts
import OpenAI from 'openai';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyzeCoffeeText(text: string) {
    const prompt = `
    다음 커피 관련 텍스트를 분석해서 JSON 형태로 정보를 추출해주세요:
    
    텍스트: "${text}"
    
    추출할 정보:
    - beanName: 원두명
    - brand: 브랜드
    - origin: 원산지
    - roastLevel: 로스팅 레벨
    - flavorNotes: 향미 노트 (배열)
    - price: 가격 (숫자)
    - weight: 중량
    
    JSON 형태로만 응답해주세요.
    `;

    const response = await this.client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    try {
      return JSON.parse(content || '{}');
    } catch (error) {
      throw new Error('GPT 응답 파싱 실패');
    }
  }

  async generateRecommendations(userData: {
    userId: string;
    preferences: any;
    history: any[];
  }) {
    const prompt = `
    사용자의 커피 기록과 선호도를 기반으로 개인화된 추천을 생성해주세요:
    
    사용자 선호도: ${JSON.stringify(userData.preferences)}
    최근 기록: ${JSON.stringify(userData.history.slice(0, 5))}
    
    다음 형태의 JSON으로 응답해주세요:
    {
      "recommendedBeans": [원두 추천 목록],
      "recommendedCafes": [카페 추천 목록],
      "flavorProfile": "사용자 향미 프로필",
      "suggestions": "개인화된 제안사항"
    }
    `;

    const response = await this.client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    try {
      return JSON.parse(content || '{}');
    } catch (error) {
      throw new Error('추천 생성 실패');
    }
  }
}
```

### Google Cloud Vision 서비스
```typescript
// services/GoogleCloudVisionService.ts
import vision from '@google-cloud/vision';

export class GoogleCloudVisionService {
  private client: vision.ImageAnnotatorClient;

  constructor() {
    // 환경변수로부터 인증 정보 로드
    const credentials = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON
      ? JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS_JSON)
      : undefined;

    this.client = new vision.ImageAnnotatorClient({
      credentials,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
  }

  async extractText(imageUrl: string): Promise<string> {
    try {
      const [result] = await this.client.textDetection({
        image: { source: { imageUri: imageUrl } },
      });

      const detections = result.textAnnotations;
      if (!detections || detections.length === 0) {
        return '';
      }

      return detections[0].description || '';
    } catch (error) {
      console.error('Vision API error:', error);
      throw new Error('텍스트 추출 실패');
    }
  }

  async detectLabels(imageUrl: string): Promise<string[]> {
    try {
      const [result] = await this.client.labelDetection({
        image: { source: { imageUri: imageUrl } },
      });

      const labels = result.labelAnnotations || [];
      return labels
        .filter(label => (label.score || 0) > 0.7)
        .map(label => label.description || '')
        .slice(0, 10);
    } catch (error) {
      console.error('Label detection error:', error);
      throw new Error('라벨 감지 실패');
    }
  }
}
```

## 📧 이메일 서비스

### 이메일 템플릿
```typescript
// services/EmailService.ts
import nodemailer from 'nodemailer';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendWeeklyReport(email: string, reportData: any) {
    const htmlTemplate = this.generateReportHTML(reportData);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '☕ 주간 커피 리포트',
      html: htmlTemplate,
    };

    await this.transporter.sendMail(mailOptions);
  }

  private generateReportHTML(data: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>주간 커피 리포트</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b, #ea580c); color: white; padding: 20px; border-radius: 10px; }
        .content { margin: 20px 0; }
        .stat-card { background: #f9f9f9; padding: 15px; margin: 10px 0; border-radius: 8px; }
        .footer { text-align: center; color: #666; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>☕ 주간 커피 리포트</h1>
        <p>당신의 커피 여정을 정리해드렸어요!</p>
      </div>
      
      <div class="content">
        <div class="stat-card">
          <h3>📊 이번 주 통계</h3>
          <p>기록한 커피: <strong>${data.recordCount}잔</strong></p>
          <p>평균 평점: <strong>${data.averageRating}점</strong></p>
          <p>선호 추출법: <strong>${data.favoriteBrewMethod}</strong></p>
        </div>
        
        <div class="stat-card">
          <h3>🌟 이번 주 발견</h3>
          <p>새로운 향미: <strong>${data.newFlavors.join(', ')}</strong></p>
          <p>최고 평점 원두: <strong>${data.topBean}</strong></p>
        </div>
        
        <div class="stat-card">
          <h3>💡 다음 주 추천</h3>
          <ul>
            ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>
      </div>
      
      <div class="footer">
        <p>Coffee Journey와 함께하는 특별한 커피 경험 ☕</p>
      </div>
    </body>
    </html>
    `;
  }
}
```

## 🔒 보안 및 인증

### 미들웨어 인증
```typescript
// utils/auth-utils.ts
import { NextRequest } from 'next/server';
import { auth } from '@/firebase';
import { getAuth } from 'firebase-admin/auth';

export async function getAuthUser(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decodedToken = await getAuth().verifyIdToken(token);
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

export function requireAuth(handler: Function) {
  return async (request: NextRequest) => {
    const user = await getAuthUser(request);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }
    return handler(request, user);
  };
}
```

### Firebase Rules
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 사용자는 자신의 데이터만 읽기/쓰기 가능
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // 하위 컬렉션도 동일한 규칙 적용
      match /{subcollection=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // 카페 정보는 모든 인증된 사용자가 읽기 가능
    match /cafes/{cafeId} {
      allow read: if request.auth != null;
      allow write: if false; // 관리자만 수정 가능
    }
    
    // 원두 정보는 모든 인증된 사용자가 읽기 가능
    match /beans/{beanId} {
      allow read: if request.auth != null;
      allow write: if false; // 관리자만 수정 가능
    }
  }
}
```

## 📊 모니터링 및 로깅

### 에러 추적
```typescript
// utils/logger.ts
export class Logger {
  static info(message: string, meta?: any) {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`, meta);
  }

  static warn(message: string, meta?: any) {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, meta);
  }

  static error(message: string, error?: Error, meta?: any) {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, {
      error: error?.message,
      stack: error?.stack,
      ...meta
    });
    
    // 프로덕션에서는 외부 서비스로 전송
    if (process.env.NODE_ENV === 'production') {
      this.sendToErrorService(message, error, meta);
    }
  }

  private static sendToErrorService(message: string, error?: Error, meta?: any) {
    // Sentry, LogRocket 등 에러 추적 서비스 연동
  }
}
```

### 성능 모니터링
```typescript
// utils/performance.ts
export function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const start = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - start;
      
      Logger.info(`Performance: ${name}`, { duration });
      
      // 성능 데이터 수집
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'timing_complete', {
          name: name,
          value: duration,
        });
      }
      
      resolve(result);
    } catch (error) {
      const duration = Date.now() - start;
      Logger.error(`Performance error: ${name}`, error, { duration });
      reject(error);
    }
  });
}
```

## 🚀 배포 및 환경 설정

### 환경 변수 관리
```bash
# .env.local (개발환경)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# 서버 전용 환경변수
OPENAI_API_KEY=your_openai_api_key
GOOGLE_CLOUD_PROJECT_ID=your_gcp_project_id
GOOGLE_CLOUD_CREDENTIALS_JSON={"type":"service_account"...}
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# 외부 API
NEXT_PUBLIC_OPENWEATHER_API_KEY=your_weather_api_key
```

### Vercel 배포 설정
```json
// vercel.json
{
  "functions": {
    "app/api/*/route.ts": {
      "maxDuration": 30
    }
  },
  "env": {
    "NODE_ENV": "production"
  },
  "build": {
    "env": {
      "NEXT_TELEMETRY_DISABLED": "1"
    }
  }
}
```

### 헬스 체크 API
```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET() {
  try {
    // Firebase 연결 확인
    const testDoc = await getDoc(doc(db, 'health', 'check'));
    
    // 외부 API 상태 확인
    const checks = {
      firebase: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    };

    return NextResponse.json(checks);
  } catch (error) {
    return NextResponse.json(
      { error: 'Health check failed', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
``` 