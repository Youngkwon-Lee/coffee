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
};

export default async function BeansPage() {
  const beansCol = collection(db, "beans");
  const beanSnapshot = await getDocs(beansCol);
  const beans = beanSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Bean[];

  return <BeansClient beans={beans} />;
} 