import Link from 'next/link';
import { Bell, ArrowRight } from 'lucide-react';
import { PREMIUM_PRICE_KRW, PREMIUM_PERIOD_DAYS } from '@/lib/premium';

export const metadata = { title: '원두레이더 프리미엄 | 30일 알림 파일럿', description: '여러 로스터리의 관심 원두 변화를 한곳에서. 무료 알림부터 시작하는 수동 결제 파일럿.' };

export default function PremiumPage() {
  return <main className="mx-auto max-w-xl px-5 pt-24 pb-28 text-coffee-light">
    <header>
      <p className="mb-4 flex items-center gap-2 text-sm text-coffee-gold"><Bell size={18} aria-hidden="true" /> 원두레이더 · 유료 파일럿</p>
      <h1 className="text-3xl font-bold leading-snug tracking-tight">관심 원두의 변화,<br />매일 한 번 확인합니다.</h1>
      <p className="mt-4 text-base leading-7 text-coffee-latte">로스터리마다 다시 찾아보는 수고를 줄이세요. 즐겨찾기한 원두가 판매페이지에 다시 나타나거나 가격이 내려가면 텔레그램으로 안내합니다.</p>
    </header>
    <section className="mt-7 border-y border-coffee-gold py-5" aria-label="이용권 가격과 범위">
      <p className="text-xl font-semibold">{PREMIUM_PRICE_KRW.toLocaleString('ko-KR')}원 <span className="text-sm font-normal text-coffee-latte">/ {PREMIUM_PERIOD_DAYS}일</span></p>
      <p className="mt-2 text-sm leading-6 text-coffee-latte">무료는 먼저 등록한 3개 · 프리미엄은 전체 즐겨찾기<br />확인 주기는 동일하며, 자동 결제는 없습니다.</p>
    </section>
    <div className="mt-6">
      <Link href="/settings/alerts" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-coffee-gold px-5 py-3 text-sm font-semibold text-coffee-dark hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coffee-gold">무료 알림부터 연결하기 <ArrowRight size={16} aria-hidden="true" /></Link>
      <p className="mt-3 text-sm leading-6 text-coffee-latte">가격과 수요를 확인하는 파일럿입니다. 유료 접수 여부는 알림 설정에서 확인할 수 있습니다.</p>
    </div>
    <details className="mt-8 border-t border-coffee-gold pt-3 text-sm leading-6 text-coffee-latte">
      <summary className="min-h-11 cursor-pointer py-2 text-coffee-light">시작 방법과 알림의 한계</summary>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>로그인 후 원두를 즐겨찾기하고 텔레그램을 연결합니다.</li>
        <li>유료 접수 중이면 설정에서 이용권을 신청합니다.</li>
        <li>운영자 안내에 따라 입금하고, 확인 후 30일 이용권을 받습니다. 미리 연장하면 남은 기간에 이어집니다.</li>
      </ol>
      <p className="mt-5">실시간 재고 알림이 아닙니다. 수집된 판매페이지의 변화로 판단하므로 실제 재입고와 다를 수 있습니다. 수집 실패 시 확인이 지연되며, 변화가 없으면 메시지가 없을 수 있습니다. 최종 가격·상품 구성·재고는 판매처에서 확인해 주세요.</p>
      <p className="mt-3">결제 안내와 운영 조건이 준비되기 전에는 유료 신청을 받지 않습니다. 이 페이지에서 결제되거나 자동 갱신되지 않습니다.</p>
    </details>
  </main>;
}
