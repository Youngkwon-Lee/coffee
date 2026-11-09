"use client";

import Link from "next/link";
import { Camera, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import UserButton from "./UserButton";

const sections = [
  { href: "/", text: "홈" },
  { href: "/changes", text: "원두레이더" },
  { href: "/beans", text: "원두 찾기" },
  { href: "/my-beans", text: "찜한 원두" },
  { href: "/settings/alerts", text: "알림 설정" },
  { href: "/cafes", text: "카페 찾기" },
  { href: "/record/photo", text: "사진으로 커피 기록" },
  { href: "/record/manual", text: "직접 기록" },
  { href: "/history", text: "내 기록" },
  { href: "/login", text: "로그인 · 계정" },
  { href: "/onboarding", text: "무료 베타 안내" },
];

export default function CoffeeHeaderActions() {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (menuRef.current) menuRef.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
        menuRef.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <div className="kc-header-actions">
      <Link href="/record/photo" className="kc-header-action" aria-label="사진으로 커피 기록">
        <Camera size={25} strokeWidth={1.9} aria-hidden="true" />
      </Link>
      <details className="kc-header-menu" ref={menuRef}>
        <summary className="kc-header-action" aria-label="전체 메뉴">
          <Menu size={29} strokeWidth={1.8} aria-hidden="true" />
        </summary>
        <nav aria-label="전체 메뉴" className="kc-menu-panel">
          <p className="kc-menu-heading">KINELO COFFEE</p>
          {sections.map(({ href, text }) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
              {text}
            </Link>
          ))}
          <div className="kc-menu-account">
            <UserButton />
          </div>
        </nav>
      </details>
    </div>
  );
}
