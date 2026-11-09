import Link from "next/link";
import { ArrowUpRight, ArrowRight, Radar, Coffee, Heart, Camera, PenLine, BookOpen, MapPin, Bell, Sparkles } from "lucide-react";

export type FeaturedBean = {
  id: string;
  name: string;
  brand: string;
  image: string;
  price: string;
};

const secondary = [
  { href: "/changes", label: "이번 주 원두레이더", caption: "최근 7일 동안 확인된 변화", icon: Radar },
  { href: "/beans", label: "모든 원두 찾아보기", caption: "향미와 브랜드로 비교", icon: Coffee },
  { href: "/my-beans", label: "나의 보관함", caption: "관심 원두를 한곳에", icon: Heart },
];

const more = [
  { href: "/record/photo", label: "사진으로 기록", icon: Camera },
  { href: "/record/manual", label: "직접 기록", icon: PenLine },
  { href: "/history", label: "내 커피 기록", icon: BookOpen },
  { href: "/cafes", label: "카페 찾기", icon: MapPin },
];

export default function MainPageHero({ featuredBeans = [] }: { featuredBeans?: FeaturedBean[] }) {
  return (
    <main className="kc-page kc-dark-home">
      <div className="kc-dark-intro">
        <p className="kc-eyebrow">BEANS, STORIES & DISCOVERY</p>
        <h1>커피를 고르는<br />나만의 방식.</h1>
        <p>여러 로스터리에서 확인된 원두를 살펴보고, 마음에 드는 취향을 발견해보세요.</p>
      </div>

      <section className="kc-photo-feed" aria-label="최근 확인된 원두">
        {featuredBeans.length > 0 ? featuredBeans.map((bean, index) => (
          <Link className="kc-photo-card" href={`/beans/${encodeURIComponent(bean.id)}`} key={bean.id}>
            <img src={bean.image} alt={bean.name} className="kc-photo-image" loading={index === 0 ? "eager" : "lazy"} />
            <div className="kc-photo-shade" aria-hidden="true" />
            <div className="kc-photo-content">
              <div className="kc-photo-tag"><span className="kc-status-dot" /> 실제 수집 원두 <span className="kc-photo-caption">{bean.brand}</span></div>
              <div className="kc-photo-title-row">
                <div><h2>{bean.name}</h2><p>{bean.brand} · 원두 상세 보기</p></div>
                <span className="kc-photo-price">{bean.price || "가격 문의"}</span>
              </div>
            </div>
            <span className="kc-photo-arrow" aria-hidden="true"><ArrowUpRight size={22} /></span>
          </Link>
        )) : (
          <Link href="/beans" className="kc-photo-card kc-photo-fallback">
            <div className="kc-photo-shade" aria-hidden="true" />
            <div className="kc-photo-content">
              <span className="kc-photo-tag"><Coffee size={15} aria-hidden="true" /> KINELO COFFEE</span>
              <div className="kc-photo-title-row">
                <div><h2>나에게 맞는 원두 찾기</h2><p>로스터리 원두를 한곳에서 비교해보세요</p></div>
                <ArrowUpRight size={24} aria-hidden="true" />
              </div>
            </div>
          </Link>
        )}
      </section>

      <section className="kc-dark-feature" aria-labelledby="kc-dark-feature-title">
        <div><p className="kc-eyebrow">BEAN RADAR</p><h2 id="kc-dark-feature-title">이번 주, 어떤 원두가 달라졌을까요?</h2>
          <p>새로 확인된 상품과 판매 목록의 변화를 확인하세요. 재고·가격은 판매처 기준입니다.</p></div>
        <Link href="/changes" className="kc-button kc-button-primary">원두레이더 보기 <ArrowRight size={18} aria-hidden="true" /></Link>
      </section>

      <section className="kc-dark-browse" aria-labelledby="kc-dark-browse-title">
        <div className="kc-section-heading"><div><p className="kc-eyebrow">EXPLORE MORE</p><h2 id="kc-dark-browse-title">더 둘러보기</h2></div></div>
        <div className="kc-dark-shortcuts">
          {secondary.map(({ href, label, caption, icon: Icon }) => (
            <Link href={href} className="kc-dark-shortcut" key={href}>
              <span className="kc-icon-tile"><Icon size={22} strokeWidth={1.6} aria-hidden="true" /></span>
              <span><strong>{label}</strong><small>{caption}</small></span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section className="kc-dark-more" aria-label="커피 기록과 카페 메뉴">
        <p className="kc-eyebrow">MY COFFEE ROUTINE</p>
        <div>{more.map(({ href, label, icon: Icon }) =>
          <Link href={href} key={href}><Icon size={18} aria-hidden="true" />{label}</Link>)}</div>
      </section>
      <aside className="kc-dark-notice">
        <Bell size={18} aria-hidden="true" />
        <span>관심 원두 알림이 필요하다면 <Link href="/premium">서비스 안내</Link>를 확인하세요.</span>
        <Sparkles size={15} aria-hidden="true" />
      </aside>
      <footer className="kc-footer"><span>Kinelo Coffee</span><Link href="/onboarding">무료 베타 안내</Link><span>사진과 가격·판매 가능 여부는 판매처 기준입니다.</span></footer>
    </main>
  );
}
