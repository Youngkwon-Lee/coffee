#!/usr/bin/env python3
"""
프리미엄 판정 회귀 테스트.

과금 판정이라 조용히 틀리면 두 방향 모두 손해다:
  - 만료를 놓치면 결제를 멈춘 사람이 영구 프리미엄
  - 잘못 만료시키면 돈 낸 사람의 알림이 끊긴다

실행: python3 scripts/test_premium_resolve.py   (pytest 불필요)
"""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.send_favorite_alerts import resolve_premium  # noqa: E402

NOW = datetime.now(timezone.utc)
PAST = NOW - timedelta(days=3)
FUTURE = NOW + timedelta(days=30)


class FakeTimestamp:
    """Firestore Timestamp 흉내 — .timestamp()를 가진 객체."""

    def __init__(self, dt):
        self._dt = dt

    def timestamp(self):
        return self._dt.timestamp()


CASES = [
    # (설명, user_data, 기대값)
    ("무료 사용자", {}, False),
    ("plan=free", {"plan": "free"}, False),
    ("plan=premium, 만료일 없음(수동 부여)", {"plan": "premium"}, True),
    ("plan=premium, 만료일 미래(ISO)", {"plan": "premium", "premium_until": FUTURE.isoformat()}, True),
    ("plan=premium, 만료일 과거(ISO)", {"plan": "premium", "premium_until": PAST.isoformat()}, False),
    ("plan=premium, 만료일 미래(Timestamp)", {"plan": "premium", "premium_until": FakeTimestamp(FUTURE)}, True),
    ("plan=premium, 만료일 과거(Timestamp)", {"plan": "premium", "premium_until": FakeTimestamp(PAST)}, False),
    ("camelCase premiumUntil 과거", {"plan": "premium", "premiumUntil": PAST.isoformat()}, False),
    ("camelCase premiumUntil 미래", {"plan": "premium", "premiumUntil": FUTURE.isoformat()}, True),
    ("대소문자 PREMIUM", {"plan": "PREMIUM"}, True),
    ("Z 접미사 UTC 미래", {"plan": "premium", "premium_until": FUTURE.strftime("%Y-%m-%dT%H:%M:%SZ")}, True),
    ("타임존 없는 문자열 과거 → UTC로 해석", {"plan": "premium", "premium_until": PAST.strftime("%Y-%m-%dT%H:%M:%S")}, False),
    # 모호하면 무료로 떨어뜨린다
    ("만료일 깨진 문자열", {"plan": "premium", "premium_until": "언젠가"}, False),
    ("만료일 타입 미지원", {"plan": "premium", "premium_until": 12345}, False),
    ("빈 문자열은 만료일 없음으로 취급", {"plan": "premium", "premium_until": ""}, True),
]


def main() -> int:
    failures = []
    for desc, data, expected in CASES:
        got = resolve_premium(data, "test-uid")
        if got is not expected:
            failures.append(f"{desc}: 기대 {expected}, 결과 {got}")

    if failures:
        print(f"\n실패 {len(failures)}건 / 검사 {len(CASES)}건\n")
        for f in failures:
            print(f"  x {f}")
        return 1

    print(f"통과: 프리미엄 판정 {len(CASES)}건")
    return 0


if __name__ == "__main__":
    sys.exit(main())
