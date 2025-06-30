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

// 환경변수에서 Firebase 설정 로드
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// 필수 환경변수 체크
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error('Firebase environment variables not found. Please check your .env file.');
}

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