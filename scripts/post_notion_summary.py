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

    cafe_lines = [f"{k}: {v}개" for k, v in list(cafes.items())[:20]] or ["수집 데이터 없음"]

    children = [
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {"rich_text": [{"type": "text", "text": {"content": f"☕ 주간 크롤링 결과 ({now})"}}]},
        },
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {"rich_text": [{"type": "text", "text": {"content": f"총 수집 원두: {total}개"}}]},
        },
    ]
    for line in cafe_lines:
        children.append(
            {
                "object": "block",
                "type": "bulleted_list_item",
                "bulleted_list_item": {"rich_text": [{"type": "text", "text": {"content": line}}]},
            }
        )
    if run_url:
        children.append(
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {"rich_text": [{"type": "text", "text": {"content": f"GitHub Actions: {run_url}"}}]},
            }
        )

    payload = {
        "parent": {"database_id": notion_db_id},
        "properties": {title_prop: {"title": [{"text": {"content": f"Coffee Crawl {now}"}}]}},
        "children": children,
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
