import { db } from '../src/firebase';
import { collection, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';

// 실제 카페 데이터
const cafeData = [
  {
    id: 'center-coffee',
    name: '센터커피',
    address: '서울 성동구 성수동1가 656-661',
    lat: 37.5447,
    lng: 127.0557,
    imageUrl: 'https://via.placeholder.com/400x300/8B4513/FFFFFF?text=센터커피',
    signature_menu: ['드립커피', '아메리카노', '에스프레소'],
    flavor_tags: ['Balanced', 'Chocolate', 'Nutty'],
    flavor_main: 'Balanced',
    features: {
      laptop_friendly: true,
      quiet: true,
      sunny: false,
      dessert: true,
      instagrammable: false
    },
    rating: 4.5,
    description: '성수동 스페셜티 커피 전문점으로 드립커피가 유명합니다.',
    phone: '02-1234-5678',
    website: 'https://centercoffee.co.kr',
    operatingHours: '월-금 07:00-22:00, 주말 08:00-22:00',
    tags: ['성수동', '조용함', '노트북가능', '디저트']
  },
  {
    id: 'nouvelle-vague',
    name: '누벨바그',
    address: '서울 마포구 연남동 223-14',
    lat: 37.5658,
    lng: 126.9236,
    imageUrl: 'https://via.placeholder.com/400x300/FF6B35/FFFFFF?text=누벨바그',
    signature_menu: ['프렌치프레스', '카페라떼', '크루아상'],
    flavor_tags: ['Floral', 'Bright', 'Clean'],
    flavor_main: 'Floral',
    features: {
      laptop_friendly: false,
      quiet: false,
      sunny: true,
      dessert: true,
      instagrammable: true
    },
    rating: 4.3,
    description: '연남동의 감성적인 프랑스 스타일 카페입니다.',
    phone: '02-2345-6789',
    website: null,
    operatingHours: '매일 10:00-22:00',
    tags: ['연남동', '인스타감성', '프랑스풍', '디저트']
  },
  {
    id: 'blue-bottle',
    name: '블루보틀',
    address: '서울 강남구 청담동 129-18',
    lat: 37.5196,
    lng: 127.0471,
    imageUrl: 'https://via.placeholder.com/400x300/2E86C1/FFFFFF?text=블루보틀',
    signature_menu: ['콜드브루', '시그니처블렌드', '플랫화이트'],
    flavor_tags: ['Bold', 'Dark', 'Intense'],
    flavor_main: 'Bold',
    features: {
      laptop_friendly: true,
      quiet: true,
      sunny: false,
      dessert: false,
      instagrammable: true
    },
    rating: 4.7,
    description: '세계적인 스페셜티 커피 브랜드의 청담점입니다.',
    phone: '02-3456-7890',
    website: 'https://bluebottlecoffee.com',
    operatingHours: '매일 07:00-21:00',
    tags: ['청담동', '스페셜티', '프리미엄', '인스타감성']
  },
  {
    id: 'anthracite',
    name: '앤쓰러사이트',
    address: '서울 성동구 성수동2가 269-9',
    lat: 37.5447,
    lng: 127.0557,
    imageUrl: 'https://via.placeholder.com/400x300/34495E/FFFFFF?text=앤쓰러사이트',
    signature_menu: ['핸드드립', '플랫화이트', '아인슈페너'],
    flavor_tags: ['Clean', 'Balanced', 'Smooth'],
    flavor_main: 'Clean',
    features: {
      laptop_friendly: true,
      quiet: true,
      sunny: true,
      dessert: true,
      instagrammable: true
    },
    rating: 4.6,
    description: '성수동 대표 로스터리 카페입니다.',
    phone: '02-4567-8901',
    website: 'https://anthracitecoffee.com',
    operatingHours: '월-금 08:00-21:00, 주말 09:00-21:00',
    tags: ['성수동', '로스터리', '핸드드립', '조용함']
  },
  {
    id: 'coffee-libre',
    name: '커피리브레',
    address: '서울 용산구 이태원동 722-7',
    lat: 37.5344,
    lng: 126.9942,
    imageUrl: 'https://via.placeholder.com/400x300/E74C3C/FFFFFF?text=커피리브레',
    signature_menu: ['아프리칸커피', '시그니처드립', '카페오레'],
    flavor_tags: ['Fruity', 'Bright', 'Complex'],
    flavor_main: 'Fruity',
    features: {
      laptop_friendly: true,
      quiet: false,
      sunny: true,
      dessert: true,
      instagrammable: true
    },
    rating: 4.4,
    description: '이태원의 개성 넘치는 아프리칸 스타일 카페입니다.',
    phone: '02-5678-9012',
    website: null,
    operatingHours: '매일 09:00-23:00',
    tags: ['이태원', '아프리칸', '독특함', '야간운영']
  },
  {
    id: 'fritz-coffee',
    name: '프릳츠커피',
    address: '서울 마포구 상수동 314-12',
    lat: 37.5478,
    lng: 126.9220,
    imageUrl: 'https://via.placeholder.com/400x300/F39C12/FFFFFF?text=프릳츠커피',
    signature_menu: ['에스프레소', '아인슈페너', '플랫화이트'],
    flavor_tags: ['Rich', 'Creamy', 'Nutty'],
    flavor_main: 'Rich',
    features: {
      laptop_friendly: true,
      quiet: false,
      sunny: true,
      dessert: true,
      instagrammable: true
    },
    rating: 4.8,
    description: '독일식 카페 문화를 선도하는 홍대 대표 카페입니다.',
    phone: '02-322-7805',
    website: 'https://fritzcoffeecompany.com',
    operatingHours: '월-목 07:30-22:00, 금-일 07:30-23:00',
    tags: ['홍대', '독일식', '아인슈페너']
  },
  {
    id: 'default-value',
    name: '디폴트벨류',
    address: '서울 용산구 한남동 683-142',
    lat: 37.5342,
    lng: 127.0016,
    imageUrl: 'https://via.placeholder.com/400x300/9B59B6/FFFFFF?text=디폴트벨류',
    signature_menu: ['시그니처 라떼', '바닐라 플랫화이트', '콜드브루'],
    flavor_tags: ['Smooth', 'Sweet', 'Balanced'],
    flavor_main: 'Smooth',
    features: {
      laptop_friendly: true,
      quiet: true,
      sunny: true,
      dessert: true,
      instagrammable: true
    },
    rating: 4.5,
    description: '한남동 감성 카페의 대표주자입니다.',
    phone: '02-749-1024',
    website: null,
    operatingHours: '매일 08:00-22:00',
    tags: ['한남동', '감성카페', '인스타그램성']
  },
  {
    id: 'lowkey',
    name: '로우키',
    address: '서울 성동구 성수동2가 289-5',
    lat: 37.5447,
    lng: 127.0557,
    imageUrl: 'https://via.placeholder.com/400x300/2C3E50/FFFFFF?text=로우키',
    signature_menu: ['시그니처 블렌드', '싱글오리진', '아포가또'],
    flavor_tags: ['Bold', 'Dark', 'Chocolate'],
    flavor_main: 'Bold',
    features: {
      laptop_friendly: true,
      quiet: true,
      sunny: false,
      dessert: true,
      instagrammable: false
    },
    rating: 4.6,
    description: '성수동의 진한 원두와 고급스러운 분위기의 카페입니다.',
    phone: '02-334-5627',
    website: null,
    operatingHours: '매일 09:00-23:00',
    tags: ['성수동', '고급스러운', '진한맛']
  },
  {
    id: 'namoo-sairo',
    name: '나무사이로',
    address: '서울 종로구 북촌로5길 19-4',
    lat: 37.5814,
    lng: 126.9849,
    imageUrl: 'https://via.placeholder.com/400x300/27AE60/FFFFFF?text=나무사이로',
    signature_menu: ['전통차', '핸드드립', '떡라떼'],
    flavor_tags: ['Traditional', 'Mild', 'Herbal'],
    flavor_main: 'Traditional',
    features: {
      laptop_friendly: false,
      quiet: true,
      sunny: true,
      dessert: true,
      instagrammable: true
    },
    rating: 4.7,
    description: '한옥 카페로 전통차와 커피를 함께 즐길 수 있습니다.',
    phone: '02-742-5901',
    website: null,
    operatingHours: '화-일 10:00-21:00, 월요일 휴무',
    tags: ['한옥카페', '북촌', '전통차']
  },
  {
    id: 'terarosa',
    name: '테라로사',
    address: '서울 강남구 신사동 549-8',
    lat: 37.5200,
    lng: 127.0238,
    imageUrl: 'https://via.placeholder.com/400x300/8E44AD/FFFFFF?text=테라로사',
    signature_menu: ['게이샤', '블루마운틴', '핸드드립'],
    flavor_tags: ['Premium', 'Fruity', 'Complex'],
    flavor_main: 'Premium',
    features: {
      laptop_friendly: true,
      quiet: true,
      sunny: true,
      dessert: true,
      instagrammable: true
    },
    rating: 4.9,
    description: '국내 최고급 스페셜티 커피 로스터리입니다.',
    phone: '02-544-2282',
    website: 'https://terarosa.com',
    operatingHours: '매일 07:00-22:00',
    tags: ['최고급', '로스터리', '게이샤']
  }
];

async function updateCafeData() {
  console.log('🔥 카페 데이터 업데이트 시작...');
  
  try {
    for (const cafe of cafeData) {
      const cafeRef = doc(db, 'cafes', cafe.id);
      
      // 기존 데이터 확인
      const existingDoc = await getDoc(cafeRef);
      
      const updateData = {
        ...cafe,
        lastUpdated: new Date().toISOString(),
        isActive: true
      };
      
      if (existingDoc.exists()) {
        // 기존 카페 업데이트
        await updateDoc(cafeRef, {
          ...updateData,
          // 기존 createdAt 유지
          createdAt: existingDoc.data().createdAt || new Date().toISOString()
        });
        console.log(`✅ 업데이트 완료: ${cafe.name}`);
      } else {
        // 새 카페 생성
        await setDoc(cafeRef, {
          ...updateData,
          createdAt: new Date().toISOString()
        });
        console.log(`🆕 신규 추가: ${cafe.name}`);
      }
    }
    
    console.log('🎉 모든 카페 데이터 업데이트 완료!');
    
  } catch (error) {
    console.error('❌ 카페 데이터 업데이트 실패:', error);
  }
}

// 스크립트 실행
updateCafeData(); 