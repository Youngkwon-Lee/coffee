// 간단한 이미지 URL 수정 스크립트 (환경변수 없이)
const cafeUpdates = [
  { id: 'center-coffee', imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=300&fit=crop' },
  { id: 'nouvelle-vague', imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop' },
  { id: 'lowkey', imageUrl: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400&h=300&fit=crop' },
  { id: 'namusairo', imageUrl: 'https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=400&h=300&fit=crop' },
  { id: 'fritz', imageUrl: 'https://images.unsplash.com/photo-1506619216599-9d16d0903dfd?w=400&h=300&fit=crop' },
  { id: 'terarosa', imageUrl: 'https://images.unsplash.com/photo-1516486392848-8b67ef89f113?w=400&h=300&fit=crop' },
  { id: 'bluebottle', imageUrl: 'https://images.unsplash.com/photo-1516487266042-46c9a1162bb7?w=400&h=300&fit=crop' },
  { id: 'anthracite', imageUrl: 'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=400&h=300&fit=crop' }
];

console.log('카페 이미지 URL 목록:');
cafeUpdates.forEach(cafe => {
  console.log(`${cafe.id}: ${cafe.imageUrl}`);
});

console.log('\n✅ Unsplash 이미지 URL로 준비 완료');
console.log('Firebase 콘솔에서 수동으로 업데이트하거나 Next.js 앱에서 자동 변환됩니다.');