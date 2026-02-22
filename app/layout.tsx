import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import BottomNavigation from "./components/BottomNavigation";
import UserButton from "./components/UserButton";
import { Coffee } from "lucide-react";

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
      <head>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-coffee-dark text-coffee-light min-h-screen`} suppressHydrationWarning>
        {/* Mobile Container */}
        <div className="mobile-container">
          {/* Header */}
          <header className="header-coffee">
            <div className="flex items-center space-x-3" suppressHydrationWarning>
              <div className="header-logo">
                <Coffee className="w-5 h-5 text-coffee-dark" strokeWidth={2.5} />
              </div>
              <h1 className="text-lg font-semibold text-coffee-light">Coffee Tracker</h1>
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