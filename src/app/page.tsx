"use client";
import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import Image from "next/image";
import Link from "next/link";

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
  views?: number;
  likes?: number;
}
interface RecordItem {
  id: string;
  date: string;
  beanName: string;
  memo?: string;
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [beans, setBeans] = useState<Bean[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 로그인 상태 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Firestore에서 beans, records 불러오기
  useEffect(() => {
    const fetchData = async () => {
    setLoading(true);
      const beansSnap = await getDocs(collection(db, "beans"));
      const beansList = beansSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Bean[];
      setBeans(beansList);
      if (user) {
        const recSnap = await getDocs(collection(db, `users/${user.uid}/records`));
        const recList = recSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RecordItem[];
        setRecords(recList.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3));
      } else {
        setRecords([]);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  // 오늘의 추천(랜덤 원두)
  const todayBean = beans.length > 0 ? beans[Math.floor(Math.random() * beans.length)] : null;
  // 인기 원두(조회수/찜순 등 임시 상위 3개)
  const popularBeans = beans
    .slice()
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 3);

  return (
    <main className="flex flex-col items-center min-h-screen pt-20 pb-24 bg-gradient-to-br from-amber-50 to-rose-100">
      <h1 className="text-2xl font-bold mb-6 text-espresso">☕ 커피 메인 대시보드</h1>
      {loading ? (
        <div className="text-center py-10">로딩 중...</div>
      ) : (
        <div className="w-full max-w-2xl flex flex-col gap-8">
          {/* 오늘의 추천 */}
          <section className="bg-white/90 rounded-2xl shadow p-6 flex flex-col md:flex-row gap-6 items-center border border-caramel">
            <div className="flex-1">
              <div className="text-lg font-bold text-mocha mb-2">오늘의 추천 원두</div>
              {todayBean ? (
                <>
                  <div className="text-xl font-bold text-espresso mb-1">{todayBean.name}</div>
                  <div className="text-xs text-brown-700 mb-2">{todayBean.flavor}</div>
                  <div className="text-caramel font-bold mb-2">{todayBean.price}</div>
                  <Link href={todayBean.link || "#"} target="_blank" className="inline-block px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-500 text-white font-semibold shadow transition text-sm">구매처</Link>
                </>
              ) : (
                <div className="text-brown-400">추천할 원두가 없습니다.</div>
              )}
            </div>
            {todayBean && (
              <Image src={todayBean.image || "/beans/default.jpg"} alt={todayBean.name} width={100} height={100} className="rounded-xl object-cover w-24 h-24" />
            )}
          </section>
          {/* 내 기록 요약 */}
          <section className="bg-white/90 rounded-2xl shadow p-6 border border-caramel">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-bold text-mocha">내 기록 요약</div>
              <Link href="/record" className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-caramel to-mocha text-white shadow hover:scale-110 transition">
                <span className="material-icons text-lg">add</span>
              </Link>
            </div>
            {!user ? (
              <div className="text-brown-400">로그인 후 내 기록을 확인할 수 있습니다.</div>
            ) : records.length === 0 ? (
              <div className="text-brown-400">최근 기록이 없습니다.</div>
            ) : (
              <ul className="flex flex-col gap-2">
                {records.map(r => (
                  <li key={r.id} className="flex flex-col md:flex-row md:items-center gap-2 border-b pb-2">
                    <span className="font-bold text-espresso">{r.beanName}</span>
                    <span className="text-xs text-mocha">{r.date}</span>
                    {r.memo && <span className="text-xs text-brown-700">{r.memo}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {/* 인기 원두 */}
          <section className="bg-white/90 rounded-2xl shadow p-6 border border-caramel">
            <div className="text-lg font-bold text-mocha mb-2">인기 원두</div>
            {popularBeans.length === 0 ? (
              <div className="text-brown-400">인기 원두 데이터가 없습니다.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {popularBeans.map(bean => (
                  <div key={bean.id} className="bg-amber-50 rounded-xl shadow p-3 flex flex-col items-center border border-caramel">
                    <Image src={bean.image || "/beans/default.jpg"} alt={bean.name} width={80} height={80} className="rounded-lg object-cover mb-2" />
                    <div className="font-bold text-espresso text-sm mb-1">{bean.name}</div>
                    <div className="text-xs text-mocha mb-1">{bean.flavor}</div>
                    <div className="text-caramel font-bold mb-1">{bean.price}</div>
                    <Link href={bean.link || "#"} target="_blank" className="inline-block px-3 py-1 rounded-full bg-amber-400 hover:bg-amber-500 text-white font-semibold shadow transition text-xs">구매처</Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}