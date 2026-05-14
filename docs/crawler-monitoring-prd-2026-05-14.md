# Coffee Crawler Monitoring & Alerting PRD

## Problem Statement

현재 coffee crawler는 주간 자동 실행과 기본 요약 리포트는 갖추고 있지만, 운영자가 정말 빠르게 대응해야 하는 신호를 우선순위 기반으로 해석하고 처리하는 정책이 아직 명확히 문서화되어 있지 않다.

특히 top priority 카페에서 크롤링 실패나 변화 감지 누락이 발생하면 데이터 신뢰도와 운영 효율이 같이 떨어진다. 반대로 너무 민감한 즉시 알림은 피로도를 높인다. 따라서 실제 운영에 맞는 실패 처리, 알림 기준, 정확도 목표, 운영 지표를 하나의 정책으로 정리할 필요가 있다.

## Solution

크롤러 운영을 priority-aware 모니터링 체계로 정리한다.

핵심 방향은 다음과 같다.
- 카페를 우선순위 등급으로 관리한다.
- top priority 카페 중심으로 운영 SLA를 정의한다.
- 실패는 자동 재시도로 흡수하되, 3회 연속 실패 시에만 Discord 알림을 보낸다.
- 알림은 대응에 필요한 정보(카페명, 실패 시각, 에러 종류, 최근 성공 시각, 재시도 횟수, 로그/대시보드 링크)를 한 번에 제공한다.
- 초기 정확도 정책은 false positive 일부를 감수하더라도 false negative 최소화에 둔다.
- 운영 KPI는 변화 감지 recall, 연속 실패율, freshness 중심으로 관리한다.

## User Stories

1. As an operator, I want cafes to be grouped by priority, so that I can spend attention where misses hurt most.
2. As an operator, I want top priority cafes to have stricter monitoring expectations, so that critical inventory changes are less likely to be missed.
3. As an operator, I want transient crawler errors to retry automatically, so that temporary failures do not create unnecessary manual work.
4. As an operator, I want Discord alerts only after 3 consecutive failures, so that I am interrupted only when a problem is likely persistent.
5. As an operator, I want each alert to include the cafe name, so that I know exactly which source is affected.
6. As an operator, I want each alert to include the failure timestamp, so that I can judge recency and correlate with deploys or site changes.
7. As an operator, I want each alert to include the error type, so that I can triage whether the issue is fetch, parse, validation, or apply related.
8. As an operator, I want each alert to include the most recent successful crawl time, so that I can estimate how stale the data has become.
9. As an operator, I want each alert to include retry count, so that I can distinguish one-off noise from persistent failure.
10. As an operator, I want each alert to include a direct log or dashboard link, so that I can jump straight into diagnosis.
11. As an operator, I want the system to optimize for missing fewer real changes, so that important bean updates are not silently lost.
12. As an operator, I want false positives to be tolerated within reason during early rollout, so that recall can be improved before precision tuning.
13. As an operator, I want failures to be classified by stage, so that fixes can be prioritized correctly.
14. As an operator, I want fetch failures to be treated as the first reliability priority, so that downstream parsing and diff logic have usable input.
15. As an operator, I want parsing issues to be visible separately from site access failures, so that selector maintenance work is easier to target.
16. As an operator, I want diff-detection quality to be measured, so that I can improve change interpretation after baseline crawl stability is achieved.
17. As an operator, I want freshness metrics for critical cafes, so that I can tell when supposedly healthy automation is actually stale.
18. As an operator, I want weekly reports and exception alerts to fit together, so that the scheduled summary and urgent signals are not disconnected.
19. As an operator, I want the monitoring policy to align with the existing dry-run → validate → apply workflow, so that alerts reflect the actual pipeline stages.
20. As an operator, I want repeated noisy cafes to be tuned after rollout, so that alert quality improves without weakening recall goals.
21. As a future maintainer, I want the operating policy written down clearly, so that the system can be changed without re-deciding the basics each time.
22. As a future maintainer, I want dashboard and Discord messaging rules to be consistent, so that incident context is not split across tools.

## Implementation Decisions

- Introduce explicit cafe priority tiers: `top_priority`, `normal`, `low`.
- First operating target is top priority cafes; broader optimization for normal/low cafes can follow after baseline stability is confirmed.
- Keep the existing pipeline shape (`dry-run crawl -> validate -> Firestore apply -> Notion/Discord report`) and add monitoring semantics on top rather than redesigning the workflow.
- Use automatic retry as the first response to failures.
- Define persistent failure for alerting as `3 consecutive failures` for a given cafe/run target.
- Prefer alerting on persistent failure rather than first failure to avoid noisy operational interruptions.
- Alert payload must include:
  - cafe name
  - failure timestamp
  - error category/type
  - last successful crawl timestamp
  - retry count / consecutive failure count
  - direct link to run log, artifact, or monitoring dashboard
- Failure taxonomy should be explicit and aligned with the current ops checklist:
  - fetch/environment failure
  - crawl output generation/parsing failure
  - validation failure
  - Firestore apply failure
  - diff/change-detection failure
- Reliability improvement order should be:
  1. fetch/access stability
  2. parsing correctness
  3. diff/change-detection refinement
- Monitoring policy should optimize for lower false negatives on top priority cafes, even if that temporarily allows more false positives.
- Repeated false positives should be handled through per-cafe rule tuning, parser fixes, or threshold calibration instead of relaxing the overall recall-first goal too early.
- Introduce or expose per-cafe health state sufficient to compute:
  - last success
  - consecutive failure count
  - current status
  - last known item count / recent change evidence
- Freshness should be treated as a first-class health dimension, not just success/failure. A cafe can be “green” on workflow status but still operationally stale if no recent successful data was produced.
- Weekly summary reporting should continue, but exception alerts should focus on conditions that need action rather than reproducing the whole report.
- Dashboard/summary views should surface at least:
  - total monitored cafes
  - top priority cafe health
  - stale cafes
  - consecutive failure leaders
  - recent detected changes
- Alert thresholds and health interpretation should be derived from per-cafe state, not only total bean counts, because aggregate totals can hide single-cafe failures.

## Testing Decisions

- Good tests should verify observable behavior and incident semantics, not internal implementation details.
- Tests should focus on whether the system classifies failures correctly, increments/reset counters correctly, emits alerts at the right threshold, and prefers recall-first handling for important cafes.
- Modules to test:
  - failure classification logic
  - consecutive failure counter / reset behavior after success
  - alert payload builder
  - priority-aware health evaluation
  - freshness status evaluation
  - report/dashboard summarization logic for top priority cafes
- Prior art should be taken from existing crawler validation and workflow safety patterns already used in the repo, especially the validation gate that prevents bad crawl output from applying to Firestore.
- Test scenarios should include:
  - transient single failure with no alert
  - 3 consecutive failures causing one alert
  - success after failures resetting the counter
  - validation failure separated from fetch failure
  - stale-but-not-failed cafe health state
  - false-positive-prone cafe remaining visible without blocking recall-first policy

## Out of Scope

- Full redesign of the crawler architecture
- Replacing GitHub Actions with another orchestration platform
- Building a full incident management system beyond Discord/Notion/reporting needs
- Precision-maximizing heuristics for every cafe before rollout
- Product-facing UI changes unrelated to crawler operations
- Automatic remediation beyond retries and operational alerting

## Further Notes

- This PRD intentionally reflects an operations-first stance: the main goal is to avoid silently missing important changes in top priority cafes.
- Existing artifacts such as `reports/crawl_summary.json`, workflow run URLs, and the `/admin/crawl-monitor` page should be reused wherever possible instead of adding a parallel reporting surface.
- The best first implementation is likely a thin monitoring layer that records per-cafe health state and feeds both Discord alerts and dashboard summaries from the same source of truth.
