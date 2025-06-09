import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import BeansClient from "./BeansClient";

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

export default async function BeansPage() {
  const beansCol = collection(db, "beans");
  const beanSnapshot = await getDocs(beansCol);
  const beans = beanSnapshot.docs.map(doc => {
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

    return {
      id: doc.id,
      name: data.name || '',
      flavor: data.flavor || data.flavors || '',
      price: data.price || '',
      image: data.image || '',
      desc: data.desc || data.description || '',
      roast: data.roast || '',
      brand: data.brand || '',
      link: data.link || '',
      category: data.category || '',
      // 모든 timestamp 필드 변환
      createdAt: convertTimestamp(data.createdAt),
      lastUpdated: convertTimestamp(data.lastUpdated),
    };
  }) as Bean[];

  return <BeansClient beans={beans} />;
}