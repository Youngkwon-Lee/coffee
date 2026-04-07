#!/usr/bin/env python3
import json
import os
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

NOTION_VERSION = "2022-06-28"


def notion_request(token: str, url: str, method: str = "GET", payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    data = None
    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
    }
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def ensure_db_schema(token: str, db_id: str) -> Dict[str, Any]:
    db = notion_request(token, f"https://api.notion.com/v1/databases/{db_id}")
    props = db.get("properties", {})

    expected = {
        "Date": {"date": {}},
        "Cafe": {"select": {"options": [{"name": "all", "color": "default"}]}},
        "Total": {"number": {"format": "number"}},
        "Status": {
            "select": {
                "options": [
                    {"name": "success", "color": "green"},
                    {"name": "failure", "color": "red"},
                    {"name": "partial", "color": "yellow"},
                ]
            }
        },
        "Run URL": {"url": {}},
        "Notes": {"rich_text": {}},
        # bean-level fields
        "Type": {"select": {"options": [{"name": "summary", "color": "blue"}, {"name": "bean", "color": "purple"}]}},
        "Bean Name": {"rich_text": {}},
        "Price": {"rich_text": {}},
        "Origin": {"rich_text": {}},
        "Process": {"rich_text": {}},
        "Product URL": {"url": {}},
        "Image": {"files": {}},
    }

    missing = {k: v for k, v in expected.items() if k not in props}
    if missing:
        notion_request(
            token,
            f"https://api.notion.com/v1/databases/{db_id}",
            method="PATCH",
            payload={"properties": missing},
        )
        db = notion_request(token, f"https://api.notion.com/v1/databases/{db_id}")

    return db


def load_beans_from_data_dir() -> List[Dict[str, Any]]:
    beans: List[Dict[str, Any]] = []
    data_dir = Path("data")
    if not data_dir.exists():
        return beans

    for p in sorted(data_dir.glob("beans*.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        beans.append(item)
        except Exception:
            continue
    return beans


def rt(text: Any) -> Dict[str, Any]:
    s = "" if text is None else str(text)
    return {"rich_text": [{"text": {"content": s[:1800]}}]}


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

    db = ensure_db_schema(notion_token, notion_db_id)
    title_prop = next((n for n, m in db.get("properties", {}).items() if m.get("type") == "title"), None)
    if not title_prop:
        raise RuntimeError("Notion DB에서 title property를 찾지 못했습니다")

    cafe_lines = [f"{k}:{v}" for k, v in cafes.items()]
    cafe_summary = ", ".join(cafe_lines) if cafe_lines else "no-data"

    summary_props: Dict[str, Any] = {
        title_prop: {"title": [{"text": {"content": f"Coffee Crawl {now}"}}]},
        "Type": {"select": {"name": "summary"}},
        "Date": {"date": {"start": today}},
        "Total": {"number": float(total)},
        "Run URL": {"url": run_url or None},
        "Notes": rt(cafe_summary),
        "Cafe": {"select": {"name": next(iter(cafes.keys())) if len(cafes) == 1 else "all"}},
        "Status": {"select": {"name": workflow_status if workflow_status in {"success", "failure", "partial"} else "success"}},
    }

    res = notion_request(
        notion_token,
        "https://api.notion.com/v1/pages",
        method="POST",
        payload={"parent": {"database_id": notion_db_id}, "properties": summary_props},
    )
    print("✅ Notion summary row created:", res.get("id"))

    beans = load_beans_from_data_dir()
    # 무료 플랜/속도 고려: 상위 20개만 업서트
    for bean in beans[:20]:
        image_url = bean.get("image") or bean.get("imageUrl") or bean.get("img") or bean.get("thumbnail")
        bean_props: Dict[str, Any] = {
            title_prop: {"title": [{"text": {"content": f"Bean {bean.get('name', 'unknown')[:80]}"}}]},
            "Type": {"select": {"name": "bean"}},
            "Date": {"date": {"start": today}},
            "Cafe": {"select": {"name": str(bean.get("brand") or "all")[:100]}},
            "Status": {"select": {"name": "success"}},
            "Bean Name": rt(bean.get("name", "")),
            "Price": rt(bean.get("price", "")),
            "Origin": rt(bean.get("origin") or bean.get("region") or ""),
            "Process": rt(bean.get("process") or bean.get("processing") or ""),
            "Product URL": {"url": (bean.get("link") or bean.get("url") or bean.get("product_url") or None)},
            "Notes": rt((bean.get("flavor_notes") or bean.get("tasting_notes") or "")[:800]),
        }
        if image_url:
            bean_props["Image"] = {
                "files": [
                    {"name": "bean-image", "type": "external", "external": {"url": str(image_url)}}
                ]
            }

        notion_request(
            notion_token,
            "https://api.notion.com/v1/pages",
            method="POST",
            payload={"parent": {"database_id": notion_db_id}, "properties": bean_props},
        )

    print(f"✅ Notion bean rows created: {min(len(beans), 20)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
