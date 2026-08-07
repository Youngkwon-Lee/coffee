import type { Metadata } from 'next';

/** 목록 페이지들과 제목이 겹치면 검색 결과에서 구분되지 않는다. */
export const metadata: Metadata = {
  description:
    '국내 로스터리 원두를 한곳에서 비교하고, 재입고와 가격 변동을 알림으로 받아보세요.',
  alternates: { canonical: '/' },
};
import MainPageHero from './components/MainPageHero';

export default function HomePage() {
  return <MainPageHero />;
}