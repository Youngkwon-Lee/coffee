# Coffee Crawler Monitoring Implementation Design

기준 문서:
- `docs/crawler-monitoring-prd-2026-05-14.md`
- `docs/crawler-monitoring-execution-checklist-2026-05-14.md`

이 문서는 실제 구현을 위한 파일 단위 설계안이다.
핵심 목표는 **기존 dry-run -> validate -> apply -> report 흐름은 유지하고**, 그 위에 **per-cafe health state + alert gating + dashboard health view**를 얹는 것이다.

---

## 1. 현재 구조 요약

현재 확인된 주요 접점은 아래와 같다.

### 실행/배치
- `.github/workflows/coffee_crawler.yml`
- `scripts/run_crawler.py`
- `scripts/validate_crawl_output.py`
- `scripts/post_notion_summary.py`
- `scripts/reset_all_active_cafes_from_crawl.mjs`
- `scripts/reset_single_brand_from_crawl.mjs`

### 설정
- `config/crawler_config.yaml`

### 운영 UI
- `app/admin/crawl-monitor/page.tsx`
- `app/admin/crawl-monitor/CrawlMonitorClient.tsx`

### 현재 상태의 한계
- 카페 priority 개념이 없음
- run summary는 있지만 per-cafe monitoring state가 없음
- Discord 알림은 run-level summary 중심이며 persistent failure gating이 없음
- `/admin/crawl-monitor`는 Firestore beans 집계 중심이라 health/freshness/failure를 직접 보여주지 못함
- validation은 blocking gate 역할은 하지만, monitoring state로 구조화되지는 않음

---

## 2. 구현 원칙

1. **새 source of truth를 하나 만든다**
   - per-cafe health state JSON을 생성해서
   - Discord alert / dashboard / 주간 summary가 이를 공통으로 읽게 한다.

2. **기존 데이터 흐름을 깨지 않는다**
   - crawler 결과 JSON, validation, Firestore apply 구조는 유지한다.

3. **첫 스프린트는 얇게 만든다**
   - DB schema 변경이나 대규모 백엔드 추가 없이
   - `reports/` 기반 상태 파일 생성으로 시작한다.

4. **top priority에 최적화한다**
   - 전체 최적화보다 top priority 카페의 misses/staleness를 먼저 잡는다.

---

## 3. 제안 아키텍처

### 새로 추가할 상태 파일
권장 추가 산출물:
- `reports/crawl_summary.json` (기존 유지)
- `reports/crawl_monitor_state.json` (신규)
- `reports/crawl_alert_candidates.json` (선택, 디버깅용)

### 핵심 흐름
1. `run_crawler.py`가 카페별 실행 결과/오류를 구조화해서 남긴다.
2. validation 결과를 구조화한다.
3. 새 monitoring state builder가 카페별 health state를 계산한다.
4. workflow 마지막에 Discord 알림은 monitoring state를 기준으로 발송한다.
5. `/admin/crawl-monitor`는 Firestore beans + GitHub runs + monitoring state를 함께 표시한다.

---

## 4. 파일별 변경 설계

## A. `config/crawler_config.yaml`

### 변경 목적
priority와 freshness 정책의 가장 얕은 설정 진입점을 만든다.

### 추가 제안
각 cafe에 아래 필드 추가:
- `priority: top_priority | normal | low`
- `freshness_days: <int>` 또는 상위 공통값 + 예외 override

예시 개념:
```yaml
cafes:
  centercoffee:
    label: "센터커피"
    priority: top_priority
    freshness_days: 8
```

### 이유
- 카페별 중요도와 freshness 판단을 코드 하드코딩 대신 설정에서 관리 가능
- 이후 특정 카페만 더 엄격하게 운용하기 쉬움

---

## B. `scripts/run_crawler.py`

### 변경 목적
카페별 실행 결과를 “원두 리스트”만이 아니라 “운영 상태 이벤트”로도 남긴다.

### 현재 상태
- 카페별 crawl 성공 시 results 반환
- 실패 시 `None` 반환
- 전체적으로는 `all_results`만 저장
- 실패 원인/소요시간/카페별 상태가 구조화되어 남지 않음

### 변경 제안
`run_crawler()`가 내부적으로 아래 구조를 함께 만들도록 변경:
- `success: bool`
- `cafe_id`
- `cafe_label`
- `priority`
- `bean_count`
- `started_at`
- `finished_at`
- `elapsed_seconds`
- `error_type`
- `error_message`
- `output_path`

권장 방식:
- 기존 `results` 반환 인터페이스는 크게 깨지 않되
- 별도 `run_meta` 리스트를 main()에서 누적
- 마지막에 `reports/current_run_meta.json` 또는 output과 함께 저장

### 추가 함수 제안
- `classify_exception(exc, context) -> error_type`
- `build_cafe_run_meta(...) -> dict`

### 주의
- 첫 단계에서는 crawler 내부 예외를 완벽하게 분류하려 하지 말고
  - import/setup
  - fetch/crawl
  - unknown
  정도부터 시작해도 충분함

---

## C. `scripts/validate_crawl_output.py`

### 변경 목적
validation을 단순 pass/fail 출력에서 구조화된 monitoring input으로 확장한다.

### 현재 상태
- stdout summary 출력
- validation issue가 있으면 exit 1
- brand별 이슈는 콘솔용 텍스트에 머뭄

### 변경 제안
옵션 추가:
- `--report <path>`: validation summary JSON 저장

권장 JSON 구조:
```json
{
  "ok": false,
  "total_rows": 123,
  "brands": {"센터커피": 12},
  "issue_brand_count": 2,
  "issues_by_brand": {
    "센터커피": ["empty link"]
  },
  "issue_types": {
    "empty_link": 3,
    "placeholder_link": 1,
    "sample_row": 0,
    "missing_name": 0
  }
}
```

### 이유
- monitoring state builder가 stdout 파싱 없이 바로 사용 가능
- validation failure를 error taxonomy의 한 축으로 정식 반영 가능

---

## D. 신규 스크립트: `scripts/build_crawl_monitor_state.py`

### 변경 목적
이번 설계의 핵심. per-cafe health state를 계산하는 얇은 집계 레이어.

### 입력
- `config/crawler_config.yaml`
- `reports/current_run_meta.json` 또는 유사 파일
- `reports/validation_report.json`
- `reports/crawl_summary.json`
- 직전 `reports/crawl_monitor_state.json` (있다면)
- 환경변수의 run URL

### 출력
- `reports/crawl_monitor_state.json`
- 선택: `reports/crawl_alert_candidates.json`

### health state 예시
```json
{
  "generated_at": "2026-05-14T08:00:00+09:00",
  "run_url": "...",
  "totals": {
    "cafes": 17,
    "healthy": 13,
    "stale": 2,
    "failing": 2,
    "top_priority_failing": 1
  },
  "cafes": [
    {
      "cafe_id": "centercoffee",
      "label": "센터커피",
      "priority": "top_priority",
      "status": "healthy",
      "freshness_status": "fresh",
      "last_success_at": "...",
      "last_failure_at": null,
      "consecutive_failures": 0,
      "last_error_type": null,
      "latest_bean_count": 12,
      "previous_bean_count": 10,
      "recent_change_detected": true,
      "run_url": "...",
      "dashboard_path": "/admin/crawl-monitor"
    }
  ]
}
```

### 주요 계산 규칙
- success면 consecutive failure reset
- fail이면 직전 state에서 +1
- 3회 연속 실패 && 이전 state에서 아직 alert_notified가 false면 alert candidate 생성
- freshness는 `last_success_at` 기준으로 계산
- validation 실패는 전체 run 실패로만 두지 말고 관련 브랜드 상태에 반영 가능한 범위까지만 반영

### 보조 필드 추천
- `alert_eligible: bool`
- `alert_notified_at: string | null`
- `status_reason: string`

### 이유
- Discord, dashboard, weekly summary가 같은 상태를 읽게 만드는 가장 작은 단위

---

## E. `.github/workflows/coffee_crawler.yml`

### 변경 목적
monitoring state 생성을 workflow의 정식 단계로 넣고, Discord 알림이 이 상태를 기준으로 동작하게 한다.

### 권장 단계 순서
1. crawl
2. validation
3. apply
4. summary generation
5. validation report generation 또는 validation report file 저장
6. build monitoring state
7. notion summary
8. upload artifacts
9. discord summary + incident alert

### 구체 변경 포인트
- validation step에서 `--report reports/validation_report.json` 사용
- crawl step 또는 별도 step에서 카페별 run meta 저장
- build state step 추가
- Discord notification step이 `reports/crawl_monitor_state.json`을 읽도록 변경

### Discord 알림 분리 추천
하나의 step 안에서 두 종류를 만들 것:
- weekly/run summary embed
- incident alert embed (3회 연속 실패 대상만)

### 이유
지금 summary embed는 총계 중심이라 single-cafe failure를 놓칠 수 있다.

---

## F. `scripts/post_notion_summary.py`

### 변경 목적
Notion summary도 priority-aware health를 조금 반영할 수 있게 준비한다.

### 1차 범위
당장 대규모 수정은 불필요.

권장 최소 변경:
- `reports/crawl_monitor_state.json`가 있으면
  - top priority failing count
  - stale cafe count
  - consecutive failure leader 1~3개
  를 Notes 또는 summary 텍스트에 추가

### 이유
Notion은 1차 incident 대응 도구는 아니지만, 주간 운영 리뷰에는 유용하다.

---

## G. `app/admin/crawl-monitor/CrawlMonitorClient.tsx`

### 변경 목적
현재 Firestore beans 중심 뷰를 운영 health 대시보드로 확장한다.

### 현재 상태
- 전체 원두 수
- 최근 업데이트
- GitHub workflow runs
- 브랜드별 최신 상태(실상 bean docs 집계)
- 원두 상세 목록

### 추가 제안 섹션
1. **Monitoring Overview 카드**
   - total cafes
   - healthy
   - stale
   - failing
   - top priority failing

2. **Top Priority Health 섹션**
   - priority가 top_priority인 카페만 표시
   - status / last success / consecutive failures / latest bean count 표시

3. **Stale Cafes 섹션**
   - freshness_status != fresh

4. **Failure Watchlist 섹션**
   - consecutive_failures desc 정렬
   - error_type / last_failure_at 표시

5. **Recent Changes 섹션**
   - recent_change_detected true

### 데이터 소스 제안
가장 단순한 1차 방식:
- public하게 읽을 수 있는 `reports/crawl_monitor_state.json`를 API route나 static fetch로 읽기

권장 구현 경로:
- `app/api/admin/crawl-monitor-state/route.ts` 추가
- 서버에서 로컬 report 파일 읽어서 JSON 반환
- 클라이언트에서 해당 API fetch

### 이유
- 브라우저가 repo 파일을 직접 읽을 수는 없으니 API route가 가장 단순함
- 기존 Firestore 기반 데이터와 병행 가능

---

## H. 신규 API route: `app/api/admin/crawl-monitor-state/route.ts`

### 역할
- `reports/crawl_monitor_state.json`를 읽어 JSON으로 반환
- 파일 없으면 graceful fallback

### 응답 형태
```json
{
  "ok": true,
  "state": { ... }
}
```
또는
```json
{
  "ok": false,
  "error": "monitor state not found"
}
```

### 이유
UI와 로컬 파일을 느슨하게 연결하는 가장 작은 서버 계층

---

## 5. 1차 스프린트 실제 작업 묶음

### Workstream 1 — 설정/상태 기반 만들기
- `config/crawler_config.yaml`에 priority 추가
- `scripts/run_crawler.py`에 카페별 run meta 저장
- `scripts/validate_crawl_output.py`에 JSON report 저장 기능 추가
- `scripts/build_crawl_monitor_state.py` 신규 작성

### Workstream 2 — workflow 통합
- `.github/workflows/coffee_crawler.yml`에 monitoring state step 추가
- Discord notification step이 monitoring state 기반 incident alert 생성하도록 수정

### Workstream 3 — dashboard 노출
- `app/api/admin/crawl-monitor-state/route.ts` 추가
- `app/admin/crawl-monitor/CrawlMonitorClient.tsx`에 monitoring overview/top priority/stale/failure watch 섹션 추가

---

## 6. 권장 에러 taxonomy v1

처음엔 아래 5개면 충분하다.

- `environment_error`
- `fetch_error`
- `parsing_error`
- `validation_error`
- `apply_error`
- `unknown_error`

### 분류 규칙 단순 버전
- workflow setup/install/firebase 단계 실패 → `environment_error`
- crawler 실행 중 request/selectors/html fetch 관련 실패 → `fetch_error` 또는 `parsing_error`
- validation script exit 1 → `validation_error`
- Firestore apply step 실패 → `apply_error`
- 나머지 → `unknown_error`

---

## 7. 권장 status model v1

카페 상태는 아래 4개로 시작하는 걸 추천한다.

- `healthy`
- `warning`
- `failing`
- `stale`

### 계산 예시
- latest run success + freshness ok → `healthy`
- latest run success but count anomaly/manual review needed → `warning`
- latest run fail or validation fail → `failing`
- failure는 아니지만 last_success_at이 freshness threshold 초과 → `stale`

실제로는 `status`와 `freshness_status`를 분리 보유하는 게 좋다.

---

## 8. 테스트 포인트

### `scripts/validate_crawl_output.py`
- issue types JSON이 기대대로 생성되는지
- clean input이면 ok=true인지

### `scripts/build_crawl_monitor_state.py`
- success 후 counter reset
- fail 후 counter increment
- 3회 연속 실패 시 alert_eligible=true
- stale 판정 정상 동작
- top priority count 집계 정상

### dashboard
- monitor state API 응답이 없을 때 graceful fallback
- top priority/failing/stale 섹션 렌더링 확인

---

## 9. 제가 추천하는 바로 다음 구현 순서

1. `crawler_config.yaml`에 priority 필드 추가
2. `validate_crawl_output.py`에 `--report` 추가
3. `run_crawler.py`에 per-cafe run meta 저장 추가
4. `build_crawl_monitor_state.py` 신규 작성
5. workflow에 state build step 연결
6. Discord incident alert gating 연결
7. `crawl-monitor-state` API route 추가
8. admin dashboard에 health 섹션 추가

이 순서가 좋은 이유:
- 앞 4개가 data foundation
- 그 다음 workflow/alert가 운영 체감 개선
- 마지막 UI는 이미 만들어진 상태를 보여주기만 하면 됨

---

## 10. 구현 메모

- 첫 버전은 완벽한 diff/change detection까지 욕심내지 말고, `latest_bean_count`와 `previous_bean_count` 비교 기반의 단순 recent_change heuristic으로 시작하는 게 낫다.
- incident alert와 weekly summary는 분리된 embed로 보내는 편이 운영 피로도가 낮다.
- `reports/` 기반 파일은 GitHub Actions artifact 업로드와도 잘 맞아서 디버깅이 쉽다.
- `/admin/crawl-monitor`는 기존 Firestore bean view를 버리지 말고, 상단에 “운영 health layer”를 얹는 식으로 확장하는 게 가장 안전하다.
