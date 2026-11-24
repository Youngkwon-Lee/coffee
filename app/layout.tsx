import type { Metadata } from "next";
import "./globals.css";
import "@/styles/kinelo-coffee.css";
import "@/styles/kinelo-coffee-dark.css";
import BottomNavigation, { DesktopCoffeeNavigation } from "./components/BottomNavigation";
import CoffeeWebAnalytics from "@/components/CoffeeWebAnalytics";
import CoffeeHeaderActions from "./components/CoffeeHeaderActions";
import KineloCoffeeBrand from "@/components/KineloCoffeeBrand";

const SITE_URL = "https://coffee-omega-lovat.vercel.app";

/**
 * 검색엔진 소유확인. 네이버·구글에서 받은 content 값을 환경변수로 넣는다.
 * 값이 없으면 태그를 아예 내보내지 않는다 — 빈 content 태그는 확인에 실패한다.
 *
 * 네이버를 같이 넣는 이유: 국내 검색 점유율은 네이버가 구글보다 크고,
 * 원두·카페 같은 상품·지역 질의에서 특히 그렇다. 구글만 붙이면 절반을 버린다.
 */
// 값 자체는 HTML로 누구에게나 공개되는 소유확인 토큰이라 비밀이 아니다.
// (다른 사이트에 같은 값을 붙여도 이 도메인 소유권과는 무관하다.)
// 환경변수 누락으로 태그가 조용히 사라지는 편이 더 위험해서 기본값을 코드에 둔다.
const GOOGLE_VERIFICATION =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
  "BfYTHvX8gNLl08V9r2_TGaV1q5duLmhgOUiGvdMyf6U";
const NAVER_VERIFICATION =
  process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION ||
  "abb659ee06f7ae988532cfc5db0bbef06e579dca";

/**
 * Google AdSense 게시자 ID. 사이트 소유확인용 meta 태그와 Auto Ads 스크립트가
 * 같은 값을 쓴다. 값 자체는 HTML에 그대로 노출되는 공개 식별자라 비밀이 아니다.
 *
 * 배포 환경에서 env로 덮어쓸 수 있게 둔다. 다만 env 누락으로 태그가 조용히
 * 사라지면 애드센스가 사이트를 확인하지 못하므로 기본값을 코드에 둔다.
 */
const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT || "ca-pub-8246399190278584";

const verification: Metadata["verification"] = {
  ...(GOOGLE_VERIFICATION ? { google: GOOGLE_VERIFICATION } : {}),
  ...(NAVER_VERIFICATION
    ? { other: { "naver-site-verification": NAVER_VERIFICATION } }
    : {}),
};

// 검색으로 유입되려면 사람들이 실제로 치는 말이 들어가야 한다.
// "Coffee Journal / 당신만의 커피 여정"으로는 '프릳츠 원두 재입고'를 검색한
// 사람에게 닿지 않는다.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Kinelo Coffee | 원두레이더 · 원두 탐색",
    template: "%s | Kinelo Coffee",
  },
  description:
    "Kinelo Coffee에서 국내 로스터리 원두를 비교하고 취향을 모아보세요. 원두레이더로 새로 확인된 상품과 판매 목록 변동을 살펴볼 수 있습니다.",
  keywords: [
    "원두", "스페셜티 커피", "원두 재입고", "원두 신상", "로스터리",
    "프릳츠", "앤트러사이트", "테라로사", "커피리브레", "모모스커피",
    // "드립백"은 넣지 않는다. 드립백은 원두가 아니라 필터에서 제외하므로,
    // 그 검색어로 들어온 사람에게 보여줄 상품이 없다.
    "원두 추천", "싱글오리진",
  ],
  verification,
  // AdSense 사이트 소유확인. 값이 없으면 태그를 내보내지 않는다.
  ...(ADSENSE_CLIENT
    ? { other: { "google-adsense-account": ADSENSE_CLIENT } }
    : {}),
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: "Kinelo Coffee",
    title: "Kinelo Coffee — 취향을 발견하는 커피 생활",
    description:
      "원두 탐색, 원두레이더, 나의 커피 기록. 여러 로스터리의 원두를 한곳에서 비교하세요.",
    // 미리보기 이미지가 없으면 텔레그램·카톡에서 링크가 맨 텍스트로 보인다.
    // 지금 유입 경로가 텔레그램 채널이라 체감이 크다.
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kinelo Coffee — 원두레이더와 원두 탐색",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kinelo Coffee · 원두레이더",
    description: "국내 로스터리 원두를 비교하고 취향을 모아보세요.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/kinelo-coffee-symbol.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "32x32" }],
    apple: '/icon-192.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/*
          AdSense Auto Ads. 실제 광고 노출 위치는 애드센스 관리 화면에서 정한다.
          스크립트만으로는 광고가 나오지 않는다 — 사이트 검토·승인 뒤에 켜진다.
          next/script 대신 head의 일반 script 태그를 쓰는 이유: afterInteractive는
          브라우저에서만 주입돼 서버 HTML에는 남지 않는다. 애드센스 사이트 확인과
          광고 크롤러가 서버 응답만 보는 경우에도 스크립트가 보이도록 둔다.
        */}
        {ADSENSE_CLIENT ? (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      <body className="kinelo-coffee antialiased" suppressHydrationWarning>
        <a href="#coffee-content" className="kc-skip-link">본문으로 바로가기</a>
        <div className="mobile-container">
          <header className="kc-header">
            <KineloCoffeeBrand />
            <div className="kc-header-middle"><DesktopCoffeeNavigation /></div>
            <CoffeeHeaderActions />
          </header>
          <div id="coffee-content" className="main-content" tabIndex={-1}>{children}</div>
          <BottomNavigation />
          <CoffeeWebAnalytics />
        </div>
      </body>
    </html>
  );
}
