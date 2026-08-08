#!/usr/bin/env python3
"""
프로덕션에 실제로 적용된 Firestore 규칙을 다시 받아 확인한다.

배포 로그가 성공이어도 활성 ruleset이 바뀌지 않는 경우가 있다(권한 부족,
잘못된 프로젝트, 캐시된 릴리스). 규칙은 결제 우회를 막는 유일한 방어선이라
"배포했다"는 로그만 믿지 않고 내려받아 대조한다.

필요: GOOGLE_APPLICATION_CREDENTIALS(서비스 계정 JSON 경로), PyJWT, cryptography
실행: python3 scripts/verify_firestore_rules.py
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

# 활성 규칙에 반드시 있어야 하는 것 / 절대 있으면 안 되는 것
MUST_CONTAIN = {
    "과금 필드 잠금 함수(billingFields)": "billingFields()",
    "premium_requests 규칙": "premium_requests",
}
MUST_NOT_CONTAIN = {
    # 이 한 줄이 있으면 사용자가 자기 문서에 plan='premium'을 쓸 수 있다.
    "users 루트 무제한 write": "allow read, write: if isOwner(userId);",
}


def access_token(sa: dict) -> str:
    import jwt  # PyJWT

    now = int(time.time())
    assertion = jwt.encode(
        {
            "iss": sa["client_email"],
            "scope": "https://www.googleapis.com/auth/firebase",
            "aud": "https://oauth2.googleapis.com/token",
            "iat": now,
            "exp": now + 3600,
        },
        sa["private_key"],
        algorithm="RS256",
    )
    body = urllib.parse.urlencode(
        {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": assertion,
        }
    ).encode()
    res = json.loads(urllib.request.urlopen("https://oauth2.googleapis.com/token", body).read())
    return res["access_token"]


def get(url: str, token: str) -> dict:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())


def main() -> int:
    path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not path or not os.path.exists(path):
        print("GOOGLE_APPLICATION_CREDENTIALS 가 없습니다.", file=sys.stderr)
        return 1

    with open(path, encoding="utf-8") as f:
        sa = json.load(f)
    project = sa["project_id"]
    token = access_token(sa)

    release = get(
        f"https://firebaserules.googleapis.com/v1/projects/{project}/releases/cloud.firestore",
        token,
    )
    ruleset_name = release["rulesetName"]
    print(f"프로젝트: {project}")
    print(f"활성 ruleset: {ruleset_name}")

    ruleset = get(f"https://firebaserules.googleapis.com/v1/{ruleset_name}", token)
    src = "\n".join(f["content"] for f in ruleset["source"]["files"])

    failures = []
    for label, needle in MUST_CONTAIN.items():
        ok = needle in src
        print(f"  {'OK  ' if ok else 'FAIL'}  {label}")
        if not ok:
            failures.append(label)
    for label, needle in MUST_NOT_CONTAIN.items():
        ok = needle not in src
        print(f"  {'OK  ' if ok else 'FAIL'}  {label} 없음")
        if not ok:
            failures.append(f"{label}이 그대로 남아 있음")

    if failures:
        print("\n::error::배포된 규칙이 기대와 다릅니다: " + ", ".join(failures))
        return 1

    print("\n활성 규칙 확인 완료 — 과금 필드가 클라이언트로부터 잠겨 있습니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
