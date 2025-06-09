import admin from 'firebase-admin';

// Firebase 초기화
if (!admin.apps.length) {
  const serviceAccount = require('../firebase_credentials.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'coffee-37b81'
  });
}

async function updateAuthorizedDomains() {
  try {
    // 현재 승인된 도메인들 가져오기
    const config = await admin.projectConfig();
    
    // 새로 추가할 도메인들
    const newDomains = [
      'coffee-3m78raw6l-22s-projects-de7c705f.vercel.app',
      'coffee-46m79pti5-22s-projects-de7c705f.vercel.app', 
      'coffee-1uwfjpn5p-22s-projects-de7c705f.vercel.app',
      'localhost'
    ];

    console.log('새 도메인들을 Firebase에 추가 중...');
    console.log('도메인 목록:', newDomains);

    // 실제로는 Firebase Console에서 수동으로 추가해야 함
    console.log('\n🔧 수동으로 Firebase Console에서 다음 작업을 수행하세요:');
    console.log('1. Firebase Console → Authentication → Settings');
    console.log('2. Authorized domains 섹션에서 "Add domain" 클릭');
    console.log('3. 다음 도메인들을 하나씩 추가:');
    newDomains.forEach(domain => {
      console.log(`   - ${domain}`);
    });

    return true;
  } catch (error) {
    console.error('에러 발생:', error);
    return false;
  }
}

updateAuthorizedDomains(); 