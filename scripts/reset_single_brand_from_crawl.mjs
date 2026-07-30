import fs from 'fs';
import crypto from 'crypto';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// firestore.rules가 beans 쓰기를 admin/system 클레임으로 제한하므로 Admin SDK 필수
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'firebase_credentials.json';
const app = fs.existsSync(credPath)
  ? initializeApp({ credential: cert(JSON.parse(fs.readFileSync(credPath, 'utf8'))) })
  : initializeApp({ credential: applicationDefault(), projectId: 'coffee-37b81' });
const db = getFirestore(app);

const [inputPath, brand] = process.argv.slice(2);
if (!inputPath || !brand) {
  console.error('Usage: node scripts/reset_single_brand_from_crawl.mjs <crawl-json> <brand>');
  process.exit(1);
}

const rows = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
fs.mkdirSync('reports', { recursive: true });

const filtered = rows.filter((x) => String(x.brand || '').trim() === brand);
const snap = await db.collection('beans').where('brand', '==', brand).get();
fs.writeFileSync(`reports/${brand.replace(/[^a-zA-Z0-9가-힣]+/g,'_')}-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`, JSON.stringify(snap.docs.map(d => ({ id: d.id, ...d.data() })), null, 2));

let batch = db.batch();
let ops = 0;
for (const d of snap.docs) {
  batch.delete(db.collection('beans').doc(d.id));
  ops++;
  if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
}
for (const row of filtered) {
  const s = `${row.name || ''}_${row.brand || ''}_${row.url || row.link || ''}`;
  const id = crypto.createHash('md5').update(s).digest('hex').slice(0, 16);
  batch.set(db.collection('beans').doc(id), row);
  ops++;
  if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
}
if (ops > 0) await batch.commit();
console.log(JSON.stringify({ brand, rows: filtered.length, deleted: snap.size }, null, 2));
