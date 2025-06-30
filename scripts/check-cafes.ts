import { db } from "../src/firebase";
import { collection, getDocs } from "firebase/firestore";

async function checkCafes() {
  console.log("카페 데이터 확인 중...");
  
  try {
    const cafesSnapshot = await getDocs(collection(db, "cafes"));
    console.log(`총 카페 수: ${cafesSnapshot.size}개`);
    
    if (cafesSnapshot.size === 0) {
      console.log("❌ 카페 데이터가 없습니다!");
      console.log("샘플 카페 데이터를 추가해야 합니다.");
    } else {
      console.log("✅ 카페 데이터 목록:");
      cafesSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`- ${data.name}: ${data.address}`);
      });
    }
    
    // 원두 데이터도 확인
    const beansSnapshot = await getDocs(collection(db, "beans"));
    console.log(`\n총 원두 수: ${beansSnapshot.size}개`);
    
  } catch (error) {
    console.error("Firebase 데이터 확인 실패:", error);
  }
}

checkCafes();