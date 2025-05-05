import { useEffect, useState } from "react";
import { db, auth } from "@/firebase";
import { collection, getDocs, query } from "firebase/firestore";

export default function useFrequentCafes() {
  const [frequentCafes, setFrequentCafes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        setFrequentCafes([]);
        setLoading(false);
        return;
      }
      const q = query(collection(db, "users", user.uid, "records"));
      const snapshot = await getDocs(q);
      const cafeCount: Record<string, number> = {};
      snapshot.forEach(doc => {
        const cafe = doc.data().cafe;
        if (cafe) {
          cafeCount[cafe] = (cafeCount[cafe] || 0) + 1;
        }
      });
      const sorted = Object.entries(cafeCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cafe]) => cafe);
      setFrequentCafes(sorted);
      setLoading(false);
    };
    fetchRecords();
  }, []);

  return { frequentCafes, loading };
} 