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
  createdAt?: Date;
};

export default async function BeansPage() {
  const beansCol = collection(db, "beans");
  const beanSnapshot = await getDocs(beansCol);
  const beans = beanSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      // Timestamp를 Date 객체로 변환
      createdAt: data.createdAt?.toDate() || new Date()
    };
  }) as Bean[];

  return <BeansClient beans={beans} />;
}