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

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/reset_all_active_cafes_from_crawl.mjs <crawl-json>');
  process.exit(1);
}

const crawled = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
fs.mkdirSync('reports', { recursive: true });

function stableBeanId(bean) {
  const s = `${bean.name || ''}_${bean.brand || ''}_${bean.url || bean.link || ''}`;
  return crypto.createHash('md5').update(s).digest('hex').slice(0, 16);
}

function slugId(name) {
  return `_${String(name || '').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '_').replace(/^_+|_+$/g, '')}`;
}

function normalizeBean(bean) {
  const now = new Date();
  const image = bean.image || (Array.isArray(bean.images) && bean.images[0]) || null;
  const link = bean.link || bean.url || '';
  const out = {
    name: bean.name,
    brand: bean.brand,
    price: bean.price,
    origin: bean.origin,
    roast: bean.roast,
    flavor: bean.flavor,
    process: bean.process,
    variety: bean.variety,
    producer: bean.producer,
    region: bean.region,
    altitude: bean.altitude,
    category: bean.category,
    image,
    images: bean.images,
    link,
    url: bean.url || link,
    flavor_notes: bean.flavor_notes,
    flavors: bean.flavors,
    processing: bean.processing,
    description: bean.description,
    cafe_id: bean.cafe_id,
    weight_g: bean.weight_g,
    isActive: true,
    active: true,
    isSample: false,
    linkStatus: link ? 'ok' : 'invalid',
    createdAt: now,
    lastUpdated: now,
    updatedAt: now,
  };
  Object.keys(out).forEach((k) => (out[k] == null || out[k] === '') && delete out[k]);
  out.id = `${out.brand}${slugId(out.name)}`;
  out.hash = crypto.createHash('md5').update(JSON.stringify({
    name: out.name, brand: out.brand, price: out.price, origin: out.origin, process: out.process,
    variety: out.variety, region: out.region, image: out.image, url: out.url, weight_g: out.weight_g
  })).digest('hex');
  return out;
}

const normalized = crawled.map(normalizeBean);
const brands = [...new Set(normalized.map((x) => x.brand).filter(Boolean))].sort();
const summary = [];

for (const brand of brands) {
  const newRows = normalized.filter((x) => x.brand === brand);
  const existingSnap = await db.collection('beans').where('brand', '==', brand).get();
  const existingRows = existingSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const backupPath = `reports/${brand.replace(/[^a-zA-Z0-9가-힣]+/g, '_')}-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(existingRows, null, 2));

  let batch = db.batch();
  let ops = 0;
  let batches = 0;
  for (const d of existingSnap.docs) {
    batch.delete(db.collection('beans').doc(d.id));
    ops++;
    if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; batches++; }
  }
  for (const row of newRows) {
    batch.set(db.collection('beans').doc(stableBeanId(row)), row);
    ops++;
    if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; batches++; }
  }
  if (ops > 0) { await batch.commit(); batches++; }

  const verifySnap = await db.collection('beans').where('brand', '==', brand).get();
  const verifyRows = verifySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  summary.push({
    brand,
    backupPath,
    oldCount: existingRows.length,
    newCount: newRows.length,
    finalCount: verifyRows.length,
    empty: verifyRows.filter((x) => !String(x.link || x.url || '').trim()).length,
    placeholder: verifyRows.filter((x) => String(x.link || x.url || '').includes('example.com')).length,
    dead: verifyRows.filter((x) => x.linkStatus === 'dead').length,
    batches,
  });
  console.log(`done ${brand} old=${existingRows.length} new=${newRows.length} final=${verifyRows.length}`);
}

console.log(JSON.stringify(summary, null, 2));
