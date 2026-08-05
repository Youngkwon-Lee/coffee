#!/usr/bin/env node
/**
 * 카페 문서에 Google Places의 place_id를 채운다.
 *
 * place_id는 Places 정책상 무기한 저장이 허용되는 유일한 값이다(사진 URL은 안 된다).
 * 이 값만 저장해두면 표시 시점에 /api/cafe-photo가 사진을 받아온다.
 *
 * 이름+주소로 Text Search를 돌리고, 결과가 여럿이거나 이름이 크게 다르면 건너뛴다.
 * 엉뚱한 가게를 붙이면 사용자에게 다른 매장 사진을 보여주게 된다.
 *
 * 기본은 dry-run. --apply를 줘야 반영한다.
 */

import admin from "firebase-admin";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";
const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  } else {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  return admin.firestore();
}

/** 이름 비교용 정규화: 공백·괄호·지점 표기를 걷어낸다. */
function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[\s\-_.]/g, "")
    .replace(/(점|store|coffee|커피|로스터스|로스터리)/g, "");
}

/** 문자 바이그램 Dice 계수. 표기가 조금 다른 같은 가게를 잡아낸다. */
function dice(a, b) {
  const grams = (x) => {
    const set = new Set();
    for (let i = 0; i < x.length - 1; i++) set.add(x.slice(i, i + 2));
    return set;
  };
  const A = grams(a);
  const B = grams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

/** 두 좌표 사이 거리(m). */
function distanceMeters(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every((v) => Number.isFinite(v))) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * 매칭 판정.
 *
 * 이름만 보면 "센터커피 명동점"과 "센터커피 롯데명동점"을 놓치고,
 * 거리만 보면 "헬카페 신사"에 근처의 "히트커피로스터스 신사"가 붙는다.
 * 둘을 함께 본다. 후보 이름에는 문서의 aliases(로마자 변형 포함)도 넣어
 * "생추어리 (Sanctuary)" ↔ "Sanctuary" 같은 표기 차이를 흡수한다.
 */
function judge(candidates, googleName, meters) {
  const got = normalize(googleName);
  if (!got) return { ok: false, why: "구글 이름 없음" };

  let best = 0;
  for (const c of candidates) {
    const want = normalize(c);
    if (!want) continue;
    if (got.includes(want) || want.includes(got)) return { ok: true, why: "이름 포함" };
    best = Math.max(best, dice(want, got));
  }

  if (best >= 0.6) return { ok: true, why: `이름 유사 ${best.toFixed(2)}` };
  if (meters <= 30) return { ok: true, why: `같은 지점 ${Math.round(meters)}m` };
  if (meters <= 120 && best >= 0.3)
    return { ok: true, why: `근접 ${Math.round(meters)}m + 유사 ${best.toFixed(2)}` };

  return {
    ok: false,
    why: Number.isFinite(meters) ? `유사 ${best.toFixed(2)} / ${Math.round(meters)}m` : `유사 ${best.toFixed(2)} / 좌표없음`,
  };
}

async function searchPlace(name, address) {
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({
      textQuery: `${name} ${address || ""}`.trim(),
      languageCode: "ko",
      regionCode: "KR",
      maxResultCount: 3,
    }),
  });
  if (!res.ok) throw new Error(`searchText ${res.status}`);
  const j = await res.json();
  return j.places || [];
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (!API_KEY) {
    console.error("GOOGLE_PLACES_API_KEY가 없다. 종료.");
    process.exit(1);
  }
  const db = initAdmin();

  console.log(apply ? "MODE: APPLY" : "MODE: DRY-RUN (--apply로 반영)");
  const snap = await db.collection("cafes").get();

  let matched = 0;
  let ambiguous = 0;
  let notFound = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (d.googlePlaceId) {
      skipped++;
      continue;
    }
    const name = d.name || "";
    const address = d.address || "";
    if (!name) {
      skipped++;
      continue;
    }

    let places = [];
    try {
      places = await searchPlace(name, address);
    } catch (e) {
      console.log(`ERROR  ${name}: ${e.message}`);
      continue;
    }

    if (!places.length) {
      notFound++;
      console.log(`없음   ${name}`);
      continue;
    }

    // 후보를 여러 개 훑어 가장 그럴듯한 것을 고른다.
    const candidates = [name, ...(Array.isArray(d.aliases) ? d.aliases : [])];
    let picked = null;
    for (const cand of places) {
      const meters = distanceMeters(
        Number(d.lat), Number(d.lng),
        Number(cand.location?.latitude), Number(cand.location?.longitude)
      );
      const verdict = judge(candidates, cand.displayName?.text, meters);
      if (verdict.ok) {
        picked = { cand, verdict, meters };
        break;
      }
      if (!picked) picked = { cand, verdict, meters, rejected: true };
    }

    if (!picked || picked.rejected) {
      ambiguous++;
      const c = picked?.cand;
      console.log(`모호   ${name}  ←  "${c?.displayName?.text}" (${c?.formattedAddress}) — ${picked?.verdict?.why} — 건너뜀`);
      continue;
    }

    const top = picked.cand;
    matched++;
    console.log(`매칭   ${name}  →  ${top.id}  [${picked.verdict.why}]`);
    console.log(`         "${top.displayName?.text}" / ${top.formattedAddress}`);
    if (apply) {
      await doc.ref.set({ googlePlaceId: top.id }, { merge: true });
    }
  }

  console.log("");
  console.log(`요약: 매칭 ${matched} / 모호 ${ambiguous} / 없음 ${notFound} / 건너뜀 ${skipped}`);
}

main().catch((err) => {
  console.error("실패:", err);
  process.exit(1);
});
