#!/usr/bin/env node
/**
 * 찜 → 재입고 알림 E2E 검증.
 *
 * 유료 전환의 근거가 이 경로다. 그런데 2026-08-05까지 찜 자체가 깨져 있었어서
 * (컬렉션명 불일치 + 스프레드 순서) 찜한 원두가 DB에 없었고, 알림이 실제로
 * 발송되는 것을 본 적이 없다. 코드만 도는 상태였다.
 *
 * 이 스크립트는 테스트용 찜과 재입고 이벤트를 만들고, 알림 발송 스크립트가
 * 그것을 집어내는지까지 확인한 뒤 **반드시 정리한다**. 실제 사용자 데이터는
 * 건드리지 않는다(대상 uid를 인자로 받는다).
 *
 * 사용:
 *   node scripts/test-favorite-alert-e2e.mjs --uid <uid> --setup
 *   python scripts/send_favorite_alerts.py --since-hours 1
 *   node scripts/test-favorite-alert-e2e.mjs --uid <uid> --cleanup
 */

import admin from "firebase-admin";

// Firestore는 밑줄 두 개로 시작·끝나는 문서 ID를 예약어로 금지한다
// ("Resource id ... is invalid because it is reserved").
const TEST_EVENT_ID = "e2e-test-restock";

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  } else {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  return admin.firestore();
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
}

async function main() {
  const uid = arg("uid");
  const setup = process.argv.includes("--setup");
  const cleanup = process.argv.includes("--cleanup");
  if (!uid || (!setup && !cleanup)) {
    console.error("사용: --uid <uid> --setup | --cleanup");
    process.exit(1);
  }
  const db = initAdmin();

  // 실제 원두 하나를 고른다. 존재하지 않는 원두로는 알림 본문을 만들 수 없다.
  const beansSnap = await db.collection("beans").limit(1).get();
  if (beansSnap.empty) {
    console.error("beans 컬렉션이 비었다.");
    process.exit(1);
  }
  const beanDoc = beansSnap.docs[0];
  const bean = beanDoc.data() || {};
  const beanId = beanDoc.id;

  const favRef = db.collection("users").doc(uid).collection("favorites_beans").doc(beanId);
  const evRef = db.collection("bean_events").doc(TEST_EVENT_ID);

  if (cleanup) {
    const [f, e] = await Promise.all([favRef.get(), evRef.get()]);
    console.log(`정리: 찜 ${f.exists ? "삭제" : "없음"} / 이벤트 ${e.exists ? "삭제" : "없음"}`);
    await Promise.all([
      f.exists ? favRef.delete() : Promise.resolve(),
      e.exists ? evRef.delete() : Promise.resolve(),
    ]);
    console.log("완료.");
    return;
  }

  console.log(`대상 원두: ${bean.name ?? "?"} (${beanId})`);
  console.log(`대상 사용자: ${uid}`);

  await favRef.set({ addedAt: new Date() }, { merge: true });
  console.log("· 찜 생성");

  // 크롤러가 만드는 것과 같은 형태의 재입고 이벤트.
  await evRef.set({
    bean_id: beanId,
    type: "restored",
    brand: bean.brand ?? "테스트",
    name: bean.name ?? "테스트 원두",
    new_price_krw: bean.price ?? 0,
    detected_at: new Date(),
    is_e2e_test: true,
  });
  console.log("· 재입고 이벤트 생성 (type=restored)");
  console.log("");
  console.log("다음: python scripts/send_favorite_alerts.py --since-hours 1");
}

main().catch((e) => {
  console.error("실패:", e);
  process.exit(1);
});
