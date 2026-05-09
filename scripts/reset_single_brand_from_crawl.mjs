import fs from 'fs';
import crypto from 'crypto';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCcy5cm_7diVnjW0EmbejXWzvwqsDr53gw',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'coffee-37b81.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'coffee-37b81',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'coffee-37b81.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '931541737029',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:931541737029:web:3f24a512e5c157f837cd2c'
};

const [inputPath, brand] = process.argv.slice(2);
if (!inputPath || !brand) {
  console.error('Usage: node scripts/reset_single_brand_from_crawl.mjs <crawl-json> <brand>');
  process.exit(1);
}

const rows = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
fs.mkdirSync('reports', { recursive: true });

const filtered = rows.filter((x) => String(x.brand || '').trim() === brand);
const snap = await getDocs(query(collection(db, 'beans'), where('brand', '==', brand)));
fs.writeFileSync(`reports/${brand.replace(/[^a-zA-Z0-9가-힣]+/g,'_')}-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`, JSON.stringify(snap.docs.map(d => ({ id: d.id, ...d.data() })), null, 2));

const batch = writeBatch(db);
for (const d of snap.docs) batch.delete(doc(db, 'beans', d.id));
for (const row of filtered) {
  const s = `${row.name || ''}_${row.brand || ''}_${row.url || row.link || ''}`;
  const id = crypto.createHash('md5').update(s).digest('hex').slice(0, 16);
  batch.set(doc(db, 'beans', id), row);
}
await batch.commit();
console.log(JSON.stringify({ brand, rows: filtered.length, deleted: snap.size }, null, 2));
