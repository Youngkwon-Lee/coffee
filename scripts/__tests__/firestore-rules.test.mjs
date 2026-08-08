/**
 * Firestore 보안 규칙 테스트 — 과금 필드가 클라이언트로부터 잠겨 있는지.
 *
 * 이 테스트가 있는 이유: `users/{uid}`가 `allow read, write: if isOwner(userId)`
 * 였다. 본인 문서라 브라우저 콘솔 한 줄로 프리미엄이 됐다.
 *   setDoc(doc(db,'users',myUid), {plan:'premium'}, {merge:true})
 * 유료화 게이팅이 아무리 정확해도 이 한 줄이면 무의미하다.
 *
 * 규칙 파일만 고쳐두면 배포 전까지 프로덕션은 그대로다. 그래서 최소한
 * "고친 규칙이 실제로 막는다"는 것만이라도 에뮬레이터로 증명해둔다.
 *
 * 실행: npm run test:rules
 */

import fs from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const ME = "user-me";
const OTHER = "user-other";

let failures = 0;
let passed = 0;

async function check(label, promise) {
  try {
    await promise;
    passed += 1;
    console.log(`  OK    ${label}`);
  } catch (e) {
    failures += 1;
    console.log(`  FAIL  ${label}`);
    console.log(`        ${String(e).split("\n")[0]}`);
  }
}

const testEnv = await initializeTestEnvironment({
  projectId: "demo-coffee-rules",
  firestore: {
    rules: fs.readFileSync("firestore.rules", "utf8"),
    host: "127.0.0.1",
    port: 8080,
  },
});

// 기존 사용자 문서를 규칙 무시하고 심어둔다(운영자가 부여한 상태를 흉내).
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "users", ME), { nickname: "나", plan: "free" });
  await setDoc(doc(db, "users", OTHER), { nickname: "남", plan: "premium" });
});

const me = testEnv.authenticatedContext(ME).firestore();
const stranger = testEnv.authenticatedContext(OTHER).firestore();
const anon = testEnv.unauthenticatedContext().firestore();

console.log("\n[과금 필드] 클라이언트가 스스로 프리미엄이 될 수 없어야 한다");
await check(
  "본인 문서에 plan='premium' 쓰기 → 거부",
  assertFails(setDoc(doc(me, "users", ME), { plan: "premium" }, { merge: true }))
);
await check(
  "본인 문서에 premium_until 쓰기 → 거부",
  assertFails(
    setDoc(doc(me, "users", ME), { premium_until: "2099-01-01T00:00:00Z" }, { merge: true })
  )
);
await check(
  "camelCase premiumUntil 쓰기 → 거부",
  assertFails(setDoc(doc(me, "users", ME), { premiumUntil: "2099-01-01T00:00:00Z" }, { merge: true }))
);
await check(
  "plan='free'로 낮추는 것도 거부(과금 필드는 서버 전용)",
  assertFails(setDoc(doc(me, "users", ME), { plan: "free" }, { merge: true }))
);

console.log("\n[일반 프로필] 과금과 무관한 수정은 계속 돼야 한다");
await check(
  "닉네임 수정 → 허용",
  assertSucceeds(setDoc(doc(me, "users", ME), { nickname: "바뀐이름" }, { merge: true }))
);
await check(
  "본인 문서 읽기 → 허용",
  assertSucceeds(getDoc(doc(me, "users", ME)))
);

console.log("\n[남의 문서] 손댈 수 없어야 한다");
await check(
  "남의 문서 읽기 → 거부",
  assertFails(getDoc(doc(stranger, "users", ME)))
);
await check(
  "남의 문서에 plan 쓰기 → 거부",
  assertFails(setDoc(doc(stranger, "users", ME), { plan: "premium" }, { merge: true }))
);
await check(
  "비로그인 읽기 → 거부",
  assertFails(getDoc(doc(anon, "users", ME)))
);

console.log("\n[프리미엄 신청] 본인 것만, pending으로만");
await check(
  "본인 신청 생성 → 허용",
  assertSucceeds(
    setDoc(doc(me, "premium_requests", ME), { uid: ME, status: "pending" })
  )
);
await check(
  "본인 재신청(pending 유지) → 허용",
  assertSucceeds(
    setDoc(doc(me, "premium_requests", ME), { uid: ME, status: "pending" }, { merge: true })
  )
);
await check(
  "스스로 approved로 바꾸기 → 거부",
  assertFails(
    setDoc(doc(me, "premium_requests", ME), { uid: ME, status: "approved" }, { merge: true })
  )
);
await check(
  "남의 uid로 신청 → 거부",
  assertFails(
    setDoc(doc(me, "premium_requests", OTHER), { uid: OTHER, status: "pending" })
  )
);

await testEnv.cleanup();

console.log(`\n검사 ${passed + failures}건 / 실패 ${failures}건`);
process.exit(failures ? 1 : 0);
