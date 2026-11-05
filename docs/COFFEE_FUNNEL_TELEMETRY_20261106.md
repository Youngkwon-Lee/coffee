# Coffee 전환 지표 v1 — 개인정보 없는 행동 건수 계측

## 목적과 상태

2026-11-06: 기존 로스터리 원두 수집 데이터를 제품 가치로 전환하기 위해
`/changes` 공개 피드 → 상품 상세/판매처 → 즐겨찾기 → 알림 설정/연결 → 유료 신청 흐름을 측정한다.
Vercel Web Analytics는 2026-11-06에 공식 CLI 65.11.0으로 `coffee` 프로젝트에 활성화했다.
`@vercel/analytics@2.0.1` SDK를 사용해 공개 페이지뷰를 수집하고 기존 익명 전환 이벤트를 공식 Web Analytics에도 적재한다.
외부 분석 계정·별도 사용자 ID·새 Firestore 컬렉션·추가 예약 작업은 생성하지 않는다.
기존 Vercel 런타임 로그는 단기 장애 진단용으로 유지한다.

## 이벤트와 실제 의미

| event | 발생 조건 | 해석 |
| --- | --- | --- |
| `changes_view` | 공개 피드 클라이언트 화면 로드 | 방문(페이지 로드) 시도, 고유 방문자 아님 |
| `change_detail_open` | 피드의 원두 상세 링크 클릭 | 상세 페이지 이동 의도; 페이지 로드 성공 보장 안 됨 |
| `changes_store_open` | 피드 판매처 링크 클릭 | 외부 사이트로 이동 의도, 구매 아님 |
| `bean_store_open` | 원두 목록/상세/모달 구매 링크 클릭 | 외부 사이트로 이동 의도, 구매 아님 |
| `favorite_saved` | 로그인한 사용자의 `favorites_beans` Firestore `setDoc` **성공 후** | 실제 즐겨찾기 저장, 동일 사용자 중복 저장/이벤트 가능 |
| `alerts_interest` | 피드에서 무료 알림 설정 CTA 클릭 | 관심 표현, 연결 완료 아님 |
| `alerts_settings_view` | 알림 설정 화면 로드 | 알림 설정 페이지 진입 |
| `telegram_link_started` | 코드가 Firestore에 저장된 후 | 연결 시작, Telegram 메시지 수신/연결 완료 아님 |
| `telegram_link_confirmed` | 같은 탭에서 연결 시작 후 60분 내 인증된 프로필 재조회에서 연결 확인 | 실제 프로필 연결 확인, 알림 발송 성공 아님 |
| `premium_request_submitted` | 유료 신청 `setDoc` 성공 후 | 신청 접수, 결제·매출·활성 권한 아님 |

이벤트의 출처 `origin=changes`는 같은 브라우저 탭에서 공개 변동 피드를 열고 **30분 이내** 이어진 행동이다.
그 외에는 `origin=unattributed`. 개인식별/세션 식별자는 생성하지 않으며,
서로 다른 이벤트를 동일 사용자의 여정으로 1:1 연결할 수 없다.

## 해석과 집계

- **공식 Vercel Web Analytics (주 집계):** 프로젝트 `coffee` → Analytics → Pages에서 `/`, `/changes`, `/beans`, `/beans/*`, `/cafes`, `/cafes/*`, `/premium`의 페이지뷰를 확인한다. 로그인·개인 기록·관리자 화면은 `beforeSend`에서 제외한다.
- **Custom Events:** Analytics → Events에서 `coffee_changes_view`, `coffee_change_detail_open`, `coffee_changes_store_open`, `coffee_bean_store_open`, `coffee_favorite_saved`, `coffee_alerts_interest`, `coffee_alerts_settings_view`, `coffee_telegram_link_started`, `coffee_telegram_link_confirmed`, `coffee_premium_request_submitted`를 확인한다. 사용자 데이터 속성은 `origin` 한 가지(`changes`/`unattributed`)만 사용한다.
- **기존 보조 로그:** `get_runtime_logs` 검색어 `COFFEE_FUNNEL_V1`, `event=<허용된 값> origin=<허용된 값>` 한 줄. 공식 Analytics와 동일 행동을 중복 측정할 수 있으므로 두 채널의 숫자를 합산하지 않는다.
- **요금:** Web Analytics Pro 팀 전체 월 기본 포함 이벤트 50,000개, 초과 사용량 $3/100,000개 (소량 비례 과금). Web Analytics Plus(월 $10 별도)는 활성화하지 않는다. 페이지뷰와 사용자 이벤트 모두 사용량에 포함된다.
- `changes_view` 대비 `change_detail_open`, `changes_store_open`, `alerts_interest`는 행동 건수 비율로만 산출한다.
  동일 탭 반복 행동/페이지 새로고침, 광고 차단, 클라이언트 오류, 인덱싱 봇 등으로 누락·과대 집계가 가능하다.
  고유 방문자 전환율/고객 전환율이라고 부르지 않는다.
- `favorite_saved`, `telegram_link_confirmed`, `premium_request_submitted`는 데이터 쓰기/확인 성공 직후에만 계측한다.
  `origin=changes` 필터는 느슨한 30분 내 유입 기여 신호이지, 엄격한 사용자 코호트/인과 증거가 아니다.
- Vercel 런타임 로그는 보존 기간과 페이징 한계가 있으므로 **장기 통계 DB가 아니다**.
  앱이 정상 작동해도 이벤트 전송이 실패할 수 있다. 로그가 0건이라고 사용자가 0명임을 단정하지 않는다.
- 은행 입금 확인·실제 프리미엄 부여 및 텔레그램 DM 수신은 별도 운영 원장/증거와 대조한다.

## 보안·프라이버시 경계

`POST /api/coffee-funnel`은 고정 이벤트명과 `origin` 두 값만 받아 기존 런타임 로그와 공식 Web Analytics의 custom event로 기록한다.
이메일, uid, 브라우저 식별자, 세션 ID, 원두명/가격, URL, 검색어, 토큰, 원문 요청 본문은 기록하지 않는다.
그 외 페이로드는 거절하고 Firestore에 새 데이터를 쓰지 않는다.
교차 출처 및 비정상 요청 제한이 있지만 익명 클라이언트 이벤트이므로 제3자가 발생 건수를 조작할 가능성을 완전히 배제할 수 없다.
Vercel 인프라의 표준 요청 로그 처리는 별도다.

## 다음 단계

1. 최신 SHA의 Vercel 빌드와 `/changes`, `/api/coffee-funnel`이 포함된 배포를 확인한다.
2. 사용자가 허용한 브라우저에서 1회 실사용 시나리오를 실행해 이벤트가 실제 로그에 쌓이는지 확인한다.
3. 공식 Web Analytics에서 7일·30일 페이지뷰/이벤트의 시계열을 확인한다. Pro 기본 보고 기간은 12개월이다. 기존 Runtime Logs의 기본 보존 1일과 혼동하지 않는다. 실제 브라우저 화면 검증·도입 전 개인정보 고지·비용 사용량 확인은 별도 수행한다.
4. 고객을 확보한 후 방문자·결제 전환으로 확장하되, 실제 매출/재결제와 위 이벤트를 혼동하지 않는다.

SNS 연동 문제는 사용자 보류 상태로 유지하며, 기존 Telegram 서버 연동/Webhook/크롤러 로직은 변경하지 않는다.
