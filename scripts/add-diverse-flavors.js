const admin = require('firebase-admin');
const serviceAccount = require('./firebase_credentials.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 다양한 향미 조합
const flavorCombinations = [
  "Citrus, Floral",
  "Berry-like, Fruity", 
  "Chocolate-like, Caramel",
  "Nutty, Vanilla-like",
  "Fruity, Sweet",
  "Herby, Earthy",
  "Spicy, Smoky",
  "Acidic, Citrus",
  "Floral, Sweet",
  "Berry-like, Winey",
  "Malty, Caramel",
  "Bitter, Earthy",
  "Candy-like, Sweet",
  "Syrup-like, Vanilla-like",
  "Tart, Acidic",
  "Mellow, Sweet",
  "Resinous, Herby",
  "Astringent, Bitter",
  "Sour, Tart",
  "Medicinal, Herby"
];

// 배전도 옵션
const roastLevels = ["Light", "Medium-Light", "Medium", "Medium-Dark", "Dark"];

// 브랜드별 원두 데이터
const newBeans = [
  // 블루보틀
  { name: "Blue Bottle Giant Steps", brand: "Blue Bottle Coffee", roast: "Medium", flavor: "Citrus, Chocolate-like" },
  { name: "Blue Bottle Bella Donovan", brand: "Blue Bottle Coffee", roast: "Medium-Dark", flavor: "Berry-like, Caramel" },
  { name: "Blue Bottle Hayes Valley Espresso", brand: "Blue Bottle Coffee", roast: "Medium-Dark", flavor: "Nutty, Sweet" },
  
  // 스텀프타운
  { name: "Stumptown Hair Bender", brand: "Stumptown Coffee", roast: "Medium", flavor: "Fruity, Floral" },
  { name: "Stumptown Holler Mountain", brand: "Stumptown Coffee", roast: "Medium", flavor: "Chocolate-like, Nutty" },
  { name: "Stumptown French Roast", brand: "Stumptown Coffee", roast: "Dark", flavor: "Smoky, Bitter" },
  
  // 인텔리젠시아
  { name: "Intelligentsia Black Cat Classic", brand: "Intelligentsia Coffee", roast: "Medium-Dark", flavor: "Caramel, Vanilla-like" },
  { name: "Intelligentsia House Blend", brand: "Intelligentsia Coffee", roast: "Medium", flavor: "Citrus, Floral" },
  
  // 카운터컬처
  { name: "Counter Culture Fast Forward", brand: "Counter Culture Coffee", roast: "Light", flavor: "Berry-like, Acidic" },
  { name: "Counter Culture Hologram", brand: "Counter Culture Coffee", roast: "Medium-Light", flavor: "Floral, Sweet" },
  
  // 커피빈앤티리프
  { name: "Coffee Bean Original Blend", brand: "Coffee Bean & Tea Leaf", roast: "Medium", flavor: "Nutty, Malty" },
  { name: "Coffee Bean Italian Roast", brand: "Coffee Bean & Tea Leaf", roast: "Dark", flavor: "Smoky, Bitter" },
  
  // 스타벅스 (더 다양하게)
  { name: "Starbucks Guatemala Antigua", brand: "Starbucks", roast: "Medium", flavor: "Spicy, Herby" },
  { name: "Starbucks Ethiopia", brand: "Starbucks", roast: "Medium", flavor: "Fruity, Winey" },
  { name: "Starbucks Kenya", brand: "Starbucks", roast: "Medium", flavor: "Berry-like, Acidic" },
  { name: "Starbucks Colombia", brand: "Starbucks", roast: "Medium", flavor: "Nutty, Caramel" },
  { name: "Starbucks Costa Rica", brand: "Starbucks", roast: "Medium-Light", flavor: "Citrus, Sweet" },
  
  // 할리스
  { name: "Hollys Colombia Supremo", brand: "Hollys Coffee", roast: "Medium", flavor: "Chocolate-like, Sweet" },
  { name: "Hollys Ethiopia Yirgacheffe", brand: "Hollys Coffee", roast: "Light", flavor: "Floral, Citrus" },
  { name: "Hollys Guatemala Huehuetenango", brand: "Hollys Coffee", roast: "Medium", flavor: "Fruity, Acidic" },
  
  // 이디야
  { name: "Ediya Brazil Santos", brand: "Ediya Coffee", roast: "Medium", flavor: "Nutty, Malty" },
  { name: "Ediya Ethiopia Sidamo", brand: "Ediya Coffee", roast: "Light", flavor: "Berry-like, Floral" },
  { name: "Ediya Kenya AA", brand: "Ediya Coffee", roast: "Medium", flavor: "Winey, Acidic" },
  
  // 투썸플레이스
  { name: "Twosome House Blend", brand: "Twosome Place", roast: "Medium", flavor: "Vanilla-like, Sweet" },
  { name: "Twosome Colombia", brand: "Twosome Place", roast: "Medium", flavor: "Caramel, Nutty" },
  
  // 파스쿠찌
  { name: "Pascucci Arabica Blend", brand: "Pascucci", roast: "Medium-Dark", flavor: "Chocolate-like, Bitter" },
  { name: "Pascucci Single Origin", brand: "Pascucci", roast: "Medium", flavor: "Fruity, Sweet" },
  
  // 컴포즈커피
  { name: "Compose Americano Blend", brand: "Compose Coffee", roast: "Medium", flavor: "Mellow, Sweet" },
  { name: "Compose Premium", brand: "Compose Coffee", roast: "Medium-Dark", flavor: "Nutty, Caramel" },
  
  // 빽다방
  { name: "Paik Original Blend", brand: "Paiks Coffee", roast: "Medium", flavor: "Balanced, Sweet" },
  { name: "Paik Premium", brand: "Paiks Coffee", roast: "Medium-Dark", flavor: "Rich, Chocolate-like" }
];

async function addDiverseBeans() {
  try {
    console.log('다양한 향미의 원두 데이터 추가 중...');
    
    const batch = db.batch();
    
    newBeans.forEach((bean, index) => {
      const docRef = db.collection('beans').doc();
      batch.set(docRef, {
        ...bean,
        price: `${Math.floor(Math.random() * 20000) + 15000}원`,
        image: "/beans/default.jpg",
        desc: `${bean.brand}의 ${bean.name}은 ${bean.flavor} 향미를 가진 ${bean.roast} 배전의 원두입니다.`,
        category: "premium",
        createdAt: new Date(),
        lastUpdated: new Date()
      });
    });
    
    await batch.commit();
    console.log(`${newBeans.length}개의 다양한 향미 원두가 추가되었습니다!`);
    
    // 향미 분포 확인
    const flavors = {};
    newBeans.forEach(bean => {
      bean.flavor.split(', ').forEach(f => {
        flavors[f] = (flavors[f] || 0) + 1;
      });
    });
    
    console.log('\n향미 분포:');
    Object.entries(flavors).sort(([,a], [,b]) => b - a).forEach(([flavor, count]) => {
      console.log(`${flavor}: ${count}개`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('오류:', error);
    process.exit(1);
  }
}

addDiverseBeans(); 