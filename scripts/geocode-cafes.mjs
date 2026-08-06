#!/usr/bin/env node
/**
 * 좌표가 없는 카페에 주소 기반 좌표를 채운다.
 *
 * Google Places의 좌표는 약관상 30일까지만 캐시할 수 있어 영구 저장이 안 된다.
 * 카카오 로컬 API의 주소 검색은 그런 제약이 없고 무료라 이쪽을 쓴다.
 * (카카오는 장소 사진을 주지 않으므로 사진은 계속 Places를 쓴다 — 역할이 다르다.)
 *
 * 도로명 주소로 먼저 찾고, 실패하면 키워드(장소명+주소) 검색으로 넘어간다.
 * 기본은 dry-run. --apply를 줘야 반영한다.
 */

import admin from "firebase-admin";

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY || "";
const ADDR_URL = "https://dapi.kakao.com/v2/local/search/address.json";
const KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";

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
  if (!KAKAO_KEY) {
    console.error("KAKAO_REST_API_KEY가 없다. 종료.");
    process.exit(1);
  }
  const db = initAdmin();

  console.log(apply ? "MODE: APPLY" : "MODE: DRY-RUN (--apply로 반영)");
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
