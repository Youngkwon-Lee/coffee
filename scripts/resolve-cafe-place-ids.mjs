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

async function searchPlace(name, address) {
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
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

    const top = places[0];
    const want = normalize(name);
    const got = normalize(top.displayName?.text);
    // 이름이 서로 포함관계도 아니면 다른 가게로 본다.
    if (!want || !got || (!got.includes(want) && !want.includes(got))) {
      ambiguous++;
      console.log(`모호   ${name}  ←  "${top.displayName?.text}" (${top.formattedAddress}) — 건너뜀`);
      continue;
    }

    matched++;
    console.log(`매칭   ${name}  →  ${top.id}`);
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
