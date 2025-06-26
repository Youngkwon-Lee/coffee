import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { HomeIcon, MagnifyingGlassIcon, BookOpenIcon, ShoppingBagIcon } from "@heroicons/react/24/outline";
import Header from "./components/Header";
import BottomNavigation from "./components/BottomNavigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Coffee Tracker",
  description: "당신만의 커피 여정을 기록하세요",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' }
    ],
    apple: [
      { url: '/favicon.svg', sizes: '180x180', type: 'image/svg+xml' }
    ]
  },
  manifest: '/manifest.json'
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
                <span className="text-coffee-dark text-sm">☕</span>
              </div>
              <h1 className="text-lg font-semibold text-coffee-light">Coffee Tracker</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button className="text-coffee-light opacity-70 hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </button>
              <button className="text-coffee-light opacity-70 hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
              </button>
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