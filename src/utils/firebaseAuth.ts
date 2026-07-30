"use client";

import { GoogleAuthProvider } from "firebase/auth";

type FirebaseAuthErrorLike = {
  code?: string;
};

const FALLBACK_AUTH_DOMAIN = "coffee-omega-lovat.vercel.app";

export function createGoogleSignInProvider() {
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  return provider;
}

export function getCurrentAuthDomain() {
  if (typeof window === "undefined") {
    return FALLBACK_AUTH_DOMAIN;
  }

  return window.location.hostname || FALLBACK_AUTH_DOMAIN;
}

export function getGoogleSignInErrorMessage(
  error: unknown,
  domain = getCurrentAuthDomain()
) {
  const code = typeof error === "object" && error !== null ? (error as FirebaseAuthErrorLike).code : undefined;

  switch (code) {
    case "auth/popup-closed-by-user":
      return "로그인이 취소되었습니다.";
    case "auth/popup-blocked":
      return "팝업이 차단되었습니다. 브라우저 설정에서 팝업 차단을 해제하고 다시 시도해주세요.";
    case "auth/unauthorized-domain":
      return `승인되지 않은 도메인입니다.\n\nFirebase 콘솔 > Authentication > Settings > Authorized domains에서 현재 도메인(${domain})을 추가한 뒤 다시 시도해주세요.`;
    default:
      return "로그인 중 오류가 발생했습니다.";
  }
}
