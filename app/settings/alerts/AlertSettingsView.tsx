import Link from 'next/link';
import { Bell, ArrowRight, Link2 } from 'lucide-react';
import { PREMIUM_PRICE_KRW, PREMIUM_PERIOD_DAYS, type PremiumRequest, type PremiumState } from '@/lib/premium';

export const primaryActionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-coffee-gold px-5 py-3 text-sm font-semibold text-coffee-dark transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coffee-gold disabled:opacity-50';
export const secondaryActionClass = 'min-h-11 py-2 text-sm text-coffee-gold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-coffee-gold';

export type AlertSettingsViewProps = {
  authenticated: boolean;
  loading: boolean;
  error: string | null;
  notice: string | null;
  linked: boolean;
  state: PremiumState;
  expiresAt: number | null;
  request: PremiumRequest | null;
  legacyRequest: boolean;
  salesEnabled: boolean;
  busy: boolean;
  deepLink: string | null;
  linkCode: string | null;
  onLogin: () => void;
  onRefresh: () => void;
  onConnect: () => void;
  onRequest: () => void;
};

/** Presentational view: authenticated states can be rendered with local fixtures. */
export default function AlertSettingsView(props: AlertSettingsViewProps) {
  const { authenticated, loading, error, notice, linked, state, expiresAt, request, legacyRequest, salesEnabled, busy, deepLink, linkCode } = props;
  const active = state === 'active' || state === 'manual';
  const waiting = request?.status === 'pending' || request?.status === 'awaiting_payment';
  const expiry = expiresAt !== null && Number.isFinite(expiresAt)
    ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(expiresAt)
    : null;
  const title = !authenticated ? '내 원두 소식, 한곳에서' : state === 'expired' ? '이용 기간이 끝났습니다' : active ? '프리미엄 알림 이용 중' : '무료 알림';
  let description = active ? '즐겨찾기한 모든 원두의 변화를 확인합니다.' : '먼저 등록한 즐겨찾기 3개까지 확인합니다.';
  if (!authenticated) description = '로그인하고 텔레그램을 연결하면 관심 원두의 변화를 받아볼 수 있습니다.';
  else if (state === 'invalid') description = '이용 기간 정보를 확인할 수 없습니다. 현재는 무료 알림 기준이 적용됩니다.';
  else if (state === 'expired') description = '무료 알림으로 전환되었습니다. 먼저 등록한 즐겨찾기 3개가 대상입니다.';

  let action;
  if (loading) action = <p role="status" className="text-sm text-coffee-latte">알림 정보를 확인하고 있습니다.</p>;
  else if (!authenticated) action = <button className={primaryActionClass} onClick={props.onLogin} disabled={busy}>구글로 로그인</button>;
  else if (error) action = <button className={primaryActionClass} onClick={props.onRefresh} disabled={busy}>다시 확인</button>;
  else if (!linked && deepLink) action = <a className={primaryActionClass} href={deepLink} target="_blank" rel="noopener noreferrer">텔레그램에서 연결 <ArrowRight size={16} aria-hidden="true" /></a>;
  else if (!linked) action = <button className={primaryActionClass} onClick={props.onConnect} disabled={busy}>{busy ? '연결 준비 중…' : '텔레그램 연결하기'}</button>;
  else if (waiting) action = <button className={primaryActionClass} onClick={props.onRefresh} disabled={busy}>신청 상태 확인</button>;
  else if (salesEnabled && state !== 'manual' && state !== 'invalid') action = <button className={primaryActionClass} onClick={props.onRequest} disabled={busy}>{busy ? '신청 중…' : legacyRequest ? '신청 정보 갱신' : active || state === 'expired' ? '30일 연장 신청' : '프리미엄 신청'}</button>;
  else action = <Link className={primaryActionClass} href="/beans">관심 원두 고르기 <ArrowRight size={16} aria-hidden="true" /></Link>;

  return <main className="mx-auto max-w-xl px-5 pt-24 pb-28 text-coffee-light">
    <header className="mb-7">
      <p className="mb-3 flex items-center gap-2 text-sm text-coffee-gold"><Bell size={18} aria-hidden="true" /> 원두레이더</p>
      <h1 className="text-2xl font-bold tracking-tight">알림 설정</h1>
      <p className="mt-2 text-sm leading-6 text-coffee-latte">관심 원두의 판매페이지 변화를 매일 확인합니다.</p>
    </header>
    <section className="rounded-xl border border-coffee-gold bg-coffee-medium p-5" aria-labelledby="plan-title">
      <h2 id="plan-title" className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-coffee-latte">{description}</p>
      {expiry && <p className="mt-2 text-sm text-coffee-light">{state === 'expired' ? '종료' : '이용 기한'}: {expiry} KST</p>}
      {state === 'manual' && <p className="mt-2 text-sm text-coffee-latte">기간이 지정되지 않은 기존 수동 권한입니다. 유료 결제 내역을 의미하지 않습니다.</p>}
      {authenticated && <p className="mt-3 flex items-center gap-2 text-sm text-coffee-latte"><Link2 size={16} aria-hidden="true" /> 텔레그램 {linked ? '연결됨' : '연결 필요'}</p>}
      {request?.status === 'pending' && <p className="mt-3 text-sm leading-6 text-coffee-light">신청을 접수했습니다. 운영자가 확인한 후 연결된 텔레그램으로 안내합니다. 아직 결제되거나 권한이 변경되지 않았습니다.</p>}
      {request?.status === 'awaiting_payment' && <p className="mt-3 text-sm leading-6 text-coffee-light">결제 안내 단계입니다. 운영자가 전달한 안내를 확인해 주세요. 입금 확인 후 30일 이용권이 활성화됩니다.</p>}
      {(request?.status === 'declined' || request?.status === 'cancelled') && <p className="mt-3 text-sm text-coffee-latte">이전 신청이 종료되었습니다. 판매 접수 중이면 다시 신청할 수 있습니다.</p>}
      {!salesEnabled && !waiting && <p className="mt-4 text-sm leading-6 text-coffee-latte">유료 파일럿은 준비 중입니다. 무료 알림을 먼저 이용할 수 있습니다.</p>}
      {error && <p role="alert" className="mt-4 text-sm leading-6 text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-4 text-sm leading-6 text-coffee-light">{notice}</p>}
      <div className="mt-5">{action}</div>
      {deepLink && !linked && <div className="mt-4 text-sm leading-6 text-coffee-latte">
        <p>연결 코드: <strong className="font-mono tracking-wider text-coffee-light">{linkCode}</strong> · 30분간 유효</p>
        <p>봇에서 연결을 완료한 뒤 이 화면의 상태를 확인해 주세요.</p>
        <button className={secondaryActionClass} onClick={props.onRefresh} disabled={busy}>연결 상태 확인</button>
      </div>}
    </section>
    <p className="mt-5 text-sm leading-6 text-coffee-latte">프리미엄 {PREMIUM_PRICE_KRW.toLocaleString('ko-KR')}원 / {PREMIUM_PERIOD_DAYS}일 · 자동 결제 없음<br />가격과 수요를 확인하는 파일럿입니다. <Link href="/premium" className="text-coffee-gold underline underline-offset-4">상품 안내</Link></p>
    <details className="mt-6 border-t border-coffee-gold pt-4 text-sm leading-6 text-coffee-latte">
      <summary className="min-h-11 cursor-pointer py-2 text-coffee-light">알림 범위와 연결 관리</summary>
      <p className="mt-2">판매페이지에서 다시 확인된 상품과 가격 인하를 안내합니다. 실시간 재고 알림이 아니며, 변화가 없으면 메시지가 없을 수 있습니다. 최종 가격과 재고는 판매처에서 확인해 주세요.</p>
      <p className="mt-3">수집에 실패하거나 상품 구성이 바뀌면 확인이 늦어지거나 부정확할 수 있습니다. 무료와 프리미엄의 확인 주기는 같습니다.</p>
      {authenticated && linked && <div className="mt-3 flex flex-wrap gap-x-5">
        <button className={secondaryActionClass} onClick={props.onConnect} disabled={busy}>다른 텔레그램 연결</button>
        <button className={secondaryActionClass} onClick={props.onRefresh} disabled={busy}>상태 새로고침</button>
      </div>}
      {linked && deepLink && <a href={deepLink} target="_blank" rel="noopener noreferrer" className={secondaryActionClass}>새 계정으로 연결 · 코드 {linkCode}</a>}
    </details>
    <Link href="/my-beans" className={`mt-4 inline-block ${secondaryActionClass}`}>내 원두 보관함</Link>
  </main>;
}
