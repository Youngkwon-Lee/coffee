# 원두레이더 유료 파일럿 운영 절차

이 문서는 운영 방법이다. 작성·로컬 검증 자체가 운영 DB 쓰기, 사용자 연락, 입금 요청, 룰 배포 또는 판매 개시를 승인하거나 실행하지 않는다.

## 준비 상태와 경계

- 상품: 2,900 KRW / 30일, 자동 결제 없음. 시작은 활성화 시각, 연장은 유효한 잔여 기간에 이어 붙인다.
- 대상 프로젝트: `coffee-37b81`. 운영 CLI는 이 프로젝트를 명시하고 다른 서비스 계정/환경 프로젝트를 거부한다. Node 24를 사용한다. Node 25의 기존 SDK import 문제를 회피한다.
- `premium_config/pilot`은 공개 문서이며 `salesEnabled` boolean만 저장한다. 계좌·토큰·연락처·개인정보를 넣지 않는다. 누락/false는 준비 미확인이다. 앱에서 config 읽기가 실패해도 무료 연결 기능은 유지된다.
- `salesEnabled`는 **신규 접수만 일시중단하는 플래그가 아니라 판매 운영 준비 상태**다. false이면 새 신청과 새 입금 활성화 모두 막힌다. 이미 활성화된 기간과 알림은 바꾸지 않는다.
- 기존 awaiting_payment 상태에서 판매 운영을 중단하면 미결 입금 여부를 먼저 대조한다. 이미 입금한 사용자는 연락·환불 등 정해진 운영 절차로 처리하거나, 운영 준비가 회복되고 별도 승인이 있을 때 다시 활성화한다. false를 우회하여 권한을 수동으로 만들어 결제 기록을 누락하지 않는다.
- 은행 계좌/판매자/문의/취소·환불 조건/응답 시간은 운영자가 실제 조건을 정한다. 이 저장소는 값을 발명하지 않는다.
- 설정 존재, Bot getMe 응답, 올바른 webhook URL과 오류 없음은 실제 수신 증거가 아니다. 별도 허가된 테스트 계정으로 연결→변화 이벤트→DM 수신을 확인해야 한다.
- 판매 전 필수: 정규 main 크롤 → 검증 → 운영 데이터 반영 → 허가된 테스트 DM의 실제 성공을 확인하고, 계획된 일일 실행이 이어지는지 관측한다. 2026-10-02 읽기 조사에서 최신 자동 run(2026-09-23)은 실패했으며 이후 정규 성공은 확인되지 않았다. 최근 dry-run 성공을 일일 운영/실제 DM 성공으로 간주하지 않는다. 일정 변경이나 실제 발송은 이 구현 작업에서 수행하지 않는다.
- 현재 수집 이벤트는 후속 validation 전 기록된다. 공개 문구는 '판매페이지에서 다시 확인'이며 실시간 재입고를 보장하지 않는다. 판매 전 대상 데이터 품질을 대조해야 한다. 이 범위에서 크롤러/스케줄은 변경하지 않는다.

## 신청과 입금 확인

CLI는 기본 dry-run이다. 다음 명령은 설명 예시이며 이 작업에서 운영 실행하지 않는다. 이미 설정된 자격 증명을 사용하며 파일에 키를 복사하거나 출력하지 않는다.

```sh
node scripts/grant-premium.mjs --help
node scripts/grant-premium.mjs --requests
node scripts/grant-premium.mjs --list
```

`--list`는 권한 목록이다. 매출·결제 고객 집계가 아니다. `--requests` 출력은 개인정보를 포함할 수 있으므로 공개 로그에 게시하지 않는다.

1. 신청의 uid/requestId와 텔레그램 연결, 상품 조건을 확인한다. 운영자가 실제 제공할 결제 안내와 조건을 준비한다.
2. 아래 동작을 dry-run으로 검토한 뒤 승인된 운영 시에만 `--apply`를 붙여 awaiting_payment로 전환한다. CLI는 메시지를 보내지 않는다. 실제 결제 안내 발송은 별도 승인된 채널에서 수행한다.

```sh
node scripts/grant-premium.mjs --uid UID --request-id REQUEST_UUID --status awaiting_payment
```

3. 은행 거래 내역에서 실제 입금액을 확인한다. 고유한 거래 식별값을 고정해서 기록한다. 계좌 별칭과 은행 거래 ID처럼 같은 거래에 항상 같은 값을 사용한다. 이메일/계좌번호/토큰을 식별값으로 쓰지 않는다. 이 도구는 은행에 접근하지 않으며, 입력한 확인 내용을 사실로 검증해 주지 않는다.

```sh
node scripts/grant-premium.mjs --uid UID --request-id REQUEST_UUID \
  --payment-reference 'account-alias:transaction-id' --amount 2900 \
  --confirmed-at '2026-10-02T09:00:00+09:00'
```

4. 결과 만료일과 대상 사용자를 검토한 후, 승인된 운영 시에만 같은 명령에 `--apply`를 붙인다. payment 원장, 사용자 권한, 신청 상태 activated가 한 transaction으로 반영된다. 같은 식별값 반복은 연장하지 않고 duplicate를 반환한다. 다른 uid/requestId에서 이미 사용한 식별값은 거부한다. 미래 확인 시각·금액 불일치·닫힌 신청은 거부한다.
5. 사용자 화면에서 이용 기한이 일치하는지 확인한다. 입금 reference를 새 값으로 바꿔 같은 거래를 다시 처리하지 않는다.

종료된 신청 다음에는 화면에서 새 requestId로 갱신 신청한다. 새 실제 입금 거래를 확인해 같은 절차를 거친다. 기존 `--months`는 지원하지 않는다.

```sh
node scripts/grant-premium.mjs --uid UID --request-id REQUEST_UUID --status declined
node scripts/grant-premium.mjs --uid UID --request-id REQUEST_UUID --status cancelled
node scripts/grant-premium.mjs --uid UID --revoke
```

위 동작도 기본 dry-run이다. `--revoke --apply`는 권한만 해지하고 입금 원장을 보존한다. 환불을 실행하거나 환불 완료를 기록하는 기능이 아니다. 환불 여부와 금액은 실제 은행 기록 및 별도 운영 장부에서 대조한다.

기존 만료 없는 수동 권한은 UI와 sender에서 계속 수동 권한으로 취급한다. 새 유료 활성화는 이를 조용히 덮어쓰지 않고 오류를 낸다. 기간과 사유를 운영자가 확인한 후 처리한다.

## 발송과 사고 처리

- `scripts/send_favorite_alerts.py --dry-run`은 DB 읽기만 하며 계획 건수만 출력한다. 실제 발송·원장 쓰기를 하지 않는다. 계획 건수는 이미 보낸 이벤트를 포함할 수 있으므로 신규 발송 수로 세지 않는다.
- 이벤트당 메시지 1개를 보내므로 긴 묶음의 뒷부분을 누락하고 전부 발송 완료로 기록하지 않는다. 같은 chat은 호출 간 1.1초를 둔다. 429 응답 후 해당 chat의 잔여 메시지는 그 실행에서 보내지 않고 retryable 실패로 남긴다.
- 원장 키는 `sha256(JSON([uid,eventId]))`다. 동일 ID의 전송 성공 이후 재실행은 건너뛴다. 발송 원장은 보존해야 한다. 삭제하면 재실행 중복 방지가 사라진다.
- `sending`은 120초 claim을 가진다. 동시에 두 실행이 같은 이벤트를 획득하지 못한다. claim이 만료된 항목을 다시 만나면 unknown으로 바꾸고 보내지 않는다.
- `sent`: Telegram `ok=true`와 message ID를 확인했다. 네트워크 응답 자체가 사람이 읽었다는 증거는 아니다.
- `failed`: 확정적인 4xx 거절. 429만 지연 후 자동 재시도하며 최대 3번 획득한다. 400/403은 운영 확인 대상이다. retryable 원장의 이벤트는 25시간 최근 조회창 밖에서도 재시도 후보에 포함한다. 사용자의 현재 플랜/즐겨찾기/연결 상태를 다시 적용한다.
- `unknown`: timeout, 응답 파싱 문제, 예상 밖 응답, 만료 claim 등. 실제 도착했을 수 있으므로 자동 재전송하지 않는다. 전송 뒤 원장 저장에 실패하면 sending으로 남을 수 있다. 최근 조회창을 벗어난 sending 항목도 운영자가 확인해야 한다.
- unknown/오래된 sending은 해당 Telegram 대화의 실제 수신 여부를 사람이 확인한다. 확인되면 증거와 message ID를 보존해 서버 권한으로 sent 정리한다. 전달되지 않았다는 증거 없이 failed로 바꿔 재전송하지 않는다. 확인 불가능한 건은 unknown으로 유지하고 서비스 누락 가능성을 사용자 운영 절차에 따라 처리한다.
- 개별 발송 실패/unknown 또는 원장 오류는 스크립트 종료코드 1이다. 기존 workflow에 `continue-on-error`가 있으므로 **workflow 초록색만으로 발송 성공을 판정하지 않는다**. 발송 summary와 원장을 확인한다. workflow 수정은 이 범위 밖이다.
- event ID를 새로 생성한 동일 내용까지 자동 중복 판정하지 않는다. source 이벤트 정확성과 안정성은 별도 검증 대상이다.

## 로컬 검증 (운영 쓰기 없음)

```sh
npm exec --yes --package=node@24 -- node --test scripts/__tests__/premium-lifecycle.test.mjs
python scripts/test_premium_resolve.py
python scripts/test_favorite_delivery.py
```

Rules 테스트는 `demo-coffee-rules`, localhost:8080 emulator 전용이다. 기존 `firebase.json`의 hosting.source 때문에 CLI15는 firestore만 실행해도 webframeworks 실험 플래그를 요구할 수 있다. `test:rules`는 프로세스에만 `FIREBASE_CLI_EXPERIMENTS=webframeworks`를 지정한다. 전역 experiments 설정은 바꾸지 않는다. 또는 저장소 외부 scratch에 다음 최소 config를 만든다(`rules`는 이 worktree의 절대 경로).

```json
{"firestore":{"rules":"/ABS/WORKTREE/firestore.rules"},"emulators":{"firestore":{"host":"127.0.0.1","port":8080},"ui":{"enabled":false}}}
```

Java21/Firebase CLI/Node24가 있는 검증 환경에서:

```sh
firebase emulators:exec --only firestore --project demo-coffee-rules --config /ABS/SCRATCH/firebase-test.json 'node scripts/__tests__/firestore-rules.test.mjs'
```

이미 이 테스트를 위해 시작한 emulator가 실행 중이면 새 인스턴스를 만들지 않고 테스트 스크립트만 실행한다. 실제 Admin SDK transaction은 `scripts/lib/premium.mjs`를 demo emulator에 연결한 fixture에서 검증한다. 운영 CLI는 emulator를 거부하므로 helper를 직접 호출한다. UI 상태는 `app/settings/alerts/AlertSettingsView.tsx`의 순수 props로 렌더하며 테스트용 운영 라우트나 auth 우회를 추가하지 않는다.
