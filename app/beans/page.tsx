export const dynamic = 'force-dynamic';

import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import BeanFinderClient from "./BeanFinderClient";
import { Suspense } from "react";

type Bean = {
  id?: string;
  name: string;
  flavor: string;
  price: string;
  image: string;
  desc?: string;
  roast?: string;
  brand?: string;
  link?: string;
  category?: string;
  createdAt?: string;
  lastUpdated?: string;
};

async function loadBeans(): Promise<Bean[]> {
  try {
    const beansCol = collection(db, "beans");
    const beanSnapshot = await getDocs(beansCol);
    
    return beanSnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Timestamp 객체들을 안전하게 문자열로 변환
      const convertTimestamp = (timestamp: any) => {
        if (timestamp && typeof timestamp === 'object' && timestamp.toDate) {
          return timestamp.toDate().toISOString();
        }
        if (timestamp instanceof Date) {
          return timestamp.toISOString();
        }
        return timestamp || null;
      };

      const rawLink = String(data.link || data.url || data.product_url || '');
      const normalizedLink = rawLink
        .replace(/\\u0026/g, '&')
        .replace(/\\+$/g, '')
        .trim();

      return {
        id: doc.id,
        name: data.name || '',
        flavor: data.flavor || data.flavors || '',
        price: data.price || '',
        image: data.image || '',
        desc: data.desc || data.description || '',
        roast: data.roast || '',
        brand: data.brand || '',
        link: data.linkStatus === 'dead' ? '' : normalizedLink,
        category: data.category || '',
        createdAt: convertTimestamp(data.createdAt),
        lastUpdated: convertTimestamp(data.lastUpdated),
      };
    }) as Bean[];
  } catch (error) {
    console.error("원두 데이터 로드 실패:", error);
    return [];
  }
}

function BeansLoading() {
  return (
    <div className="p-4">
      <div className="animate-pulse">
        <div className="h-8 bg-coffee-medium rounded mb-6"></div>
        <div className="h-12 bg-coffee-medium rounded mb-6"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 bg-coffee-medium rounded-lg"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function BeansPage() {
  const beans = await loadBeans();

  return (
    <Suspense fallback={<BeansLoading />}>
      <BeanFinderClient beans={beans} />
    </Suspense>
  );
}