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
    "원두 추천", "싱글오리진", "드립백",
  ],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: "원두레이더",
    title: "원두레이더 — 국내 로스터리 원두 신상·재입고 알림",
    description:
      "로스터리 17곳의 원두를 매일 수집합니다. 찜한 원두가 재입고되면 텔레그램으로 알려드립니다.",
  },
  twitter: {
    card: "summary_large_image",
    title: "원두레이더 — 원두 신상·재입고 알림",
    description: "국내 스페셜티 로스터리 17곳의 원두를 매일 수집합니다.",
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
              <h1 className="text-lg font-semibold text-coffee-light font-cafe-heading">Coffee Tracker</h1>
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
