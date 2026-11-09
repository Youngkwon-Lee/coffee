import type { Metadata } from "next";
import Link from "next/link";
import { Coffee, Heart, Search, ChevronRight, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "무료 베타 체험",
  description: "국내 로스터리 원두의 변동을 확인하고 가격과 향미를 비교해보세요. 관심 원두 찜은 Google 로그인 후 이용할 수 있습니다.",
  alternates: { canonical: "/onboarding" },
  robots: { index: false, follow: true },
};

const steps = [
  {
    title: "1. 이번 주 원두 변동 확인",
    desc: "새로 확인된 원두와 판매 목록에 다시 나타난 원두를 살펴보세요. 실시간 재고를 뜻하지는 않습니다.",
    cta: "최근 변동 보기",
    href: "/changes",
    icon: Coffee,
  },
  {
    title: "2. 원두 찾아 비교하기",
    desc: "브랜드·원산지·로스팅 필터로 평소 찾던 원두를 비교해보세요. 로그인은 필요하지 않습니다.",
    cta: "원두 찾기",
    href: "/beans",
    icon: Search,
  },
  {
    title: "3. 관심 원두 찜해보기",
    desc: "원두를 저장하려면 Google 로그인이 필요합니다. 보관함에서 로그인한 뒤 원두 찾기로 돌아가 찜해주세요.",
    cta: "내 원두 보관함",
    href: "/my-beans",
    icon: Heart,
  },
];

export default function OnboardingPage() {
  return (
    <main className="kc-page max-w-2xl text-coffee-light">
      <header className="mb-7 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-coffee-gold/20 bg-coffee-gold/10">
          <Coffee className="h-7 w-7 text-coffee-gold" aria-hidden="true" />
        </div>
        <p className="mb-2 text-sm font-semibold text-coffee-gold">Kinelo Coffee · 무료 베타</p>
        <h1 className="text-2xl font-bold">나의 커피 생활, 여기서 시작해요</h1>
        <p className="mt-3 text-sm leading-6 text-coffee-latte">
          여러 로스터리의 원두를 한곳에서 찾고, 변화가 있는 상품을 비교할 수 있습니다.
          아래 세 가지를 직접 체험해보세요.
        </p>
      </header>

      <section aria-label="무료 베타 체험 순서" className="space-y-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <article key={step.href} className="card-coffee flex gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-coffee-gold/20 bg-coffee-gold/10">
                <Icon className="h-5 w-5 text-coffee-gold" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-coffee-light">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-coffee-latte">{step.desc}</p>
                <Link
                  href={step.href}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-coffee-gold/10 px-3.5 py-2 text-sm font-semibold text-coffee-gold underline-offset-4 hover:bg-coffee-gold/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-coffee-gold"
                >
                  {step.cta}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-7 rounded-2xl border border-[var(--kc-line)] bg-coffee-medium p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-5 w-5 text-coffee-gold" aria-hidden="true" />
          체험 후 알려주세요
        </h3>
        <p className="mt-3 text-sm leading-6 text-coffee-light">
          찾는 원두가 있었는지, 찜 저장이 잘 됐는지, 가장 불편했던 점이 무엇인지
          이 링크를 공유한 사람에게 알려주세요. 계정 정보나 비밀번호는 보내지 마세요.
        </p>
      </section>

      <p className="mt-6 text-xs leading-6 text-coffee-latte">
        베타 기간 중 기능이 변경될 수 있습니다. 원두 판매 여부·가격·재고는 판매처가 기준이며,
        개인 알림의 실제 수신과 유료 서비스는 이번 무료 체험의 검증 완료 범위에 포함되지 않습니다.
        서비스 개선을 위해 페이지 조회와 링크 선택 등 익명 행동 건수를 집계합니다.
      </p>

      <Link href="/" className="mt-5 inline-flex min-h-11 items-center text-sm text-coffee-latte underline underline-offset-4">
        홈으로 돌아가기
      </Link>
    </main>
  );
}
