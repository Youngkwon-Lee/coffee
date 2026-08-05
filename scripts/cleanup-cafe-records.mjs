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
];

const CLEAR_FIELDS = [
  { id: "center-coffee", fields: { phone: "" }, reason: "조작된 전화번호(02-1234-5678) 제거" },
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
