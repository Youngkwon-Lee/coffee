import fs from 'fs';
import crypto from 'crypto';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCcy5cm_7diVnjW0EmbejXWzvwqsDr53gw',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'coffee-37b81.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'coffee-37b81',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'coffee-37b81.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '931541737029',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:931541737029:web:3f24a512e5c157f837cd2c'
};

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/reset_all_active_cafes_from_crawl.mjs <crawl-json>');
  process.exit(1);
}

const crawled = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
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
  const existingSnap = await getDocs(query(collection(db, 'beans'), where('brand', '==', brand)));
  const existingRows = existingSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const backupPath = `reports/${brand.replace(/[^a-zA-Z0-9가-힣]+/g, '_')}-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(existingRows, null, 2));

  let batch = writeBatch(db);
  let ops = 0;
  let batches = 0;
  for (const d of existingSnap.docs) {
    batch.delete(doc(db, 'beans', d.id));
    ops++;
    if (ops >= 400) { await batch.commit(); batch = writeBatch(db); ops = 0; batches++; }
  }
  for (const row of newRows) {
    batch.set(doc(db, 'beans', stableBeanId(row)), row);
    ops++;
    if (ops >= 400) { await batch.commit(); batch = writeBatch(db); ops = 0; batches++; }
  }
  if (ops > 0) { await batch.commit(); batches++; }

  const verifySnap = await getDocs(query(collection(db, 'beans'), where('brand', '==', brand)));
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
