const admin = require('firebase-admin');

// Firebase Admin 초기화
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'coffee-37b81'
  });
}

const db = admin.firestore();

// 카페별 대표 이미지 (실제 카페 외관/내부 사진을 찾아서 추가)
const cafeImages = {
  "centercoffee-hongdae": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=300&fit=crop", // 모던 로스터리
  "fritz-coffee-itaewon": "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400&h=300&fit=crop", // 인더스트리얼
  "lowkey-coffee-gangnam": "https://images.unsplash.com/photo-1506619216599-9d16d0903dfd?w=400&h=300&fit=crop", // 미니멀
  "terarosa-seoul": "https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=400&h=300&fit=crop", // 클래식
  "momos-coffee-yeonnam": "https://images.unsplash.com/photo-1516487266042-46c9a1162bb7?w=400&h=300&fit=crop", // 아늑한
};

async function addCafeImages() {
  console.log("카페 이미지 URL 추가 중...");
  
  try {
    const batch = db.batch();
    
    for (const [cafeId, imageUrl] of Object.entries(cafeImages)) {
      const cafeRef = db.collection('cafes').doc(cafeId);
      batch.update(cafeRef, {
        imageUrl: imageUrl,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ 카페 이미지 추가: ${cafeId}`);
    }
    
    await batch.commit();
    console.log(`\n🎉 총 ${Object.keys(cafeImages).length}개 카페 이미지 추가 완료!`);
    
  } catch (error) {
    console.error("❌ 카페 이미지 추가 실패:", error);
  }
}

addCafeImages();