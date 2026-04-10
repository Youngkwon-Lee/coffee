"use client";

import Link from "next/link";

const steps = [
  {
    title: "1) 내 취향 빠르게 설정",
    desc: "산미/바디/단맛 기준으로 취향을 먼저 잡아요.",
    cta: "원두 찾기 시작",
    href: "/beans",
  },
  {
    title: "2) 카페 후보 찾기",
    desc: "현재 위치/조건에 맞는 카페를 골라요.",
    cta: "카페 찾기",
    href: "/cafes",
  },
  {
    title: "3) 첫 기록 남기기",
    desc: "사진으로 첫 커피 기록을 만들어보세요.",
    cta: "기록 시작",
    href: "/record/photo",
  },
];

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-coffee-dark p-4 pb-24">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mt-8 mb-8">
          <div className="text-5xl mb-3">☕</div>
          <h1 className="text-2xl font-bold text-coffee-light">온보딩</h1>
          <p className="text-sm text-coffee-light/70 mt-2">1분 안에 시작할 수 있게 핵심만 준비했어요.</p>
        </div>

        <div className="space-y-3">
          {steps.map((s) => (
            <div key={s.title} className="bg-coffee-medium rounded-xl border border-coffee-gold/10 p-4">
              <div className="font-semibold text-coffee-light">{s.title}</div>
              <div className="text-sm text-coffee-light/70 mt-1">{s.desc}</div>
              <Link
                href={s.href}
                className="mt-3 inline-flex items-center px-3 py-2 rounded-lg text-sm bg-coffee-gold/20 border border-coffee-gold/40 text-coffee-gold"
              >
                {s.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-coffee-light/70 underline">
            나중에 하고 홈으로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
