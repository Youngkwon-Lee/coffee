"use client";
import { useEffect, useState } from "react";
import { db } from "../../src/firebase";
import { collection, getDocs } from "firebase/firestore";
import Image from "next/image";

interface Bean {
  id: string;
  name: string;
  flavor: string;
  price: string;
  image: string;
  desc?: string;
  roast?: string;
  brand?: string;
  link?: string;
  category?: string;
}

export default function BasketPage() {
  const [beans, setBeans] = useState<Bean[]>([]);
  const [basket, setBasket] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // localStorage에서 장바구니 id 불러오기
  useEffect(() => {
    const stored = localStorage.getItem("basket_beans");
    setBasket(stored ? JSON.parse(stored) : []);
  }, []);

  // Firestore에서 beans 전체 불러오기 후, 장바구니 원두만 필터링
  useEffect(() => {
    if (basket.length === 0) {
      setBeans([]);
      setLoading(false);
      return;
    }
    const fetchBeans = async () => {
      const beansCol = collection(db, "beans");
      const beanSnapshot = await getDocs(beansCol);
      const beanList = beanSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Bean[];
      setBeans(beanList.filter(bean => basket.includes(bean.id)));
      setLoading(false);
    };
    fetchBeans();
  }, [basket]);

  // 장바구니 삭제
  const handleRemove = (beanId: string) => {
    const updated = basket.filter(id => id !== beanId);
    setBasket(updated);
    setBeans(beans.filter(bean => bean.id !== beanId));
    localStorage.setItem("basket_beans", JSON.stringify(updated));
  };

  return (
    <main className="flex flex-col items-center min-h-screen pt-20 pb-20 bg-gradient-to-br from-amber-50 to-rose-100">
      <h1 className="text-2xl font-bold mb-6 text-espresso">🛒 내 장바구니</h1>
      {loading ? (
        <div className="text-center py-10">로딩 중...</div>
      ) : basket.length === 0 ? (
        <div className="text-center text-brown-400 py-10">장바구니가 비어 있습니다.</div>
      ) : (
        <div className="w-full max-w-md flex flex-col gap-6">
          {beans.map(bean => (
            <div key={bean.id} className="bg-white/80 rounded-2xl shadow p-4 flex flex-col md:flex-row gap-4 border border-caramel items-center relative">
              <Image src={bean.image || "/beans/default.jpg"} alt={bean.name} width={100} height={100} className="rounded-xl object-cover w-24 h-24" />
              <div className="flex-1 flex flex-col gap-1">
                <div className="text-lg font-bold text-espresso">{bean.name}</div>
                <div className="text-xs text-mocha mb-1">향미: {bean.flavor}</div>
                {bean.desc && <div className="text-xs text-brown-700 mb-1">{bean.desc}</div>}
                <div className="text-caramel font-bold mb-2">{bean.price} / 200g</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => bean.link && window.open(bean.link, "_blank")}
                    className="px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-500 text-white font-semibold shadow transition text-sm"
                  >
                    구매하기
                  </button>
                  <button
                    onClick={() => handleRemove(bean.id)}
                    className="px-4 py-2 rounded-full bg-red-400 hover:bg-red-500 text-white font-semibold shadow transition text-sm"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
} 