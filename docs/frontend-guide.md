# 🎨 프론트엔드 개발 가이드

## 🛠️ 기술 스택

### 핵심 기술
- **Next.js 15** - React 메타프레임워크
- **TypeScript** - 정적 타입 검사
- **Tailwind CSS** - 유틸리티 기반 CSS
- **Framer Motion** - 애니메이션 라이브러리

### 추가 라이브러리
```json
{
  "@google-cloud/vision": "^5.1.0",
  "@heroicons/react": "^2.2.0",  
  "@react-google-maps/api": "^2.20.6",
  "dayjs": "^1.11.13",
  "firebase": "^11.6.1",
  "firebase-admin": "^13.4.0",
  "framer-motion": "^12.9.4",
  "fuse.js": "^7.1.0",
  "next": "15.3.1",
  "openai": "^5.1.1",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "react-firebase-hooks": "^5.1.1",
  "recharts": "^2.15.3",
  "tailwindcss": "^3.4.17",
  "zustand": "^5.0.4"
}
```

## 📁 프로젝트 구조

```
app/
├── components/              # 공통 컴포넌트
│   ├── Header.tsx          # 네비게이션 헤더
│   ├── MainPageHero.tsx    # 메인 페이지 히어로
│   ├── FloatingAction.tsx  # 플로팅 액션 버튼
│   └── EmailReportModal.tsx # 이메일 리포트 모달
├── beans/                  # 원두 페이지
│   ├── page.tsx           # 원두 목록 페이지
│   └── BeansClient.tsx    # 원두 클라이언트 컴포넌트
├── cafes/                 # 카페 페이지
│   ├── page.tsx          # 카페 목록 페이지
│   ├── CafeClient.tsx    # 카페 클라이언트 컴포넌트
│   └── GoogleMapView.tsx # 구글 지도 컴포넌트
├── record/               # 기록 페이지
│   ├── page.tsx         # 기록 메인
│   ├── manual/          # 수동 기록
│   └── photo/           # 사진 기록
├── api/                 # API 라우트
│   ├── bean-analyze/    # 원두 분석 API
│   ├── gpt-recommend/   # GPT 추천 API
│   └── send-coffee-report/ # 리포트 전송 API
├── login/               # 로그인 페이지
├── history/             # 기록 히스토리
└── globals.css          # 전역 스타일
```

## 🎨 스타일링 시스템

### Tailwind CSS 설정
```javascript
// tailwind.config.js
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 커스텀 색상 팔레트
        amber: {
          50: '#fef7cd',
          500: '#f59e0b',
          600: '#d97706',
        },
        purple: {
          500: '#8b5cf6',
          600: '#7c3aed',
        },
        gray: {
          600: '#4b5563',
          700: '#374151',
        }
      },
      animation: {
        'fadeIn': 'fadeIn 0.5s ease-in-out',
        'slideUp': 'slideUp 0.3s ease-out',
      }
    },
  },
  plugins: [],
}
```

### CSS 커스텀 속성
```css
/* globals.css */
:root {
  --primary-gradient: linear-gradient(to right, #f59e0b, #ea580c);
  --secondary-gradient: linear-gradient(to right, #8b5cf6, #6366f1);
  --neutral-gradient: linear-gradient(to right, #4b5563, #374151);
}

.primary-gradient {
  background: var(--primary-gradient);
}

.secondary-gradient {
  background: var(--secondary-gradient);
}

.neutral-gradient {
  background: var(--neutral-gradient);
}
```

## 🔧 컴포넌트 패턴

### 기본 컴포넌트 구조
```tsx
// components/BaseComponent.tsx
import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface BaseComponentProps {
  children: ReactNode;
  className?: string;
  animate?: boolean;
}

export default function BaseComponent({ 
  children, 
  className = '', 
  animate = false 
}: BaseComponentProps) {
  const Component = animate ? motion.div : 'div';
  
  return (
    <Component 
      className={`base-component ${className}`}
      {...(animate && {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5 }
      })}
    >
      {children}
    </Component>
  );
}
```

### 커스텀 훅 패턴
```tsx
// src/hooks/useAuth.ts
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/src/firebase';

export function useAuth() {
  const [user, loading, error] = useAuthState(auth);
  
  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    signOut: () => auth.signOut()
  };
}
```

### 데이터 페칭 패턴
```tsx
// src/hooks/useCafes.ts
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/src/firebase';

interface Cafe {
  id: string;
  name: string;
  address: string;
  // ... 기타 속성
}

export function useCafes() {
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCafes() {
      try {
        setLoading(true);
        const snapshot = await getDocs(collection(db, 'cafes'));
        const cafesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Cafe[];
        setCafes(cafesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : '카페 데이터 로드 실패');
      } finally {
        setLoading(false);
      }
    }

    fetchCafes();
  }, []);

  return { cafes, loading, error };
}
```

## 🎭 애니메이션 시스템

### Framer Motion 변형
```tsx
// animations/variants.ts
export const fadeInUp = {
  initial: { opacity: 0, y: 60 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -60 },
  transition: { duration: 0.6, ease: "easeOut" }
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const scaleHover = {
  whileHover: { scale: 1.05 },
  whileTap: { scale: 0.95 },
  transition: { type: "spring", stiffness: 300 }
};
```

### 애니메이션 컴포넌트
```tsx
// components/AnimatedCard.tsx
import { motion } from 'framer-motion';
import { fadeInUp, scaleHover } from '@/animations/variants';

interface AnimatedCardProps {
  children: ReactNode;
  index?: number;
}

export default function AnimatedCard({ children, index = 0 }: AnimatedCardProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true }}
      custom={index}
      {...scaleHover}
      className="card-base"
    >
      {children}
    </motion.div>
  );
}
```

## 🔥 상태 관리

### 로컬 상태 (useState)
```tsx
// 단순한 UI 상태
const [isOpen, setIsOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState<Item | null>(null);
```

### 복잡한 상태 (useReducer)
```tsx
// hooks/useFilter.ts
import { useReducer } from 'react';

interface FilterState {
  search: string;
  category: string | null;
  priceRange: [number, number];
  sortBy: 'name' | 'price' | 'rating';
}

type FilterAction = 
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_CATEGORY'; payload: string | null }
  | { type: 'SET_PRICE_RANGE'; payload: [number, number] }
  | { type: 'SET_SORT'; payload: 'name' | 'price' | 'rating' }
  | { type: 'RESET' };

const initialState: FilterState = {
  search: '',
  category: null,
  priceRange: [0, 100000],
  sortBy: 'name'
};

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'SET_SEARCH':
      return { ...state, search: action.payload };
    case 'SET_CATEGORY':
      return { ...state, category: action.payload };
    case 'SET_PRICE_RANGE':
      return { ...state, priceRange: action.payload };
    case 'SET_SORT':
      return { ...state, sortBy: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function useFilter() {
  const [state, dispatch] = useReducer(filterReducer, initialState);
  
  return {
    ...state,
    setSearch: (search: string) => dispatch({ type: 'SET_SEARCH', payload: search }),
    setCategory: (category: string | null) => dispatch({ type: 'SET_CATEGORY', payload: category }),
    setPriceRange: (range: [number, number]) => dispatch({ type: 'SET_PRICE_RANGE', payload: range }),
    setSortBy: (sort: 'name' | 'price' | 'rating') => dispatch({ type: 'SET_SORT', payload: sort }),
    reset: () => dispatch({ type: 'RESET' })
  };
}
```

## 🔌 API 통신

### API 유틸리티
```tsx
// utils/api.ts
class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseURL = process.env.NODE_ENV === 'production' 
    ? 'https://your-domain.com' 
    : 'http://localhost:3000';
    
  const url = `${baseURL}/api${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new APIError(response.status, `API 요청 실패: ${response.statusText}`);
  }

  return response.json();
}

// 구체적인 API 함수들
export const api = {
  getCafes: () => apiRequest<Cafe[]>('/cafes'),
  getBeans: () => apiRequest<Bean[]>('/beans'),
  createRecord: (data: RecordData) => 
    apiRequest<Record>('/records', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  analyzeBeans: (imageUrl: string) =>
    apiRequest<AnalysisResult>('/bean-analyze', {
      method: 'POST',
      body: JSON.stringify({ imageUrl })
    })
};
```

### SWR을 활용한 데이터 캐싱
```tsx
// hooks/useSWR.ts
import useSWR from 'swr';
import { api } from '@/utils/api';

export function useCafes() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/cafes',
    api.getCafes,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5 * 60 * 1000, // 5분 중복 제거
    }
  );

  return {
    cafes: data || [],
    loading: isLoading,
    error,
    refresh: mutate
  };
}
```

## 📱 반응형 디자인

### 브레이크포인트 유틸리티
```tsx
// hooks/useBreakpoint.ts
import { useState, useEffect } from 'react';

type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
};

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('sm');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      
      if (width >= breakpoints['2xl']) setBreakpoint('2xl');
      else if (width >= breakpoints.xl) setBreakpoint('xl');
      else if (width >= breakpoints.lg) setBreakpoint('lg');
      else if (width >= breakpoints.md) setBreakpoint('md');
      else setBreakpoint('sm');
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return breakpoint;
}
```

### 반응형 컴포넌트
```tsx
// components/ResponsiveGrid.tsx
import { useBreakpoint } from '@/hooks/useBreakpoint';

interface ResponsiveGridProps {
  children: ReactNode;
  cols?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

export default function ResponsiveGrid({ 
  children, 
  cols = { sm: 1, md: 2, lg: 3, xl: 4 } 
}: ResponsiveGridProps) {
  const breakpoint = useBreakpoint();
  const columns = cols[breakpoint] || cols.sm || 1;
  
  return (
    <div 
      className={`grid gap-6`}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {children}
    </div>
  );
}
```

## 🚀 성능 최적화

### 이미지 최적화
```tsx
// components/OptimizedImage.tsx
import Image from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

export default function OptimizedImage({
  src,
  alt,
  width = 400,
  height = 300,
  className = '',
  priority = false
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-lg" />
      )}
      
      {!hasError ? (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          className={`transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
        />
      ) : (
        <div className="flex items-center justify-center h-full bg-gray-100 text-gray-400">
          <span>이미지 로드 실패</span>
        </div>
      )}
    </div>
  );
}
```

### 레이지 로딩 컴포넌트
```tsx
// components/LazyLoader.tsx
import { ReactNode, Suspense } from 'react';

interface LazyLoaderProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export default function LazyLoader({ 
  children, 
  fallback = <div className="animate-pulse bg-gray-200 h-32 rounded-lg" /> 
}: LazyLoaderProps) {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}
```

### 가상화 리스트
```tsx
// components/VirtualizedList.tsx
import { FixedSizeList as List } from 'react-window';

interface VirtualizedListProps<T> {
  items: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
}

export default function VirtualizedList<T>({
  items,
  height,
  itemHeight,
  renderItem
}: VirtualizedListProps<T>) {
  const Row = ({ index, style }: { index: number; style: any }) => (
    <div style={style}>
      {renderItem(items[index], index)}
    </div>
  );

  return (
    <List
      height={height}
      itemCount={items.length}
      itemSize={itemHeight}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

## 🧪 테스트

### Jest + Testing Library 설정
```javascript
// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
};

module.exports = createJestConfig(customJestConfig);
```

### 컴포넌트 테스트
```tsx
// __tests__/components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '@/components/Button';

describe('Button 컴포넌트', () => {
  test('클릭 이벤트가 정상적으로 작동한다', () => {
    const handleClick = jest.fn();
    
    render(
      <Button onClick={handleClick}>
        클릭하기
      </Button>
    );
    
    const button = screen.getByRole('button', { name: '클릭하기' });
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  test('disabled 상태에서는 클릭할 수 없다', () => {
    const handleClick = jest.fn();
    
    render(
      <Button onClick={handleClick} disabled>
        비활성화된 버튼
      </Button>
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });
});
```

## 🔧 개발 도구

### ESLint 설정
```javascript
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

### Prettier 설정
```javascript
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### 개발 스크립트
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
``` 