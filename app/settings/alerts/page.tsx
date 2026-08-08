"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { db, auth } from "@/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, User } from "firebase/auth";
import { useCustomAlert } from "../../components/CustomAlert";
import { createGoogleSignInProvider, getGoogleSignInErrorMessage } from "@/utils/firebaseAuth";

// 봇 사용자명 (BotFather에서 발급한 이름, @ 없이)
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "wondooradar_bot";

// 연동 코드 문자 집합 (혼동되는 0/O, 1/I 제외)
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const FREE_FAVORITE_LIMIT = 3;

// docs/MONETIZATION.md 기준 가격. 결제는 아직 계좌이체 + 수동 활성화다.
const PREMIUM_PRICE_KRW = 2900;

function generateLinkCode(): string {
  const buffer = new Uint32Array(CODE_LENGTH);

  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(buffer);
  } else {
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      buffer[i] = Math.floor(Math.random() * CODE_ALPHABET.length);
    }
  }

  return Array.from(buffer)
    .map((value) => CODE_ALPHABET[value % CODE_ALPHABET.length])
    .join("");
}

export default function AlertSettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatId, setChatId] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>("free");
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [requested, setRequested] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const { showAlert, AlertComponent } = useCustomAlert();

  const isPremium = plan.toLowerCase() === "premium";
  const isLinked = Boolean(chatId);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const loadProfile = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "users", uid));
      const data = snap.exists() ? snap.data() : {};
      setChatId(data?.telegramChatId ? String(data.telegramChatId) : null);
      setPlan(typeof data?.plan === "string" ? data.plan : "free");

      // 이미 신청했는지. 신청 버튼을 계속 눌러도 문서 하나만 생기지만,
      // 화면에서 "접수됨"을 보여줘야 사용자가 다시 누르지 않는다.
      const reqSnap = await getDoc(doc(db, "premium_requests", uid));
      setRequested(reqSnap.exists());
    } catch (error) {
      console.error("알림 설정 정보를 불러오지 못했습니다:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setChatId(null);
      setPlan("free");
      setLinkCode(null);
      setRequested(false);
      setLoading(false);
      return;
    }
    loadProfile(user.uid);
  }, [user, loadProfile]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, createGoogleSignInProvider());
    } catch (error) {
      console.error("알림 설정 로그인 오류:", error);
      showAlert({
        type: "error",
        title: "로그인 실패",
        message: getGoogleSignInErrorMessage(error),
        confirmText: "확인",
      });
    }
  };

  /**
   * 프리미엄 신청. 결제는 아직 자동화하지 않았다(docs/MONETIZATION.md:
   * 30명까지 계좌이체 + 수동 활성화). 신청만 남기고 안내는 텔레그램으로 한다.
   *
   * 텔레그램 연동을 먼저 요구하는 이유: 연동이 없으면 연락할 방법도,
   * 결제 후 알림을 보낼 방법도 없다.
   */
  const handleRequestPremium = async () => {
    if (!user) return;

    setRequesting(true);
    try {
      await setDoc(
        doc(db, "premium_requests", user.uid),
        {
          uid: user.uid,
          email: user.email ?? null,
          status: "pending",
          requestedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setRequested(true);
      showAlert({
        type: "success",
        title: "신청이 접수되었습니다",
        message: "텔레그램으로 결제 방법을 안내드립니다. 확인까지 하루 정도 걸릴 수 있습니다.",
        confirmText: "확인",
      });
    } catch (error) {
      console.error("프리미엄 신청 실패:", error);
      showAlert({
        type: "error",
        title: "신청하지 못했습니다",
        message: "잠시 후 다시 시도해 주세요.",
        confirmText: "확인",
      });
    } finally {
      setRequesting(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!user) return;

    setGenerating(true);
    try {
      const code = generateLinkCode();
      await setDoc(doc(db, "telegram_link_codes", code), {
        uid: user.uid,
        createdAt: serverTimestamp(),
      });
      setLinkCode(code);
    } catch (error) {
      console.error("연결 코드 생성 실패:", error);
      showAlert({
        type: "error",
        title: "연결 코드 생성 실패",
        message: "잠시 후 다시 시도해 주세요.",
        confirmText: "확인",
      });
    } finally {
      setGenerating(false);
    }
  };

  const deepLink = linkCode ? `https://t.me/${BOT_USERNAME}?start=${linkCode}` : null;

  return (
    <>
      <main className="flex flex-col items-center min-h-screen pt-20 pb-20">
        <h1 className="text-2xl font-bold mb-6 text-espresso">🔔 알림 설정</h1>

        <div className="w-full max-w-md flex flex-col gap-4 px-4">
          {loading ? (
            <div className="text-center py-10 text-mocha">로딩 중...</div>
          ) : !user ? (
            <div className="card-coffee p-6 text-center flex flex-col gap-3">
              <p className="text-mocha font-bold">로그인 후 알림을 설정할 수 있습니다.</p>
              <button
                onClick={handleGoogleLogin}
                className="px-4 py-2 rounded-full bg-blue-500 text-white font-bold hover:bg-blue-700 transition"
              >
                구글 로그인
              </button>
            </div>
          ) : (
            <>
              {/* 플랜 상태 */}
              <section className="card-coffee p-5">
                <h2 className="text-lg font-bold text-espresso mb-2">내 플랜</h2>
                <p className="text-sm text-mocha font-bold mb-1">
                  {isPremium ? "프리미엄" : "무료"}
                </p>
                <p className="text-xs text-brown-700">
                  {isPremium
                    ? "즐겨찾기한 모든 원두의 재입고·가격 변동 알림을 받습니다."
                    : `즐겨찾기 ${FREE_FAVORITE_LIMIT}개까지 알림을 받습니다. 프리미엄은 무제한입니다.`}
                </p>

                {/* 유료 전환 경로. 이게 없으면 게이팅만 있고 결제할 방법이 없다. */}
                {!isPremium && (
                  <div className="mt-4 border-t border-amber-200/60 pt-4 flex flex-col gap-2">
                    <p className="text-sm font-bold text-espresso">
                      프리미엄 <span className="text-mocha">월 {PREMIUM_PRICE_KRW.toLocaleString("ko-KR")}원</span>
                    </p>
                    <p className="text-xs text-brown-700">
                      즐겨찾기 개수 제한 없이 재입고·가격 인하 알림을 받습니다.
                      인기 로스터리 원두는 하루 안에 품절되는 경우가 많습니다.
                    </p>

                    {requested ? (
                      <p className="text-xs font-semibold text-green-700">
                        신청이 접수되었습니다. 텔레그램으로 결제 방법을 안내드립니다.
                      </p>
                    ) : !isLinked ? (
                      // 연동이 없으면 결제 안내를 보낼 방법도, 알림을 줄 방법도 없다.
                      <p className="text-xs text-brown-700">
                        먼저 아래에서 텔레그램을 연결해 주세요. 연결된 계정으로 안내드립니다.
                      </p>
                    ) : (
                      <button
                        onClick={handleRequestPremium}
                        disabled={requesting}
                        className="min-h-11 px-4 rounded-full bg-espresso hover:opacity-90 disabled:opacity-60 text-white font-semibold shadow transition text-sm"
                      >
                        {requesting ? "신청 중..." : "프리미엄 신청"}
                      </button>
                    )}
                  </div>
                )}
              </section>

              {/* 텔레그램 연결 */}
              <section className="card-coffee p-5 flex flex-col gap-3">
                <h2 className="text-lg font-bold text-espresso">텔레그램 연결</h2>

                <p className="text-sm font-bold">
                  연결 상태:{" "}
                  {isLinked ? (
                    <span className="text-green-600">연결됨</span>
                  ) : (
                    <span className="text-red-500">연결 안 됨</span>
                  )}
                </p>

                <p className="text-xs text-brown-700">
                  텔레그램 봇을 연결하면 즐겨찾기한 원두가 재입고되거나 가격이 바뀔 때 DM으로 알려드립니다.
                </p>

                <button
                  onClick={handleGenerateCode}
                  disabled={generating}
                  className="px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-500 disabled:opacity-60 text-white font-semibold shadow transition text-sm"
                >
                  {generating ? "코드 생성 중..." : isLinked ? "다시 연결하기" : "연결 코드 발급"}
                </button>

                {linkCode && (
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 flex flex-col gap-2">
                    <p className="text-xs text-brown-700">연결 코드 (30분간 유효)</p>
                    <p className="text-xl font-bold tracking-widest text-espresso">{linkCode}</p>
                    {deepLink && (
                      <a
                        href={deepLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-full bg-sky-500 hover:bg-sky-600 text-white font-semibold shadow transition text-sm text-center"
                      >
                        텔레그램에서 열기
                      </a>
                    )}
                    <p className="text-[11px] text-brown-700 break-all">{deepLink}</p>
                    <p className="text-[11px] text-brown-700">
                      봇 대화창에서 <span className="font-bold">/start {linkCode}</span> 를 보내도 연결됩니다.
                      연결 후 이 화면을 새로고침하면 상태가 갱신됩니다.
                    </p>
                  </div>
                )}

                <button
                  onClick={() => user && loadProfile(user.uid)}
                  className="text-xs text-mocha underline self-start"
                >
                  연결 상태 새로고침
                </button>
              </section>

              <Link
                href="/my-beans"
                className="text-sm text-mocha underline text-center"
              >
                내 원두 보관함으로 돌아가기
              </Link>
            </>
          )}
        </div>
      </main>
      <AlertComponent />
    </>
  );
}
