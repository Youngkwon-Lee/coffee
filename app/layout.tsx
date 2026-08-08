import type { Metadata } from "next";
import { Noto_Sans_KR, Playfair_Display } from "next/font/google";
import "./globals.css";
import BottomNavigation from "./components/BottomNavigation";
import UserButton from "./components/UserButton";
import { Coffee } from "lucide-react";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const SITE_URL = "https://coffee-omega-lovat.vercel.app";

/**
 * 검색엔진 소유확인. 네이버·구글에서 받은 content 값을 환경변수로 넣는다.
 * 값이 없으면 태그를 아예 내보내지 않는다 — 빈 content 태그는 확인에 실패한다.
 *
 * 네이버를 같이 넣는 이유: 국내 검색 점유율은 네이버가 구글보다 크고,
 * 원두·카페 같은 상품·지역 질의에서 특히 그렇다. 구글만 붙이면 절반을 버린다.
 */
const GOOGLE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
const NAVER_VERIFICATION = process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION;

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
    default: "원두레이더 — 국내 로스터리 원두 신상·재입고 알림",
    template: "%s | 원두레이더",
  },
  description:
    "프릳츠·앤트러사이트·테라로사 등 국내 스페셜티 로스터리 17곳의 원두를 매일 수집합니다. 찜한 원두가 재입고되거나 가격이 바뀌면 텔레그램으로 알려드립니다.",
  keywords: [
    "원두", "스페셜티 커피", "원두 재입고", "원두 신상", "로스터리",
    "프릳츠", "앤트러사이트", "테라로사", "커피리브레", "모모스커피",
    // "드립백"은 넣지 않는다. 드립백은 원두가 아니라 필터에서 제외하므로,
    // 그 검색어로 들어온 사람에게 보여줄 상품이 없다.
    "원두 추천", "싱글오리진",
  ],
  verification,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: "원두레이더",
    title: "원두레이더 — 국내 로스터리 원두 신상·재입고 알림",
    description:
      "로스터리 17곳의 원두를 매일 수집합니다. 찜한 원두가 재입고되면 텔레그램으로 알려드립니다.",
    // 미리보기 이미지가 없으면 텔레그램·카톡에서 링크가 맨 텍스트로 보인다.
    // 지금 유입 경로가 텔레그램 채널이라 체감이 크다.
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "원두레이더 — 국내 로스터리 원두 신상·재입고 알림",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "원두레이더 — 원두 신상·재입고 알림",
    description: "국내 스페셜티 로스터리 17곳의 원두를 매일 수집합니다.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: '/favicon.ico',
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
      <head />
      <body className={`${notoSansKr.variable} ${playfair.variable} antialiased bg-coffee-dark text-coffee-light min-h-screen`} suppressHydrationWarning>
        {/* Mobile Container */}
        <div className="mobile-container">
          {/* Header */}
          <header className="header-coffee">
            <div className="flex items-center space-x-3" suppressHydrationWarning>
              <div className="header-logo">
                <Coffee className="w-5 h-5 text-[#120f0d]" strokeWidth={1.8} />
              </div>
              {/* 모든 페이지의 h1이다. 브랜드명(원두레이더)과 달라선 안 된다 —
                  제목·OG·텔레그램 채널은 원두레이더인데 화면만 Coffee Tracker였다. */}
              <h1 className="text-lg font-semibold text-coffee-light font-cafe-heading">원두레이더</h1>
            </div>
            <div className="flex items-center space-x-3">
              <UserButton />
            </div>
          </header>

          {/* Main Content */}
          <main className="main-content">
            {children}
          </main>

          {/* Bottom Navigation with Integrated FAB */}
          <BottomNavigation />
        </div>
      </body>
    </html>
  );
}
