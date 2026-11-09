"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Coffee, Heart, Radar, MapPin, BookOpen } from "lucide-react";

const mobileItems = [
  { href: "/", label: "홈", icon: House },
  { href: "/beans", label: "원두 찾기", icon: Coffee },
  { href: "/my-beans", label: "찜 · 알림", icon: Heart },
];
const desktopItems = [
  { href: "/changes", label: "원두레이더", icon: Radar },
  { href: "/beans", label: "원두 찾기", icon: Coffee },
  { href: "/cafes", label: "카페 찾기", icon: MapPin },
  { href: "/my-beans", label: "보관함", icon: Heart },
  { href: "/history", label: "내 기록", icon: BookOpen },
];

function selected(path: string | null, href: string): boolean {
  if (href === "/") return path === "/";
  if (href === "/my-beans" && path === "/settings/alerts") return true;
  return path === href || Boolean(path?.startsWith(href + "/"));
}

export function DesktopCoffeeNavigation() {
  const pathname = usePathname();
  return (
    <nav className="kc-desktop-nav" aria-label="데스크톱 주 메뉴">
      {desktopItems.map(({ href, label }) => (
        <Link href={href} key={href} aria-current={selected(pathname, href) ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}

export default function BottomNavigation() {
  const pathname = usePathname();
  return (
    <nav className="kc-mobile-nav" aria-label="모바일 주 메뉴">
      {mobileItems.map(({ href, label, icon: Icon }) => (
        <Link href={href} key={href} aria-current={selected(pathname, href) ? "page" : undefined}>
          <Icon size={25} strokeWidth={1.9} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
