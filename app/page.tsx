"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import Image from "next/image";
import Link from "next/link";
import dayjs from "dayjs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

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
  bean: string;
  cafe: string;
  flavor: string[];
  rating?: number;
  review?: string;
  createdAt: string;
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [beans, setBeans] = useState<Bean[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const beansSnap = await getDocs(collection(db, "beans"));
      const beansList = beansSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Bean[];
      setBeans(beansList);
      if (user) {
        const recSnap = await getDocs(collection(db, `users/${user.uid}/records`));
        const recList = recSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })) as RecordItem[];
        setRecords(recList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3));
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

  // 취향/별점 요약
  const avgRating = records.length > 0 ? (records.reduce((sum, r) => sum + (r.rating || 0), 0) / records.length).toFixed(1) : null;
  const mostFlavor = (() => {
    const flavorCount: { [key: string]: number } = {};
    records.forEach(r => r.flavor?.forEach(f => { flavorCount[f] = (flavorCount[f] || 0) + 1; }));
    const sorted = Object.entries(flavorCount).sort(([,a],[,b]) => b-a);
    return sorted.length > 0 ? sorted[0][0] : null;
  })();

  // 최근 7일간 기록 수 집계 (차트용)
  const last7days = Array.from({ length: 7 }, (_, i) => dayjs().subtract(6 - i, "day").format("YYYY-MM-DD"));
  const recordCountByDay = last7days.map(date =>
    records.filter(r => dayjs(r.createdAt).format("YYYY-MM-DD") === date).length
  );
  const chartData = last7days.map((date, i) => ({
    date: dayjs(date).format("dd"),
    count: recordCountByDay[i],
  }));
  const barColors = ["#b08968", "#ddb892", "#a98467", "#e6ccb2", "#7f5539", "#9c6644", "#c97d60"];

  return (
    <main className="flex flex-col items-center min-h-screen pt-20 pb-24 bg-gradient-to-br from-amber-50 to-rose-100">
      {/* 상단 인사말 */}
      <section className="w-full max-w-2xl flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
        <div className="flex-1">
          <div className="text-lg font-bold text-mocha mb-1">
            {user ? `${user.displayName || user.email}님, 환영합니다!` : "커피 기록 서비스에 오신 걸 환영합니다!"}
          </div>
          <div className="text-xs text-brown-700 mb-2">오늘도 좋은 하루 보내세요 ☕</div>
        </div>
      </section>
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
          {/* 취향/별점 요약 + 차트 */}
          <section className="bg-white/90 rounded-2xl shadow p-6 border border-caramel flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-1">
              <div className="text-lg font-bold text-mocha mb-2">나의 취향/별점 요약</div>
              {!user ? (
                <div className="text-brown-400">로그인 후 내 취향/별점 요약을 볼 수 있습니다.</div>
              ) : records.length === 0 ? (
                <div className="text-brown-400">최근 기록이 없습니다.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="text-xs text-mocha">최근 평균 별점: <span className="font-bold text-yellow-500">{avgRating}</span></div>
                  <div className="text-xs text-mocha">가장 많이 마신 향미: <span className="font-bold text-caramel">{mostFlavor}</span></div>
                </div>
              )}
            </div>
            {/* recharts BarChart */}
            <div className="w-48 h-28 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#a98467' }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[0, Math.max(...recordCountByDay, 2)]} />
                  <Tooltip formatter={(value) => `${value}건`} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={barColors[i % barColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          {/* 내 기록 요약 */}
          <section className="bg-white/90 rounded-2xl shadow p-6 border border-caramel">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-bold text-mocha">내 기록 요약</div>
              <Link href="/record/manual" className="inline-flex items-center justify-center px-6 h-12 rounded-full bg-gradient-to-br from-amber-400 to-mocha shadow-xl hover:scale-105 transition text-lg font-bold border-4 border-white ring-amber-400 ring-2 focus:ring-4 focus:outline-none">
                기록하기
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
                    <span className="font-bold text-espresso">{r.bean}</span>
                    <span className="text-xs text-mocha">{new Date(r.createdAt).toLocaleDateString()}</span>
                    {r.review && <span className="text-xs text-brown-700">{r.review}</span>}
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