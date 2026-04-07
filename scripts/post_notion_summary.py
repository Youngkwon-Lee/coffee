#!/usr/bin/env python3
import json
import os
import urllib.request
from datetime import datetime
from pathlib import Path


def main() -> int:
    notion_token = os.getenv("NOTION_TOKEN", "").strip()
    notion_db_id = os.getenv("NOTION_DB_ID", "").strip()
    run_url = os.getenv("RUN_URL", "").strip()
    report_path = Path("reports/crawl_summary.json")

    if not notion_token or not notion_db_id or not report_path.exists():
        print("NOTION_TOKEN/NOTION_DB_ID/reports 파일이 없어 Notion 전송 스킵")
        return 0

    report = json.loads(report_path.read_text(encoding="utf-8"))
    total = report.get("total_beans", 0)
    cafes = report.get("cafe_breakdown", {})
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    today = datetime.now().strftime("%Y-%m-%d")
    workflow_status = os.getenv("WORKFLOW_STATUS", "success").lower()

    req = urllib.request.Request(
        f"https://api.notion.com/v1/databases/{notion_db_id}",
        headers={
            "Authorization": f"Bearer {notion_token}",
            "Notion-Version": "2022-06-28",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        db = json.loads(r.read().decode("utf-8"))

    title_prop = None
    for name, meta in db.get("properties", {}).items():
        if meta.get("type") == "title":
            title_prop = name
            break
    if not title_prop:
        raise RuntimeError("Notion DB에서 title property를 찾지 못했습니다")

    cafe_lines = [f"{k}:{v}" for k, v in cafes.items()]
    cafe_summary = ", ".join(cafe_lines) if cafe_lines else "no-data"

    # 표(데이터베이스 row) 중심으로 저장
    props = {
        title_prop: {"title": [{"text": {"content": f"Coffee Crawl {now}"}}]},
        "Date": {"date": {"start": today}},
        "Total": {"number": float(total)},
        "Run URL": {"url": run_url or None},
        "Notes": {"rich_text": [{"text": {"content": cafe_summary[:1800]}}]},
    }

    # Cafe 컬럼은 단일 카페 실행이면 해당 값, 아니면 all
    if len(cafes) == 1:
        one_cafe = next(iter(cafes.keys()))
        props["Cafe"] = {"select": {"name": one_cafe}}
    else:
        props["Cafe"] = {"select": {"name": "all"}}

    if workflow_status in {"success", "failure", "partial"}:
        props["Status"] = {"select": {"name": workflow_status}}
    else:
        props["Status"] = {"select": {"name": "success"}}

    payload = {
        "parent": {"database_id": notion_db_id},
        "properties": props,
    }

    req2 = urllib.request.Request(
        "https://api.notion.com/v1/pages",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {notion_token}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req2, timeout=20) as r:
        res = json.loads(r.read().decode("utf-8"))
        print("✅ Notion page created:", res.get("id"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
