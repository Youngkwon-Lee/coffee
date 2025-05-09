"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import dayjs from "dayjs";

interface RecordData {
  id: string;
  createdAt: string;
  bean?: string;
  cafe?: string;
  flavor?: string[];
  rating?: number;
  review?: string;
}

export default function HistoryPage() {
  const [user, setUser] = useState<any>(null);
  const [records, setRecords] = useState<RecordData[]>([]);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState<RecordData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setRecords([]);
      setLoading(false);
      return;
    }
    const fetchRecords = async () => {
      const q = query(collection(db, `users/${user.uid}/records`), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RecordData[]);
      setLoading(false);
    };
    fetchRecords();
  }, [user]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(records);
    } else {
      setFiltered(records.filter(r =>
        (r.bean || "").includes(search) ||
        (r.cafe || "").includes(search) ||
        (r.review || "").includes(search)
      ));
    }
  }, [search, records]);

  // 날짜별 그룹핑
  const grouped = filtered.reduce((acc, rec) => {
    const date = dayjs(rec.createdAt).format("YYYY-MM-DD");
    if (!acc[date]) acc[date] = [];
    acc[date].push(rec);
    return acc;
  }, {} as { [date: string]: RecordData[] });
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <main className="flex flex-col items-center min-h-screen pt-20 pb-20 bg-gradient-to-br from-amber-50 to-rose-100">
      <h1 className="text-2xl font-bold mb-2 text-espresso">내 기록 히스토리</h1>
      <div className="mb-6 text-mocha">총 {records.length}건{records.length > 0 && ` / 최근: ${dayjs(records[0]?.createdAt).format("YYYY-MM-DD")}`}</div>
      <div className="flex gap-2 mb-8 w-full max-w-md">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="카페/원두/리뷰 검색"
          className="flex-1 border rounded px-3 py-2"
        />
      </div>
      {loading ? (
        <div className="text-center py-10">로딩 중...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-10 text-mocha">아직 기록이 없습니다 ☕</div>
      ) : (
        <div className="w-full max-w-2xl">
          {dates.map(date => (
            <section key={date} className="mb-8">
              <div className="font-bold text-lg mb-2 text-caramel">{date}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {grouped[date].map(rec => (
                  <div key={rec.id} className="bg-white/90 rounded-xl shadow p-4 flex flex-col gap-2 border border-caramel">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-amber-500 text-xl">{rec.cafe || rec.bean ? "☕" : "📝"}</span>
                      <span className="font-bold text-espresso">{rec.cafe || rec.bean || "기록"}</span>
                      {rec.rating && <span className="ml-auto text-yellow-500">{"★".repeat(rec.rating)}{"☆".repeat(5 - rec.rating)}</span>}
                    </div>
                    {rec.flavor && <div className="text-xs text-mocha">향미: {Array.isArray(rec.flavor) ? rec.flavor.join(", ") : rec.flavor}</div>}
                    {rec.review && <div className="text-xs text-brown-700">{rec.review}</div>}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
} 