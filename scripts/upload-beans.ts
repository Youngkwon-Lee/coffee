const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, deleteDoc, doc, setDoc } = require("firebase/firestore");
const beans = require("../combined_coffee_beans.json");

interface Bean {
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

const firebaseConfig = {
  apiKey: "AIzaSyCcy5cm_7diVnjW0EmbejXWzvwqsDr53gw",
  authDomain: "coffee-37b81.firebaseapp.com",
  projectId: "coffee-37b81",
  storageBucket: "coffee-37b81.appspot.com",
  messagingSenderId: "931541737029",
  appId: "1:931541737029:web:3f24a512e5c157f837cd2c"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 중복 제거를 위한 함수
const removeDuplicates = (beans: Bean[]) => {
  const uniqueBeans = new Map<string, Bean>();
  
  beans.forEach((bean: Bean) => {
    // name을 기준으로 중복 체크
    if (!uniqueBeans.has(bean.name)) {
      uniqueBeans.set(bean.name, bean);
    }
  });
  
  return Array.from(uniqueBeans.values());
};

// 기존 데이터 삭제
const deleteAllBeans = async () => {
  try {
    const beansCol = collection(db, "beans");
    const snapshot = await getDocs(beansCol);
    const deletePromises = snapshot.docs.map((doc: any) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    console.log("기존 데이터 삭제 완료");
  } catch (error) {
    console.error("데이터 삭제 중 오류 발생:", error);
  }
};

// 새 데이터 업로드 (카페명_원두명 형식의 문서 ID 사용)
const uploadBeans = async () => {
  try {
    const beansCol = collection(db, "beans");
    // 중복 제거
    const uniqueBeans = removeDuplicates(beans as Bean[]);
    console.log(`총 ${beans.length}개 중 ${uniqueBeans.length}개의 고유한 원두 데이터가 있습니다.`);
    
    // 데이터 업로드
    for (const bean of uniqueBeans) {
      const cafe = (bean.brand || "").replace(/[^a-zA-Z0-9가-힣]/g, "_");
      const name = (bean.name || "").replace(/[^a-zA-Z0-9가-힣]/g, "_");
      const docId = `${cafe}_${name}`;
      await setDoc(doc(beansCol, docId), {
        ...bean,
        createdAt: new Date()
      });
    }
    console.log("데이터 업로드 완료");
  } catch (error) {
    console.error("데이터 업로드 중 오류 발생:", error);
  }
};

// 메인 실행 함수
async function runMain() {
  try {
    await deleteAllBeans();
    await uploadBeans();
    console.log("모든 작업이 완료되었습니다.");
  } catch (error) {
    console.error("작업 중 오류 발생:", error);
  }
}

runMain(); 