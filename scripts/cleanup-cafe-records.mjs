#!/usr/bin/env node
/**
 * 카페 문서 정리 (Admin SDK).
 *
 * cafes 컬렉션은 rules상 admin/system만 쓸 수 있어 클라이언트로는 손댈 수 없다.
 * 정리 대상은 코드에 명시하고, 기본은 dry-run이다. --apply를 줘야 실제로 반영한다.
 *
 * 2025-06-09 시드 배치에 실제와 다른 값이 섞여 들어왔다:
 * - 누벨바그: 실존 확인 불가(공식 사이트 없음, 전화 02-2345-6789는 자리표시자)
 * - 센터커피: 실존 로스터리지만 전화가 02-1234-5678로 조작됨.
 *   문서는 남기고 번호만 비운다 — 틀린 번호는 없는 것보다 나쁘다.
 */

import admin from "firebase-admin";

const DELETE_DOCS = [
  { id: "nouvelle-vague", reason: "실존 확인 불가, 시드 자리표시자 데이터" },
  // 아래 둘은 지점명이 있는 문서와 같은 가게다(지번 주소 vs 도로명 주소).
  // 지점을 보여주는 쪽(default-value-hannam, "로우키 성수")을 남긴다.
  { id: "default-value", reason: "디폴트밸류 한남점과 동일 매장(한남동 683-142 = 한남대로27가길 22)" },
  { id: "lowkey", reason: "로우키 성수와 동일 매장(성수동2가 289-5 = 아차산로5길 37)" },
  // 서초구 효령로 304에 디폴트밸류 지점이 있다는 근거를 찾지 못했다. 실제 지점은
  // 연희동(성산로 333)과 한남이고, 문서 ID가 한글 원문이라 파이프라인이 아닌
  // 경로로 들어온 레코드다. 이름도 오타(디폴'드'벨류).
  { id: "디폴드벨류", reason: "실존 확인 불가, 이름 오타, 문서 ID가 한글 원문" },
];

/**
 * 삭제 전에 남길 문서로 옮길 값.
 * 지울 쪽에만 있는 실제 전화번호를 잃지 않기 위해서다(자리표시자 번호는 제외).
 */
const MERGE_BEFORE_DELETE = [
  { from: "default-value", to: "default-value-hannam", fields: ["phone"] },
  { from: "lowkey", to: "로우키 성수", fields: ["phone"] },
];

/** 잘못된 값을 올바른 값으로 덮어쓴다(비우는 게 아니라 교체). */
const FIX_FIELDS = [
  {
    // 주소가 전혀 다른 가게 것이었다. 와우산로29길 47 1-2층은 "라헬의부엌 홍대점"
    // (수플레 브런치)이고, Sanctuary는 월드컵북로 65 2층이다. 이름·설명은
    // 생추어리가 맞는데 주소만 섞여 들어왔다 — 사용자가 엉뚱한 가게로 간다.
    //
    // 좌표도 함께 비운다. Places 약관상 구글 좌표는 30일까지만 캐시할 수 있어
    // 영구 저장이 안 되고, 잘못된 좌표는 근접 검색을 오염시킨다.
    // 없는 것이 틀린 것보다 낫다. 지오코딩은 별도로 붙여야 한다.
    id: "생추어리 (Sanctuary)",
    fields: {
      address: "서울특별시 마포구 월드컵북로 65, 2층",
      lat: null,
      lng: null,
    },
    reason: "주소가 라헬의부엌 홍대점 것이었음 → 실제 Sanctuary 주소로 교체, 잘못된 좌표 제거",
  },
];

const CLEAR_FIELDS = [
  { id: "center-coffee", fields: { phone: "" }, reason: "조작된 전화번호(02-1234-5678) 제거" },
  // anthracite(성수동)와 "앤트러사이트 합정"은 서로 다른 지점인데 place_id 매칭이
  // 겹쳐 둘 다 합정 장소를 가리켰다(저작자가 "앤트러사이트 합정본점"). 성수 쪽
  // place_id를 비워 다시 매칭시키고, 이름의 오타와 조작된 전화번호도 함께 고친다.
  {
    id: "anthracite",
    fields: { googlePlaceId: "", name: "앤트러사이트 성수", phone: "" },
    reason: "합정 place_id 오매칭 해제 + 이름 오타(앤쓰러사이트) + 조작 전화(02-4567-8901)",
  },
];

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  } else {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  return admin.firestore();
}

async function main() {
  const apply = process.argv.includes("--apply");
  const db = initAdmin();

  console.log(apply ? "MODE: APPLY (실제 반영)" : "MODE: DRY-RUN (--apply로 반영)");
  console.log("");

  for (const { from, to, fields } of MERGE_BEFORE_DELETE) {
    const src = await db.collection("cafes").doc(from).get();
    const dst = await db.collection("cafes").doc(to).get();
    if (!src.exists || !dst.exists) {
      console.log(`SKIP merge ${from} → ${to} — 문서 없음`);
      continue;
    }
    const sd = src.data() || {};
    const dd = dst.data() || {};
    const patch = {};
    for (const f of fields) {
      if (sd[f] && !dd[f]) patch[f] = sd[f];
    }
    if (!Object.keys(patch).length) {
      console.log(`SKIP merge ${from} → ${to} — 옮길 값 없음(대상에 이미 있음)`);
      continue;
    }
    console.log(`MERGE  ${from} → ${to}: ${JSON.stringify(patch)}`);
    if (apply) await dst.ref.set(patch, { merge: true });
  }

  for (const { id, reason } of DELETE_DOCS) {
    const ref = db.collection("cafes").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`SKIP delete ${id} — 문서 없음`);
      continue;
    }
    const d = snap.data() || {};
    console.log(`DELETE ${id} (${d.name ?? "?"}) — ${reason}`);
    console.log(`  주소: ${d.address ?? "-"} / 전화: ${d.phone ?? "-"}`);
    if (apply) {
      await ref.delete();
      console.log("  → 삭제됨");
    }
  }

  for (const { id, fields, reason } of FIX_FIELDS) {
    const ref = db.collection("cafes").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`SKIP fix ${id} — 문서 없음`);
      continue;
    }
    const d = snap.data() || {};
    console.log(`FIX    ${id} (${d.name ?? "?"}) — ${reason}`);
    for (const [k, v] of Object.entries(fields)) {
      console.log(`  ${k}: "${d[k] ?? ""}" → ${v === null ? "(삭제)" : `"${v}"`}`);
    }
    if (apply) {
      const patch = {};
      for (const [k, v] of Object.entries(fields)) {
        patch[k] = v === null ? admin.firestore.FieldValue.delete() : v;
      }
      await ref.set(patch, { merge: true });
      console.log("  → 반영됨");
    }
  }

  for (const { id, fields, reason } of CLEAR_FIELDS) {
    const ref = db.collection("cafes").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`SKIP clear ${id} — 문서 없음`);
      continue;
    }
    const d = snap.data() || {};
    const before = Object.keys(fields).map((k) => `${k}="${d[k] ?? ""}"`).join(", ");
    console.log(`CLEAR  ${id} (${d.name ?? "?"}) — ${reason}`);
    console.log(`  이전: ${before}`);
    if (apply) {
      await ref.set(fields, { merge: true });
      console.log("  → 반영됨");
    }
  }

  console.log("");
  console.log("완료.");
}

main().catch((err) => {
  console.error("실패:", err);
  process.exit(1);
});
