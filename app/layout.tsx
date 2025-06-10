import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { HomeIcon, MagnifyingGlassIcon, BookOpenIcon, ShoppingBagIcon } from "@heroicons/react/24/outline";
import Header from "./components/Header";
import FloatingAction from "./components/FloatingAction";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Coffee Journal",
  description: "당신만의 커피 여정을 기록하세요",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-br from-amber-950 via-orange-900 to-amber-950 min-h-screen`}>
        <Header />
        {children}
        <FloatingAction />
        {/* 하단 네비게이션 - 커피 테마 */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-r from-amber-900/90 via-orange-900/90 to-amber-900/90 backdrop-blur-md flex justify-around items-center h-16 shadow-2xl rounded-t-3xl border-t border-amber-600/50">
          <Link href="/" className="flex flex-col items-center text-xs text-amber-200 hover:text-amber-100 transition-all duration-200 hover:scale-110">
            <HomeIcon className="w-7 h-7 mb-1" />
            홈
          </Link>
          <Link href="/cafes" className="flex flex-col items-center text-xs text-amber-200 hover:text-amber-100 transition-all duration-200 hover:scale-110">
            <MagnifyingGlassIcon className="w-7 h-7 mb-1" />
            카페찾기
          </Link>
          {/* 중앙 파내기 + 플로팅 버튼 부분 */}
          <div className="relative flex flex-col items-center" style={{ width: 64 }}>
            {/* 중앙 파내기 반원 */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-20 h-10 bg-gradient-to-r from-amber-900/90 via-orange-900/90 to-amber-900/90 backdrop-blur-md rounded-b-full z-10 border-t border-amber-600/50"></div>
            {/* 커피 컵 아이콘 */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl text-amber-300">
              ☕
            </div>
          </div>
          <Link href="/beans" className="flex flex-col items-center text-xs text-amber-200 hover:text-amber-100 transition-all duration-200 hover:scale-110">
            <ShoppingBagIcon className="w-7 h-7 mb-1" />
            원두사기
          </Link>
          <Link href="/history" className="flex flex-col items-center text-xs text-amber-200 hover:text-amber-100 transition-all duration-200 hover:scale-110">
            <BookOpenIcon className="w-7 h-7 mb-1" />
            기록목록
          </Link>
        </nav>
      </body>
    </html>
  );
}