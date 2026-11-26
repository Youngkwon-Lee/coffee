import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck, ChevronLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description:
    "Kinelo Coffee가 어떤 개인정보를 어떤 목적으로 수집·이용하고, 누구에게 처리 위탁하며, 어떻게 파기하는지 안내합니다.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

/**
 * 사이트에 그대로 공개되는 값이다. 바꿀 때는 이 블록만 고치면 된다.
 * - 운영자: 서비스 운영 주체. 사업자등록 전에는 개인 운영자 이름으로 표기한다.
 * - 문의 이메일: 개인 메일이 아니라 브랜드 주소를 쓴다(수신은 같은 메일함으로 온다).
 * - 시행일: 이 방침을 실제로 공개한 날. 공개 전에 반드시 오늘 날짜로 맞춘다.
 */
const POLICY = {
  serviceName: "Kinelo Coffee",
  operator: "이영권",
  contactEmail: "hello@kinelo.co.kr",
  noticeDate: "2026-11-26",
  effectiveDate: "2026-11-26",
};

const collected = [
  {
    kind: "회원 가입·로그인",
    items: "이메일 주소, 비밀번호(암호화 저장), 또는 Google 계정의 이메일 주소·프로필 이름",
    when: "Google 로그인 또는 이메일로 가입할 때",
  },
  {
    kind: "서비스 이용 기록",
    items: "찜한 원두 목록, 확인 기록, 장바구니, 알림 이용권 상태",
    when: "서비스를 쓰는 동안 자동으로 생성",
  },
  {
    kind: "알림 설정",
    items: "텔레그램 연동 식별자(연결을 선택한 경우), 알림 조건",
    when: "텔레그램 알림을 연결할 때",
  },
  {
    kind: "사진 기록",
    items: "올린 원두 봉투·영수증 사진과 그 사진에서 뽑아낸 문자열",
    when: "사진으로 기록하기를 쓸 때",
  },
  {
    kind: "자동 수집 정보",
    items: "접속 기기·브라우저 정보, 접속 기록, 쿠키, 대략적인 접속 지역",
    when: "서비스에 접속할 때",
  },
];

const processors = [
  {
    name: "Google LLC (Firebase, Google Maps, Cloud Vision, Google AdSense)",
    data: "계정 이메일·로그인 정보, 저장된 기록, 지도 표시를 위한 접속 위치, 봉투 분석을 위해 올린 이미지, 접속 정보·쿠키",
    purpose: "로그인과 데이터 저장, 지도 표시, 이미지 문자 인식, 광고 게재",
  },
  {
    name: "OpenAI",
    data: "사진 기록에서 올린 이미지 또는 그에서 뽑아낸 문자열",
    purpose: "원두·영수증 정보를 구조화된 기록으로 바꾸기",
  },
  {
    name: "운영자가 직접 운영하는 이미지 처리 서버",
    data: "올린 사진 이미지",
    purpose: "사진 속 문자 인식(자체 모델)",
  },
  {
    name: "Telegram",
    data: "알림 메시지 내용과 텔레그램 식별자",
    purpose: "재입고·가격 변동 알림 발송",
  },
  {
    name: "Vercel Inc.",
    data: "접속 기록, 이용 통계",
    purpose: "서비스 호스팅과 이용 통계",
  },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-8">
      <h2 id={`${id}-title`} className="text-lg font-semibold text-coffee-light">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-coffee-latte">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="kc-page max-w-2xl text-coffee-light">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-coffee-latte hover:text-coffee-gold"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        홈으로
      </Link>

      <header className="mt-2">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-coffee-gold">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          {POLICY.serviceName}
        </p>
        <h1 className="text-2xl font-bold leading-snug">개인정보처리방침</h1>
        <p className="mt-3 text-sm leading-7 text-coffee-latte">
          {POLICY.serviceName}(이하 &ldquo;서비스&rdquo;)는 이용자의 개인정보를 소중하게
          생각하며, 「개인정보 보호법」 등 관련 법령을 지킵니다. 이 방침은 서비스가 어떤
          정보를 어떤 목적으로 수집·이용하고, 누구에게 처리를 맡기며, 어떻게 파기하는지
          알려 드립니다.
        </p>
        <p className="mt-2 text-xs text-coffee-latte">
          시행일 {POLICY.effectiveDate}
        </p>
      </header>

      <Section id="collect" title="1. 수집하는 개인정보 항목과 수집 방법">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--kc-line)] text-coffee-light">
                <th scope="col" className="py-2 pr-3 font-semibold">구분</th>
                <th scope="col" className="py-2 pr-3 font-semibold">항목</th>
                <th scope="col" className="py-2 font-semibold">수집 시점</th>
              </tr>
            </thead>
            <tbody>
              {collected.map((row) => (
                <tr key={row.kind} className="border-b border-[var(--kc-line)] align-top">
                  <th scope="row" className="py-2.5 pr-3 font-medium text-coffee-light">
                    {row.kind}
                  </th>
                  <td className="py-2.5 pr-3">{row.items}</td>
                  <td className="py-2.5">{row.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          서비스는 로그인하지 않아도 원두·카페 목록을 볼 수 있습니다. 찜, 기록, 알림처럼
          계정에 남는 기능을 쓸 때만 로그인을 받습니다.
        </p>
      </Section>

      <Section id="purpose" title="2. 개인정보의 이용 목적">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>회원을 식별하고 로그인하며, 찜 목록·기록·장바구니 같은 이용자별 기능을 제공합니다.</li>
          <li>찜한 원두가 판매 목록에 다시 나타나거나 가격이 바뀌면 알림을 보냅니다.</li>
          <li>올린 사진에서 원두·영수증 정보를 읽어 기록을 자동으로 채웁니다.</li>
          <li>서비스 품질을 개선하고 오류를 분석하며, 개인을 식별하지 않는 형태로 이용 통계를 만듭니다.</li>
          <li>광고를 게재합니다(4항 참고).</li>
        </ol>
      </Section>

      <Section id="ads" title="3. 광고 게재와 쿠키">
        <p>서비스는 Google AdSense를 통해 광고를 게재할 수 있습니다.</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Google과 그 파트너는 이용자의 이전 방문 기록을 바탕으로 광고를 게재하기 위해 쿠키를 사용합니다.</li>
          <li>
            맞춤 광고는{" "}
            <a
              className="text-coffee-gold underline underline-offset-2"
              href="https://adssettings.google.com"
              target="_blank"
              rel="noreferrer noopener"
            >
              Google 광고 설정
            </a>
            에서 끌 수 있고,{" "}
            <a
              className="text-coffee-gold underline underline-offset-2"
              href="https://www.aboutads.info"
              target="_blank"
              rel="noreferrer noopener"
            >
              www.aboutads.info
            </a>
            에서 제3자 광고 사업자의 쿠키 사용을 거부할 수 있습니다.
          </li>
          <li>
            광고 게재에 관한 Google의 설명은{" "}
            <a
              className="text-coffee-gold underline underline-offset-2"
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noreferrer noopener"
            >
              Google 개인정보처리방침(파트너 사이트)
            </a>
            에서 확인할 수 있습니다.
          </li>
          <li>
            쿠키 저장을 원하지 않으면 브라우저 설정에서 쿠키를 차단할 수 있습니다. 다만 이
            경우 로그인 등 일부 기능이 제한될 수 있습니다.
          </li>
        </ul>
        <p>
          로그인·마이페이지·장바구니처럼 개인 기록이 보이는 화면은 검색엔진 색인에서
          제외하고, 광고 노출 대상에서도 제외하는 것을 원칙으로 합니다.
        </p>
      </Section>

      <Section id="third-party" title="4. 개인정보의 제3자 제공 및 처리 위탁">
        <p>
          서비스는 이용자의 개인정보를 판매하지 않습니다. 서비스를 운영하기 위해 아래
          업체의 설비를 이용하며, 각 업체는 자기 목적의 처리자로서 정보를 보관·처리합니다.
          위탁 내용이나 수탁자가 바뀌면 이 방침을 통해 알립니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--kc-line)] text-coffee-light">
                <th scope="col" className="py-2 pr-3 font-semibold">업체</th>
                <th scope="col" className="py-2 pr-3 font-semibold">이전되는 정보</th>
                <th scope="col" className="py-2 font-semibold">목적</th>
              </tr>
            </thead>
            <tbody>
              {processors.map((row) => (
                <tr key={row.name} className="border-b border-[var(--kc-line)] align-top">
                  <th scope="row" className="py-2.5 pr-3 font-medium text-coffee-light">
                    {row.name}
                  </th>
                  <td className="py-2.5 pr-3">{row.data}</td>
                  <td className="py-2.5">{row.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          국가기관이 법령에 정한 절차와 방법으로 요구하는 경우에는 그 범위에서 제공할 수
          있습니다.
        </p>
      </Section>

      <Section id="retention" title="5. 보유 기간과 파기">
        <p>
          회원 탈퇴 또는 수집 목적을 다하면 해당 정보를 지체 없이 파기합니다. 전자적
          파일은 복구할 수 없는 방법으로 삭제합니다. 다만 아래 기록은 관계 법령에 따라
          정해진 기간 동안 보관합니다.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
          <li>대금 결제 및 재화 등의 공급에 관한 기록: 5년 (같은 법)</li>
          <li>소비자의 불만 또는 분쟁 처리에 관한 기록: 3년 (같은 법)</li>
          <li>표시·광고에 관한 기록: 6개월 (같은 법)</li>
          <li>서비스 접속 기록: 3개월 (통신비밀보호법)</li>
        </ul>
        <p>
          유료 이용권은 지금은 운영자가 입금을 확인해 직접 처리하며, 결제 대행사를 통한
          자동 결제는 하지 않습니다.
        </p>
      </Section>

      <Section id="rights" title="6. 이용자의 권리와 행사 방법">
        <p>
          이용자는 언제든지 자신의 개인정보를 조회·정정하거나 처리 정지·삭제·동의 철회를
          요청할 수 있습니다. 찜 목록·기록·알림 설정은 서비스 안에서 직접 확인하고 바꿀 수
          있으며, 계정 삭제와 탈퇴는 아래 문의처로 요청하면 본인 확인 뒤 지체 없이
          처리합니다. 만 14세 미만 아동의 개인정보는 수집하지 않습니다.
        </p>
      </Section>

      <Section id="security" title="7. 개인정보의 안전성 확보 조치">
        <p>
          비밀번호는 암호화해 저장하고, 접근 권한을 필요한 사람으로 최소화하며, 전송
          구간은 HTTPS로 보호합니다. 이용자별 데이터는 본인 계정에만 열람되도록 접근
          규칙을 적용합니다.
        </p>
      </Section>

      <Section id="officer" title="8. 개인정보 보호 책임자 및 문의처">
        <ul className="list-none space-y-1.5">
          <li>개인정보 보호 책임자: {POLICY.operator}</li>
          <li>
            이메일:{" "}
            <a
              className="text-coffee-gold underline underline-offset-2"
              href={`mailto:${POLICY.contactEmail}`}
            >
              {POLICY.contactEmail}
            </a>
          </li>
        </ul>
        <p>
          개인정보와 관련한 문의, 불만 처리, 피해 구제 요청은 위 연락처로 보내 주세요.
          개인정보 침해에 관한 상담이 필요하면 개인정보침해신고센터(국번 없이 118),
          개인정보분쟁조정위원회(1833-6972)에 문의할 수 있습니다.
        </p>
      </Section>

      <Section id="notice" title="9. 고지의 의무">
        <p>
          이 방침의 내용이 추가·삭제·수정되면 시행 7일 전부터 서비스 안에서 알립니다.
          다만 이용자 권리에 중요한 변경은 30일 전에 알립니다.
        </p>
        <ul className="list-none space-y-1.5">
          <li>공고일: {POLICY.noticeDate}</li>
          <li>시행일: {POLICY.effectiveDate}</li>
        </ul>
      </Section>

      <footer className="mt-10 border-t border-[var(--kc-line)] pt-5 text-sm text-coffee-latte">
        <p>
          {POLICY.serviceName} · 운영자 {POLICY.operator} ·{" "}
          <a
            className="text-coffee-gold underline underline-offset-2"
            href={`mailto:${POLICY.contactEmail}`}
          >
            {POLICY.contactEmail}
          </a>
        </p>
        <p className="mt-2">
          <Link href="/onboarding" className="underline underline-offset-2 hover:text-coffee-gold">
            서비스 소개
          </Link>
        </p>
      </footer>
    </main>
  );
}
