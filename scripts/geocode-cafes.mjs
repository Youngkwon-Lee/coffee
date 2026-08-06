#!/usr/bin/env node
/**
 * 좌표가 없는 카페에 주소 기반 좌표를 채운다.
 *
 * Google Places의 좌표는 약관상 30일까지만 캐시할 수 있어 영구 저장이 안 된다.
 * 그래서 지오코딩은 별도 출처를 쓴다.
 *
 * 기본은 Nominatim(OpenStreetMap) — API 키가 필요 없다. 대신 이용 정책상
 * 초당 1건 이하로 제한하고 연락처가 담긴 User-Agent를 보내야 한다. 대량 작업에는
 * 맞지 않으므로, 대상이 많아지면 KAKAO_REST_API_KEY를 넣어 카카오로 전환한다
 * (카카오는 좌표 저장 제약이 없고 한국 주소 정확도가 더 높다).
 *
 * 기본은 dry-run. --apply를 줘야 반영한다.
 */

import admin from "firebase-admin";

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY || "";
const ADDR_URL = "https://dapi.kakao.com/v2/local/search/address.json";
const KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const CONTACT = process.env.GEOCODE_CONTACT || "kwon3856@gmail.com";
const USER_AGENT = `wondu-radar/1.0 (cafe geocoding; contact: ${CONTACT})`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Nominatim 조회. 키 불필요, 초당 1건 제한을 지킨다. */
async function nominatim(query) {
  const params = new URLSearchParams({
    format: "json",
    limit: "1",
    countrycodes: "kr",
    q: query,
  });
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const j = await res.json();
  const hit = j?.[0];
  if (!hit) return null;
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    via: `OSM "${String(hit.display_name).slice(0, 50)}"`,
  };
}

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  } else {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  return admin.firestore();
}

/** 층·호 정보는 지오코딩을 방해한다. */
function cleanAddress(addr) {
  return String(addr || "")
    .replace(/,.*$/, "")
    .replace(/\s*\d+층.*$/, "")
    .replace(/\(.*?\)/g, "")
    .trim();
}

async function kakao(url, params) {
  const res = await fetch(`${url}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  if (!res.ok) throw new Error(`kakao ${res.status}`);
  return res.json();
}

async function resolveCoords(name, address) {
  const clean = cleanAddress(address);

  // 키가 없으면 Nominatim으로 처리한다.
  if (!KAKAO_KEY) {
    if (!clean) return null;
    const hit = await nominatim(clean);
    await sleep(1200); // 이용 정책: 초당 1건 이하
    return hit;
  }

  if (clean) {
    const a = await kakao(ADDR_URL, { query: clean });
    const hit = a.documents?.[0];
    if (hit) {
      return { lat: Number(hit.y), lng: Number(hit.x), via: `주소 "${clean}"` };
    }
  }

  // 주소로 못 찾으면 장소명으로 시도한다.
  const k = await kakao(KEYWORD_URL, { query: `${name} ${clean}`.trim(), size: 1 });
  const hit = k.documents?.[0];
  if (hit) {
    return {
      lat: Number(hit.y),
      lng: Number(hit.x),
      via: `키워드 "${hit.place_name}" (${hit.road_address_name || hit.address_name})`,
    };
  }
  return null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const db = initAdmin();

  console.log(apply ? "MODE: APPLY" : "MODE: DRY-RUN (--apply로 반영)");
  console.log(KAKAO_KEY ? "출처: 카카오 로컬" : "출처: Nominatim(OSM) — 키 없음, 초당 1건 제한");
  const snap = await db.collection("cafes").get();

  let filled = 0;
  let failed = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (Number.isFinite(d.lat) && Number.isFinite(d.lng)) {
      skipped++;
      continue;
    }
    const name = d.name || doc.id;
    let got = null;
    try {
      got = await resolveCoords(name, d.address);
    } catch (e) {
      console.log(`ERROR  ${name}: ${e.message}`);
      failed++;
      continue;
    }
    if (!got) {
      console.log(`없음   ${name} (${d.address || "주소 없음"})`);
      failed++;
      continue;
    }
    filled++;
    console.log(`채움   ${name}  →  ${got.lat}, ${got.lng}`);
    console.log(`         ${got.via}`);
    if (apply) {
      await doc.ref.set({ lat: got.lat, lng: got.lng }, { merge: true });
    }
  }

  console.log("");
  console.log(`요약: 채움 ${filled} / 실패 ${failed} / 이미있음 ${skipped}`);
}

main().catch((err) => {
  console.error("실패:", err);
  process.exit(1);
});
