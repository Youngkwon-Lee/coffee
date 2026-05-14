# Coffee Crawler Monitoring Execution Checklist

PRD 기준 문서: `docs/crawler-monitoring-prd-2026-05-14.md`

이 문서는 PRD를 실제 구현 순서로 쪼갠 실행 체크리스트다.
핵심 원칙은 다음 3가지다.
- top priority 카페부터 운영 품질을 확보한다.
- false negative 최소화를 우선한다.
- 기존 workflow를 유지한 채 얇은 모니터링 레이어를 추가한다.

---

## Phase 0. 운영 기준 잠금

### 목표
PRD의 운영 결정을 코드/설정에서 흔들리지 않게 고정한다.

### 체크리스트
- [ ] 카페 우선순위 체계 확정: `top_priority / normal / low`
- [ ] 현재 17개 활성 카페 각각에 priority 할당
- [ ] top priority 후보 목록 별도 정리
- [ ] “지속 실패 = 3회 연속 실패”를 운영 기본값으로 확정
- [ ] alert payload 필수 필드 확정
  - [ ] cafe name
  - [ ] failure timestamp
  - [ ] error type
  - [ ] last success timestamp
  - [ ] retry/consecutive failure count
  - [ ] run log or dashboard link
- [ ] freshness 해석 기준 확정
  - [ ] weekly crawler 기준 stale 판정 룰 초안
  - [ ] top priority 카페에 더 엄격한 stale 룰 적용 여부 결정
- [ ] failure taxonomy 이름 통일
  - [ ] environment/fetch
  - [ ] parsing/output
  - [ ] validation
  - [ ] apply
  - [ ] diff/change-detection

### 산출물
- priority 매핑 표
- health state 정의 초안
- alert schema 초안

---

## Phase 1. 상태 모델 정의

### 목표
Discord 알림, 대시보드, 주간 요약이 같은 상태 원천을 보도록 만든다.

### 체크리스트
- [ ] per-cafe health state 스키마 정의
- [ ] health state 필드 확정
  - [ ] cafe key
  - [ ] priority
  - [ ] current status
  - [ ] last success at
  - [ ] last failure at
  - [ ] consecutive failures
  - [ ] last error type
  - [ ] latest bean count
  - [ ] previous bean count
  - [ ] recent change detected 여부
  - [ ] freshness status
  - [ ] last run url / artifact url
- [ ] run 단위 summary state 정의
  - [ ] total cafes
  - [ ] healthy cafes
  - [ ] stale cafes
  - [ ] top priority failures
  - [ ] cafes with detected changes
- [ ] state 저장 위치 결정
  - [ ] reports json 기반
  - [ ] firestore/notion 별도 저장 필요 여부 검토
  - [ ] `/admin/crawl-monitor`와 재사용 가능한 형식 우선
- [ ] success 시 counter reset 규칙 정의
- [ ] validation 실패를 success로 보지 않도록 규칙 명시
- [ ] no-data / zero-brand 예외 케이스 규칙 정의

### 권장 산출물
- `monitoring_state.json` 형태의 예시 문서
- 상태 전이 다이어그램 또는 표

---

## Phase 2. 실패 분류기 도입

### 목표
실패를 “그냥 실패”가 아니라 운영 가능한 카테고리로 나눈다.

### 체크리스트
- [ ] workflow step 기준 failure source 매핑 정의
- [ ] python crawler 내부 예외를 운영 taxonomy로 normalize
- [ ] validation 실패 메시지를 별도 분류
- [ ] apply 실패 메시지를 별도 분류
- [ ] diff/change-detection 문제를 별도 이벤트로 남길지 결정
- [ ] fetch 실패와 parsing 실패를 최소한 구분 가능하게 구현
- [ ] Discord/대시보드/리포트 모두 동일 분류명을 쓰도록 통일

### 우선순위
1. fetch/environment
2. parsing/output
3. validation
4. apply
5. diff/change-detection

### 완료 기준
- 실패 1건 발생 시 운영자가 어느 단계 문제인지 바로 구분 가능

---

## Phase 3. 연속 실패 카운터와 alert gating 구현

### 목표
일회성 노이즈를 줄이면서 지속 실패만 확실히 잡는다.

### 체크리스트
- [ ] per-cafe consecutive failure counter 구현
- [ ] 성공 시 해당 카페 counter reset
- [ ] 일부 카페 실패가 전체 run 성공 상태에 묻히지 않도록 처리
- [ ] 3회 연속 실패 시 alert trigger
- [ ] 같은 연속 실패 구간에서 중복 alert 폭주 방지 규칙 정의
- [ ] recovery success 시 해제/회복 상태 기록 여부 결정
- [ ] specific cafe 수동 실행에서도 동일 counter 규칙 적용
- [ ] top priority 카페 alert는 normal/low와 분리 집계 가능하게 설계

### 테스트 시나리오
- [ ] 1회 실패 → no alert
- [ ] 2회 실패 → no alert
- [ ] 3회 연속 실패 → alert 1회
- [ ] 실패 후 성공 → counter reset
- [ ] success 후 재실패 → 새 시퀀스로 계산

---

## Phase 4. Discord alert payload 개선

### 목표
알림 한 번만 봐도 바로 대응할 수 있게 만든다.

### 체크리스트
- [ ] 현재 Discord webhook payload 구조 파악
- [ ] 예외 alert용 embed 템플릿 분리
- [ ] 필수 필드 6종 반영
- [ ] error type을 사람이 읽기 쉬운 문구로 변환
- [ ] run URL 포함
- [ ] `/admin/crawl-monitor` 링크 또는 대응 링크 포함
- [ ] last success와 current failure를 같이 노출
- [ ] top priority 카페 여부 표시
- [ ] stale 상태도 경고로 표현할지 결정
- [ ] 동일 run 내 다수 카페 실패 시 묶음 알림 규칙 정의

### 알림 문구 원칙
- 짧게
- 원인 분류 명확하게
- 조치 진입 링크 포함
- summary와 incident alert를 혼동하지 않게 분리

---

## Phase 5. 대시보드/리포트 health view 연결

### 목표
주간 요약과 수동 점검 화면이 동일한 health model을 읽게 한다.

### 체크리스트
- [ ] `/admin/crawl-monitor`에서 필요한 health 필드 표시
- [ ] top priority 섹션 추가
- [ ] stale cafes 섹션 추가
- [ ] consecutive failure 상위 카페 섹션 추가
- [ ] recent detected changes 섹션 추가
- [ ] last success 기준 정렬 옵션 검토
- [ ] failure type 기준 필터 검토
- [ ] summary report에 priority-aware 해석 추가

### 최소 표시 항목
- [ ] cafe name
- [ ] priority
- [ ] current status
- [ ] last success
- [ ] consecutive failures
- [ ] latest bean count
- [ ] recent change 여부

---

## Phase 6. KPI 계산 추가

### 목표
감에 의존하지 않고 운영 품질을 수치로 본다.

### 체크리스트
- [ ] recall proxy 정의
- [ ] consecutive failure rate 계산식 정의
- [ ] freshness metric 정의
- [ ] top priority subset KPI 분리
- [ ] 주간 리포트에 KPI 요약 포함
- [ ] threshold breach 시 warning 문구 추가

### 추천 KPI
- [ ] top priority cafes freshness pass rate
- [ ] top priority cafes consecutive-failure incidence
- [ ] detected change coverage proxy
- [ ] per-cafe last success age

### 주의
- recall은 당장 완전한 정답셋이 없을 수 있으므로 초반엔 proxy metric부터 둔다.

---

## Phase 7. false positive tuning 루프

### 목표
recall-first 전략은 유지하면서 반복 노이즈만 줄인다.

### 체크리스트
- [ ] 반복 오탐 카페 목록 누적
- [ ] 카페별 selector/파서 문제 기록
- [ ] diff threshold 조정 후보 정리
- [ ] skeleton/loading/placeholder 재발 케이스 패턴화
- [ ] 카페별 예외 규칙이 필요한지 판단
- [ ] 전역 완화보다 per-cafe tuning 우선 적용

### 운영 원칙
- 전체 기준을 느슨하게 만들지 말고 noisy cafe를 개별 보정한다.

---

## Phase 8. 테스트 보강

### 목표
정책이 코드로 깨지지 않게 최소 신뢰장치를 만든다.

### 체크리스트
- [ ] failure classification unit tests
- [ ] consecutive failure counter tests
- [ ] alert threshold tests
- [ ] alert payload builder tests
- [ ] freshness evaluator tests
- [ ] priority-aware summary tests
- [ ] stale-but-not-failed scenario tests
- [ ] validation failure isolation tests

### 좋은 테스트 기준
- 내부 구현보다 외부 행동 검증
- 카운터 증가/초기화 규칙 검증
- 알림 발생 조건 검증
- top priority 해석 차이 검증

---

## 추천 구현 순서

### 1차 묶음: 반드시 먼저
- [ ] Phase 0 운영 기준 잠금
- [ ] Phase 1 상태 모델 정의
- [ ] Phase 2 실패 분류기
- [ ] Phase 3 연속 실패 카운터

### 2차 묶음: 바로 체감되는 운영 개선
- [ ] Phase 4 Discord alert 개선
- [ ] Phase 5 dashboard/report 연결

### 3차 묶음: 품질 관리 고도화
- [ ] Phase 6 KPI 계산
- [ ] Phase 7 false positive tuning
- [ ] Phase 8 테스트 보강

---

## 제가 추천하는 첫 구현 스프린트 범위

이번 스프린트는 아래만 해도 충분히 가치가 크다.

- [ ] priority 설정 추가
- [ ] per-cafe monitoring state json 생성
- [ ] failure classification 추가
- [ ] consecutive failure counter 추가
- [ ] 3회 연속 실패 Discord alert 추가
- [ ] `/admin/crawl-monitor`에 top priority + stale + failures 노출

이렇게만 해도 “주간 요약은 있는데 운영은 감으로 하는 상태”에서 꽤 많이 벗어난다.
