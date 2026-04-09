#!/usr/bin/env python3
import json
import os
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

NOTION_VERSION = "2022-06-28"


def notion_request(token: str, url: str, method: str = "GET", payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
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
        # cup-note fields
        "Aroma": {"rich_text": {}},
        "Flavor": {"multi_select": {"options": []}},
        "Acidity": {"number": {"format": "number"}},
        "Body": {"number": {"format": "number"}},
        "Sweetness": {"number": {"format": "number"}},
        "Aftertaste": {"rich_text": {}},
        "Overall": {"number": {"format": "number"}},
        "Roast Level": {"select": {"options": [
            {"name": "Light", "color": "yellow"},
            {"name": "Medium", "color": "orange"},
            {"name": "Dark", "color": "brown"}
        ]}},
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


def parse_flavor_multi(bean: Dict[str, Any]) -> List[Dict[str, str]]:
    text = " ".join(
        [
            str(bean.get("flavor") or ""),
            str(bean.get("flavor_notes") or ""),
            str(bean.get("tasting_notes") or ""),
            str(bean.get("description") or ""),
            str(bean.get("name") or ""),
        ]
    ).lower()

    # 가격/단위 노이즈 제거
    text = text.replace("<br>", " ").replace("|", " ")

    keyword_map = {
        "berry": ["베리", "블루베리", "딸기", "라즈베리"],
        "citrus": ["시트러스", "레몬", "오렌지", "자몽", "유자"],
        "stone fruit": ["복숭아", "살구", "자두"],
        "tropical": ["망고", "파인애플", "열대"],
        "floral": ["플로럴", "꽃", "자스민", "화사"],
        "chocolate": ["초콜릿", "카카오"],
        "caramel": ["카라멜", "토피", "당밀"],
        "nutty": ["견과", "너티", "아몬드", "헤이즐넛", "캐슈넛"],
        "sweet": ["단맛", "달콤", "꿀", "설탕"],
        "tea-like": ["티라이크", "홍차", "차"],
        "spice": ["스파이스", "시나몬", "향신료"],
    }

    hits: List[str] = []
    for label, words in keyword_map.items():
        if any(w in text for w in words):
            hits.append(label)

    # 기존 flavor 필드가 list면 우선 포함 (짧은 태그만)
    raw = bean.get("flavor")
    if isinstance(raw, list):
        for r in raw:
            s = str(r).strip()
            if s and len(s) <= 20:
                hits.append(s.lower())

    uniq: List[str] = []
    seen = set()
    for h in hits:
        k = h.strip().lower()
        if not k or k in seen:
            continue
        seen.add(k)
        uniq.append(h[:100])

    return [{"name": u} for u in uniq[:6]]


def score_from_notes(bean: Dict[str, Any]) -> Dict[str, float]:
    text = str(bean.get("flavor_notes") or bean.get("tasting_notes") or bean.get("description") or "").lower()

    def has_any(words: List[str]) -> bool:
        return any(w in text for w in words)

    acidity = 3.0
    body = 3.0
    sweetness = 3.0

    if has_any(["산미", "acidity", "시트러스", "레몬", "자몽", "베리", "꽃", "화사"]):
        acidity += 1.0
    if has_any(["부드", "밸런스", "은은"]):
        acidity -= 0.5

    if has_any(["바디", "묵직", "진한", "묵직한", "heavy", "full"]):
        body += 1.0
    if has_any(["티라이크", "깔끔", "라이트", "light"]):
        body -= 0.5

    if has_any(["단맛", "sweet", "꿀", "카라멜", "초콜릿", "과일", "복숭아", "자두"]):
        sweetness += 1.0
    if has_any(["드라이", "쌉쌀", "bitter"]):
        sweetness -= 0.5

    acidity = max(1.0, min(5.0, acidity))
    body = max(1.0, min(5.0, body))
    sweetness = max(1.0, min(5.0, sweetness))
    overall = round((acidity + body + sweetness) / 3.0, 1)

    return {
        "Acidity": round(acidity, 1),
        "Body": round(body, 1),
        "Sweetness": round(sweetness, 1),
        "Overall": overall,
    }


def guess_roast_level(bean: Dict[str, Any]) -> Optional[str]:
    roast = str(bean.get("roast") or "").lower()
    if "light" in roast or "라이트" in roast:
        return "Light"
    if "dark" in roast or "다크" in roast:
        return "Dark"
    if roast:
        return "Medium"
    return None


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
    price_prop_type = db.get("properties", {}).get("Price", {}).get("type")

    # 무료 플랜/속도 고려: 상위 20개만 업서트
    for bean in beans[:20]:
        image_url = bean.get("image") or bean.get("imageUrl") or bean.get("img") or bean.get("thumbnail")
        flavor_multi = parse_flavor_multi(bean)
        roast_level = guess_roast_level(bean)
        note_text = (bean.get("flavor_notes") or bean.get("tasting_notes") or "")
        scores = score_from_notes(bean)
        bean_props: Dict[str, Any] = {
            title_prop: {"title": [{"text": {"content": f"Bean {bean.get('name', 'unknown')[:80]}"}}]},
            "Type": {"select": {"name": "bean"}},
            "Date": {"date": {"start": today}},
            "Cafe": {"select": {"name": str(bean.get("brand") or "all")[:100]}},
            "Status": {"select": {"name": "success"}},
            "Bean Name": rt(bean.get("name", "")),
            "Origin": rt(bean.get("origin") or bean.get("region") or ""),
            "Process": rt(bean.get("process") or bean.get("processing") or ""),
            "Product URL": {"url": (bean.get("link") or bean.get("url") or bean.get("product_url") or None)},
            "Notes": rt(note_text[:800]),
            "Aroma": rt(note_text),
            "Aftertaste": rt(note_text),
            "Acidity": {"number": scores["Acidity"]},
            "Body": {"number": scores["Body"]},
            "Sweetness": {"number": scores["Sweetness"]},
            "Overall": {"number": scores["Overall"]},
        }

        raw_price = bean.get("price")
        if price_prop_type == "number":
            try:
                bean_props["Price"] = {"number": float(raw_price) if raw_price is not None and str(raw_price).strip() != "" else None}
            except Exception:
                bean_props["Price"] = {"number": None}
        else:
            bean_props["Price"] = rt(raw_price if raw_price is not None else "")

        if flavor_multi:
            bean_props["Flavor"] = {"multi_select": flavor_multi}
        if roast_level:
            bean_props["Roast Level"] = {"select": {"name": roast_level}}
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
