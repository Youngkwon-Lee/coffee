import { collection, getDocs, setDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { cafesData } from "@/data/cafesData";

export async function upsertCafesWithPurchase() {
  const snapshot = await getDocs(collection(db, "cafes"));
  const nameToId: Record<string, string> = {};
  snapshot.docs.forEach(docSnap => {
    nameToId[docSnap.data().name] = docSnap.id;
  });

  for (const cafe of cafesData) {
    if (nameToId[cafe.name]) {
      // 이미 있는 카페: purchase 필드만 업데이트
      await updateDoc(doc(db, "cafes", nameToId[cafe.name]), {
        purchase: cafe.purchase
      });
      console.log(`업데이트: ${cafe.name}`);
    } else {
      // 없는 카페: 새로 추가
      await setDoc(doc(collection(db, "cafes")), cafe);
      console.log(`신규 추가: ${cafe.name}`);
    }
  }
  console.log("모든 작업 완료!");
} 