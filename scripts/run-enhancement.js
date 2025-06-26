/**
 * 원두 데이터 보완 실행 스크립트
 */

require('dotenv').config({ path: '.env' });
const { execSync } = require('child_process');

console.log('🚀 원두 데이터 보완 스크립트 실행');
console.log('환경변수 확인...');
console.log(`- Firebase Project ID: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '❌ 없음'}`);

try {
  // TypeScript 파일을 Node.js로 실행
  execSync('npx tsx scripts/enhance-bean-data.ts', {
    stdio: 'inherit',
    env: { ...process.env }
  });
} catch (error) {
  console.error('❌ 스크립트 실행 실패:', error.message);
  process.exit(1);
}