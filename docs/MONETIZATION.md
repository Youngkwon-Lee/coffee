# Coffee Journal — 수익화 실행 계획

> 작성: 2026-07-30
> 근거: 코드베이스 실사 (crawler/change_detector, Firebase Auth/favorites, Vercel 배포 `coffee-omega-lovat.vercel.app`)
> 포지션: 방치형 사이드 수익. PhysioKorea 1순위를 침범하지 않는 주말 프로젝트 규모 유지.

---

## 1. 핵심 웨지 (결론 먼저)

**"즐겨찾기한 원두의 재입고 + 가격 인하 알림"**이 유일한 유료 지점이다.

이유:
- `coffee_crawler/processors/change_detector.py`가 이미 `restored`(재입고 프록시) / `deleted`(품절 프록시) / price diff를 계산한다 — 지금은 카운트만 쓰고 버리는 중.
- Firebase Auth + `users/{uid}/favorites_beans`가 이미 있다 — 알림 대상 지정 UX가 공짜.
- 커피 덕후는 인기 로스터리 원두 재입고를 놓치는 것에 실제로 돈을 낸다 (월 2,000~3,000원).

수익 구조 3층:

| 층 | 상품 | 가격 | 비고 |
| --- | --- | --- | --- |
| 무료 | 텔레그램 채널 "이번 주 신상 원두" | 0원 | 유입 엔진. 주간 crawl 결과의 `new` диff를 자동 발행 |
| 유료 | 내 즐겨찾기 재입고/가격 알림 (텔레그램 봇 or 이메일) | 월 2,900원 | 핵심 상품 |
| 제휴 | 로스터리 제휴 링크/노출 | 건당 협의 | 제휴 요청 자체가 영업 채널 |

### 가격 벤치마크 (2026-07-30 리서치)

- 원두 전용 재입고/가격 알림 서비스는 국내외 모두 확인되지 않음 — 카테고리 자체가 미검증 (기회이자 리스크).
- 가장 근접한 유사 모델: 스니커즈 재입고 알림 (Sole Retriever Basic $6.99/월, Pro $14.99/월). 월 2,900원은 그 대비 1/3 수준이라 가격 저항은 낮을 것.
- 판단: **가격 검증보다 수요 검증이 진짜 리스크.** 그래서 유료화(Week 3) 전에 무료 텔레그램 채널(Week 1)로 수요 신호부터 확인하는 순서를 유지한다.

---

## 2. 현재 상태 vs 필요 작업 (실사 결과)

이미 있는 것:
- [x] 12개 로스터리 크롤러 (config 기준, README의 8개는 구식)
- [x] 변경 감지: `change_detector.py` — new/updated/deleted/restored + price old/new diff
- [x] Firebase Auth (Google + email) / 즐겨찾기 / owner-only rules
- [x] Vercel 라이브 배포, 한국어 PWA, 검색/필터/바스켓
- [x] Discord/Slack ops 알림 (GitHub Actions 인라인)

없는 것 (= 실제 작업 목록):
- [x] **per-bean diff 영속화** (2026-07-30 구현): `event_recorder.py` → Firestore `bean_events` (new/restored/deleted/price_change). restored는 과거 deleted 이벤트 이력으로 판별
- [x] **price 숫자화** (2026-07-30 구현): `price_krw` 필드 + str 비교 버그 3곳 수정. 단, CI 실제 쓰기 경로인 `reset_all_active_cafes_from_crawl.mjs`는 아직 price 문자열만 저장 (이벤트 로직은 독립적이라 무관)
- [x] **사용자 발송 채널** (2026-07-30 구현): 텔레그램 — 채널 다이제스트(`telegram_notifier.py`) + 즐겨찾기 DM(`send_favorite_alerts.py`, 무료 3개/프리미엄 무제한 게이팅) + 봇 연동 웹훅(`/api/telegram-webhook`) + 알림 설정 페이지(`/settings/alerts`)
- [x] **크롤 주기 상향** (2026-07-30 구현): `coffee_crawler.yml` cron 매일 06:00 KST, `crawler.yml` 스케줄 비활성화
- [ ] **품절 상태 파싱**: `deleted`/`restored` 프록시로 시작 (구현됨). 파서별 실제 품절 감지는 점진 추가
- [ ] **결제**: 계좌이체 + 수동 `users/{uid}.plan = 'premium'` (구독자 30명까지 수동 유지)

배포 전 수동 단계 (2026-07-30 기준):
1. BotFather로 봇 생성 → `TELEGRAM_BOT_TOKEN`, 채널 생성 + 봇 admin 추가 → `TELEGRAM_CHANNEL_ID` (GitHub Actions secrets)
2. Vercel 환경변수: `TELEGRAM_WEBHOOK_SECRET`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, `FIREBASE_SERVICE_ACCOUNT_KEY`
3. 웹훅 등록: `curl "https://api.telegram.org/bot<TOKEN>/setWebhook" -d url=https://<host>/api/telegram-webhook -d secret_token=<SECRET>`
4. `firebase deploy --only firestore:rules`
5. 알려진 한계: 이벤트가 validation 전에 기록됨 / DM 중복 방지 원장 없음 (25h 윈도우로 중복 ~1h 수준)

---

## 3. 실행 순서 (4주)

### Week 1 — 무료 유입 엔진 (코드 최소)
1. 크롤러 중복 정리: `crawler.yml` 제거, `coffee_crawler.yml`만 유지, cron을 `0 21 * * *` (매일 06시 KST)로.
2. 텔레그램 공개 채널 개설: "원두레이더" (가칭). 크롤 후 `new` 목록을 채널로 자동 발행하는 스텝을 Actions에 추가 (Discord 발행 코드 패턴 재사용).
3. 웹사이트 헤더에 텔레그램 채널 배너 추가.

### Week 2 — diff 영속화 + 알림 MVP
4. `bean_events` Firestore 컬렉션: `{bean_id, type: new|restored|deleted|price_change, old_price, new_price, detected_at}`.
5. `price_krw` 숫자 필드 추가 + normalizer 수정.
6. 텔레그램 봇: `/start`로 uid 연동 → 즐겨찾기 원두의 `restored`/`price_change` 이벤트 발생 시 DM.

### Week 3 — 유료화
7. 알림 기능을 "프리미엄" 게이트: 무료 = 즐겨찾기 3개까지 알림, 유료 = 무제한 + 가격 인하 알림.
8. 결제: 초기 30명까지 토스 송금 + 수동 활성화 (users doc에 `plan: premium`, `premium_until`). 빌링 자동화는 유료 전환이 증명된 후.

### Week 4 — 제휴 영업
9. 로스터리 아웃리치: `src/data/cafesData.js`의 purchase.channel/website가 연락처 리스트. 아래 4번 초안 사용.
10. 커뮤니티 공유: 네이버 커피 카페, 에스프레소 갤러리 등에 "전국 12개 로스터리 신상 원두 한눈에" 소개 글.

주의: `scripts/sanitize_bean_links.py`가 매일 링크 파라미터를 제거하므로, 제휴 파라미터 도입 시 allowlist 처리 필요.

---

## 4. 로스터리 제휴 제안 메일/DM 초안

> 제목: [Coffee Journal] ○○커피 원두를 매주 구독자에게 소개하고 있습니다

안녕하세요, 커피 원두 정보 서비스 Coffee Journal을 운영하는 이영권입니다.

저희는 전국 12개 스페셜티 로스터리의 신상 원두를 자동 수집해 웹과 텔레그램 채널로 소개하고 있고, ○○커피의 원두도 출시될 때마다 구독자들에게 안내되고 있습니다.

- 서비스: coffee-omega-lovat.vercel.app (텔레그램 채널 @원두레이더)
- 현재 ○○커피 원두 페이지에서 공식 스토어로 구매 링크를 연결하고 있습니다.

두 가지를 제안드리고 싶습니다.

1. **정보 정합성**: 신제품/품절/가격 정보를 저희가 정확히 반영하도록, 공식 채널(RSS, 공지 등)이 있다면 알려주세요.
2. **제휴**: 저희 채널 경유 구매에 대한 제휴(추적 링크 또는 구독자 전용 코드)에 관심 있으시면 조건을 논의하고 싶습니다.

로스터리에 비용이 발생하는 제안이 아니며, 부담 없이 회신 주시면 감사하겠습니다.

---

## 5. KPI

- Week 2: 텔레그램 채널 구독자 50명
- Week 4: 유료 알림 구독자 5명 (검증 기준: 5명이 실제 결제하면 빌링 자동화 투자)
- 3개월: 유료 30명(월 ~9만원) + 제휴 1곳 — 이 수준이면 "방치형" 목표 달성. 그 이상 성장은 PhysioKorea 우선순위와 트레이드오프 판단.

## 6. 하지 않을 것

- 이메일 프로바이더 계약 (텔레그램으로 충분해질 때까지)
- 자체 결제/빌링 구축 (유료 30명 전까지 수동)
- 로스터리 추가 확장 (12개 파서 유지보수가 이미 상한)
- 원두 리뷰/커뮤니티 기능 (범위 폭발 지점)
