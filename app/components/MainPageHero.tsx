import Link from "next/link";
import { ArrowUpRight, ArrowRight, Radar, Bean, Heart, Camera, PenLine, BookOpen, MapPin, Bell, ChevronRight } from "lucide-react";

const shortcuts = [
  { href: "/changes", label: "원두레이더", note: "이번 주 달라진 원두", icon: Radar },
  { href: "/beans", label: "원두 탐색", note: "취향에 맞게 비교하기", icon: Bean },
  { href: "/my-beans", label: "나의 보관함", note: "관심 원두 모아두기", icon: Heart },
];
const routines = [
  { href: "/record/photo", title: "사진으로 커피 기록", detail: "커피 정보를 촬영해 남겨요", icon: Camera },
  { href: "/record/manual", title: "오늘의 커피 직접 기록", detail: "맛과 경험을 기록해요", icon: PenLine },
  { href: "/history", title: "내 커피 기록", detail: "지난 취향을 다시 만나요", icon: BookOpen },
  { href: "/cafes", title: "카페 찾기", detail: "다음에 갈 곳을 찾아요", icon: MapPin },
];

// Public discovery must not wait for Firebase authentication or create analytics events on the server.
export default function MainPageHero() {
  return <main className="kc-page kc-home">
    <div className="kc-page-intro"><p className="kc-eyebrow">KINELO COFFEE</p><span className="kc-pill">취향을 발견하는 일상</span></div>
    <section className="kc-hero" aria-labelledby="coffee-home-title">
      <div className="kc-hero-copy">
        <p className="kc-eyebrow">YOUR DAILY COFFEE</p>
        <h1 id="coffee-home-title">오늘의 커피,<br />조금 더 나답게.</h1>
        <p className="kc-hero-description">새로운 원두를 발견하고,<br className="kc-mobile-break" /> 마음에 드는 취향을 모아보세요.</p>
        <div className="kc-actions"><Link href="/beans" className="kc-button kc-button-primary">원두 탐색하기 <ArrowRight size={18} aria-hidden="true" /></Link>
          <Link href="/onboarding" className="kc-text-link">처음 이용하시나요? <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      </div>
      <div className="kc-hero-aside">
        <span className="kc-eyebrow">BEAN RADAR</span>
        <Radar size={38} strokeWidth={1.3} aria-hidden="true" />
        <h2>취향의 변화는<br />작은 발견에서.</h2>
        <p>새로 확인된 상품부터<br />판매 목록의 변화까지.</p>
        <Link href="/changes" className="kc-text-link">이번 주 원두레이더 <ArrowUpRight size={17} aria-hidden="true" /></Link>
      </div>
    </section>
    <nav className="kc-shortcuts" aria-label="원두 서비스 바로가기">
      {shortcuts.map(({href, label, note, icon: Icon}) => <Link href={href} key={href} className="kc-shortcut">
        <span className="kc-icon-tile"><Icon size={22} strokeWidth={1.6} aria-hidden="true" /></span>
        <span><strong>{label}</strong><small>{note}</small></span><ChevronRight className="kc-muted" size={18} aria-hidden="true" />
      </Link>)}
    </nav>
    <div className="kc-home-columns">
      <section aria-labelledby="coffee-routine-title">
        <div className="kc-section-heading"><div><p className="kc-eyebrow">MY COFFEE ROUTINE</p><h2 id="coffee-routine-title">한 잔의 취향을 쌓아가요</h2></div></div>
        <div className="kc-task-list">{routines.map(({href,title,detail,icon:Icon}) => <Link href={href} key={href} className="kc-task-row">
          <span className="kc-icon-tile"><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></span>
          <span><strong>{title}</strong><small>{detail}</small></span><ChevronRight size={18} aria-hidden="true" />
        </Link>)}</div>
      </section>
      <aside className="kc-info-card" aria-labelledby="coffee-alert-title">
        <span className="kc-icon-tile"><Bell size={22} strokeWidth={1.7} aria-hidden="true" /></span>
        <p className="kc-eyebrow">KEEP YOUR FAVORITES</p><h2 id="coffee-alert-title">관심 원두의 소식,<br />놓치지 않도록.</h2>
        <p>원두를 찜하고 알림 서비스의<br />이용 범위를 확인해보세요.</p>
        <Link href="/premium" className="kc-button kc-button-secondary">알림 서비스 안내 <ArrowRight size={17} aria-hidden="true" /></Link>
        <p className="kc-caption">수집된 판매 목록 기준이며,<br />실시간 재고를 보장하지 않습니다.</p>
      </aside>
    </div>
    <footer className="kc-footer"><span>Kinelo Coffee</span><span>원두 탐색 · 원두레이더 · 나의 기록</span><Link href="/onboarding">무료 베타 안내</Link></footer>
  </main>;
}
