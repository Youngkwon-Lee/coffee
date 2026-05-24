"use client";

import Link from "next/link";
import { Coffee, Compass, CheckCircle2, ChevronRight } from "lucide-react";

const steps = [
  {
    title: "1) 내 취향 빠르게 설정",
    desc: "산미/바디/단맛 기준으로 취향을 먼저 잡아요.",
    cta: "원두 찾기 시작",
    href: "/beans",
    icon: Coffee,
  },
  {
    title: "2) 카페 후보 찾기",
    desc: "현재 위치/조건에 맞는 카페를 골라요.",
    cta: "카페 찾기",
    href: "/cafes",
    icon: Compass,
  },
  {
    title: "3) 첫 기록 남기기",
    desc: "사진으로 첫 커피 기록을 만들어보세요.",
    cta: "기록 시작",
    href: "/record/photo",
    icon: CheckCircle2,
  },
];

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-coffee-dark p-4 pb-24 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#c5a880]/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-xl mx-auto relative z-10">
        <div className="text-center mt-12 mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#c5a880]/10 border border-[#c5a880]/20 mb-4 animate-fade-in">
            <Coffee className="w-8 h-8 text-[#c5a880]" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-[#f8f6f3] tracking-tight">커피 저널 온보딩</h1>
          <p className="text-sm text-coffee-light/60 mt-2 font-medium">1분 안에 시작할 수 있게 핵심만 준비했어요.</p>
        </div>

        <div className="space-y-4">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="card-coffee p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-[#c5a880]">
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-[#f8f6f3]">{s.title}</div>
                  <div className="text-xs text-coffee-light/60 mt-1 font-medium">{s.desc}</div>
                  <div className="mt-3.5">
                    <Link
                      href={s.href}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#c5a880]/10 border border-[#c5a880]/20 text-[#c5a880] hover:bg-[#c5a880]/25 transition-all duration-300"
                    >
                      <span>{s.cta}</span>
                      <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-xs text-coffee-light/40 hover:text-coffee-light/75 transition-colors font-medium">
            나중에 하고 홈으로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
