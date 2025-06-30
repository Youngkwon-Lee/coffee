const admin = require('firebase-admin');

// Firebase Admin 초기화
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'coffee-37b81'
  });
}

const db = admin.firestore();

const sampleCafes = [
  {
    id: "centercoffee-hongdae",
    name: "센터커피 홍대점",
    address: "서울 마포구 와우산로29길 19",
    lat: 37.5563,
    lng: 126.9235,
    tags: ["로스터리", "조용함", "노트북 가능"],
    flavor: "Chocolate",
    flavor_tags: ["Chocolate", "Nutty"],
    signature_menu: ["싱글 오리진", "블렌드"],
    rating: 4.5,
    imageUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&h=200&fit=crop",
    features: {
      laptop_friendly: true,
      quiet: true,
      sunny: false,
      dessert: false,
      instagrammable: true
    }
  },
  {
    id: "fritz-coffee-itaewon",
    name: "프릳츠커피 이태원점",
    address: "서울 용산구 이태원로 246",
    lat: 37.5347,
    lng: 126.9941,
    tags: ["로스터리", "채광 좋음", "포토존"],
    flavor: "Fruity",
    flavor_tags: ["Fruity", "Floral"],
    signature_menu: ["드립커피", "에스프레소"],
    rating: 4.3,
    imageUrl: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=300&h=200&fit=crop",
    features: {
      laptop_friendly: false,
      quiet: false,
      sunny: true,
      dessert: true,
      instagrammable: true
    }
  },
  {
    id: "lowkey-coffee-gangnam",
    name: "로우키커피 강남점",
    address: "서울 강남구 테헤란로 143",
    lat: 37.5012,
    lng: 127.0396,
    tags: ["조용함", "노트북 가능", "베이커리"],
    flavor: "Nutty",
    flavor_tags: ["Nutty", "Sweet"],
    signature_menu: ["콜드브루", "라떼", "크루아상"],
    rating: 4.4,
    imageUrl: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=300&h=200&fit=crop",
    features: {
      laptop_friendly: true,
      quiet: true,
      sunny: true,
      dessert: true,
      instagrammable: false
    }
  },
  {
    id: "terarosa-seoul",
    name: "테라로사 서울숲점",
    address: "서울 성동구 뚝섬로1길 30",
    lat: 37.5447,
    lng: 127.0424,
    tags: ["로스터리", "채광 좋음", "테이스팅룸"],
    flavor: "Earthy",
    flavor_tags: ["Earthy", "Chocolate"],
    signature_menu: ["시그니처 블렌드", "드립커피"],
    rating: 4.6,
    imageUrl: "https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=300&h=200&fit=crop",
    features: {
      laptop_friendly: false,
      quiet: false,
      sunny: true,
      dessert: false,
      instagrammable: true
    }
  },
  {
    id: "momos-coffee-yeonnam",
    name: "모모스커피 연남점",
    address: "서울 마포구 연남로1길 7",
    lat: 37.5643,
    lng: 126.9258,
    tags: ["조용함", "베이커리", "포토존"],
    flavor: "Sweet",
    flavor_tags: ["Sweet", "Floral"],
    signature_menu: ["시그니처 음료", "베이커리 플래터"],
    rating: 4.2,
    imageUrl: "https://images.unsplash.com/photo-1506619216599-9d16d0903dfd?w=300&h=200&fit=crop",
    features: {
      laptop_friendly: true,
      quiet: true,
      sunny: false,
      dessert: true,
      instagrammable: true
    }
  }
];

async function addSampleCafes() {
  console.log("샘플 카페 데이터 추가 중...");
  
  try {
    const batch = db.batch();
    
    for (const cafe of sampleCafes) {
      const cafeRef = db.collection('cafes').doc(cafe.id);
      batch.set(cafeRef, {
        ...cafe,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ 카페 준비: ${cafe.name}`);
    }
    
    await batch.commit();
    console.log(`\n🎉 총 ${sampleCafes.length}개 카페 추가 완료!`);
    
  } catch (error) {
    console.error("❌ 카페 추가 실패:", error);
  }
}

addSampleCafes();