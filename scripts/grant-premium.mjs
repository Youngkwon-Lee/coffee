#!/usr/bin/env node
/**
 * 프리미엄 플랜 부여/해지 (Admin SDK).
 *
 * firestore.rules에서 plan/premium_until은 클라이언트가 못 쓰게 막았다.
 * (본인 문서라고 다 열어두면 브라우저 콘솔 한 줄로 프리미엄이 된다.)
 * 그래서 부여 수단이 서버 경로 하나뿐이고, 그게 이 스크립트다.
 *
 * 결제는 아직 계좌이체 + 수동 활성화다(docs/MONETIZATION.md: 30명까지 수동).
 * 자동 해지가 없으므로 만료일을 반드시 넣는다 — 넣지 않으면 영구 프리미엄이다.
 *
 * 사용:
 *   node scripts/grant-premium.mjs --uid <UID> --months 1          # dry-run
 *   node scripts/grant-premium.mjs --uid <UID> --months 1 --apply
 *   node scripts/grant-premium.mjs --uid <UID> --revoke --apply
 *   node scripts/grant-premium.mjs --list                          # 현재 프리미엄 목록
 *
 * 연장은 남은 기간에 이어 붙인다. 만료 전에 재결제한 사람의 잔여일을
 * 깎으면 안 된다.
 */

import admin from "firebase-admin";

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
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function has(name) {
  return process.argv.includes(`--${name}`);
}

function fmt(d) {
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

async function listPremium(db) {
  const snap = await db.collection("users").where("plan", "==", "premium").get();
  if (snap.empty) {
    console.log("프리미엄 사용자 없음");
    return;
  }
  const now = new Date();
  console.log(`프리미엄 ${snap.size}명:\n`);
  for (const doc of snap.docs) {
    const d = doc.data();
    const until = d.premium_until?.toDate?.() ?? null;
    const state = !until
      ? "만료 없음 (수동 부여)"
      : until <= now
        ? `만료됨 (${fmt(until)})`
        : `~${fmt(until)}`;
    const linked = d.telegramChatId ? "텔레그램 연동됨" : "텔레그램 미연동 — 알림 못 받음";
    console.log(`  ${doc.id}  ${state}  |  ${linked}`);
  }
}

/** 대기 중인 신청. 이걸 봐야 누구에게 결제 안내를 보낼지 안다. */
async function listRequests(db) {
  const snap = await db
    .collection("premium_requests")
    .where("status", "==", "pending")
    .get();
  if (snap.empty) {
    console.log("대기 중인 프리미엄 신청 없음");
    return;
  }
  console.log(`대기 중인 신청 ${snap.size}건:\n`);
  for (const doc of snap.docs) {
    const d = doc.data();
    const at = d.requestedAt?.toDate?.();
    const user = (await db.collection("users").doc(doc.id).get()).data() ?? {};
    const linked = user.telegramChatId ? `chat_id=${user.telegramChatId}` : "텔레그램 미연동";
    console.log(`  ${doc.id}`);
    console.log(`    신청: ${at ? fmt(at) : "(시각 없음)"}  |  ${d.email ?? "이메일 없음"}  |  ${linked}`);
  }
  console.log("\n부여: node scripts/grant-premium.mjs --uid <UID> --months 1 --apply");
}

async function main() {
  const db = initAdmin();

  if (has("list")) {
    await listPremium(db);
    return;
  }

  if (has("requests")) {
    await listRequests(db);
    return;
  }

  const uid = arg("uid");
  const revoke = has("revoke");
  const months = Number(arg("months") ?? 1);
  const apply = has("apply");

  if (!uid) {
    console.error("--uid 가 필요하다. (--list 로 현재 목록 확인)");
    process.exit(1);
  }
  if (!revoke && (!Number.isFinite(months) || months <= 0 || months > 24)) {
    console.error(`--months 값이 이상하다: ${arg("months")} (1~24)`);
    process.exit(1);
  }

  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    // 오타 하나로 엉뚱한 문서를 만들면 알림이 영영 안 간다.
    console.error(`users/${uid} 문서가 없다. UID를 확인할 것.`);
    process.exit(1);
  }

  const cur = snap.data() ?? {};
  const curUntil = cur.premium_until?.toDate?.() ?? null;
  console.log(`대상: users/${uid}`);
  console.log(`  현재 plan: ${cur.plan ?? "(없음)"}`);
  console.log(`  현재 만료: ${curUntil ? fmt(curUntil) : "(없음)"}`);
  console.log(`  텔레그램: ${cur.telegramChatId ? "연동됨" : "미연동 — 부여해도 알림이 안 간다"}`);

  let update;
  if (revoke) {
    update = {
      plan: "free",
      premium_until: admin.firestore.FieldValue.delete(),
      premium_updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    console.log("\n동작: 해지 → plan=free, 만료일 삭제");
  } else {
    // 아직 유효하면 남은 기간에 이어 붙인다.
    const base = curUntil && curUntil > new Date() ? curUntil : new Date();
    const until = new Date(base);
    until.setMonth(until.getMonth() + months);
    update = {
      plan: "premium",
      premium_until: admin.firestore.Timestamp.fromDate(until),
      premium_updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    console.log(`\n동작: ${months}개월 부여 → 만료 ${fmt(until)}`);
    if (curUntil && curUntil > new Date()) {
      console.log(`  (기존 만료 ${fmt(curUntil)}에 이어 붙임)`);
    }
  }

  if (!apply) {
    console.log("\nMODE: DRY-RUN — 반영하려면 --apply");
    return;
  }

  await ref.set(update, { merge: true });

  // 쓰기 후 실제 값을 다시 읽어 확인한다. 쓴 줄 알고 넘어가는 실패를 막는다.
  const after = (await ref.get()).data() ?? {};
  const afterUntil = after.premium_until?.toDate?.() ?? null;
  console.log("\nAPPLIED. 읽기 확인:");
  console.log(`  plan=${after.plan}  만료=${afterUntil ? fmt(afterUntil) : "(없음)"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
