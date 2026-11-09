"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Radar, Bean, Heart, BookOpen, MapPin } from "lucide-react";

const mobileItems = [
  { href: "/", label: "홈", icon: Home },
  { href: "/changes", label: "원두레이더", icon: Radar },
  { href: "/beans", label: "원두 탐색", icon: Bean },
  { href: "/my-beans", label: "보관함", icon: Heart },
  { href: "/history", label: "내 기록", icon: BookOpen },
];
const desktopItems = [...mobileItems.slice(1, 3), { href: "/cafes", label: "카페 찾기", icon: MapPin }, ...mobileItems.slice(3)];
function selected(path: string | null, href: string) {
  return href === "/" ? path === "/" : path === href || Boolean(path?.startsWith(href + "/"));
}
export function DesktopCoffeeNavigation() {
  const pathname = usePathname();
  return <nav className="kc-desktop-nav" aria-label="주 메뉴">
    {desktopItems.map(({ href, label }) => <Link key={href} href={href}
      aria-current={selected(pathname, href) ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
export default function BottomNavigation() {
  const pathname = usePathname();
  return <nav className="kc-mobile-nav" aria-label="모바일 주 메뉴">
    {mobileItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href}
      aria-current={selected(pathname, href) ? "page" : undefined}>
      <Icon size={21} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span>
    </Link>)}
  </nav>;
}
