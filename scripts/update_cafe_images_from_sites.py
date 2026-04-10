#!/usr/bin/env python3
"""
카페 대표 이미지 보강 스크립트
- crawler_config.yaml의 cafes[url]를 순회
- 홈페이지에서 og:image/twitter:image 우선 추출
- 없으면 hero/매장 관련 img를 fallback으로 선택
- Firestore cafes 컬렉션 imageUrl 갱신
"""

import os
import re
import sys
import json
import logging
from urllib.parse import urljoin
from typing import Dict, Any, List, Optional

import requests
from bs4 import BeautifulSoup

# 프로젝트 루트 경로 주입
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, PROJECT_ROOT)

from coffee_crawler.storage.firebase_client import FirebaseClient  # noqa: E402
from coffee_crawler.utils.config_loader import load_crawler_config  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("update_cafe_images")

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9가-힣]", "", (s or "").lower())


def is_bad_image(url: str) -> bool:
    u = (url or "").lower()
    bad = ["logo", "icon", "favicon", "sprite", "thumb", "dummyimage", "placeholder", "bean", "product"]
    return any(x in u for x in bad)


def abs_url(base: str, src: str) -> str:
    if not src:
        return ""
    if src.startswith("//"):
        return "https:" + src
    return urljoin(base, src)


def pick_site_image(url: str) -> Optional[str]:
    try:
        res = requests.get(url, timeout=15, headers={"User-Agent": UA})
        if res.status_code != 200:
            return None

        soup = BeautifulSoup(res.text, "html.parser")

        # 1) og/twitter 메타 우선
        meta_keys = [
            ("property", "og:image"),
            ("property", "og:image:url"),
            ("name", "twitter:image"),
            ("name", "twitter:image:src"),
        ]
        for key, val in meta_keys:
            tag = soup.find("meta", attrs={key: val})
            src = (tag.get("content") if tag else "") or ""
            full = abs_url(url, src)
            if full and not is_bad_image(full):
                return full

        # 2) 후보 img 중 관련성 스코어로 선택
        candidates: List[tuple[int, str]] = []
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or img.get("data-lazy") or ""
            full = abs_url(url, src)
            if not full or is_bad_image(full):
                continue

            alt = (img.get("alt") or "").lower()
            cls = " ".join(img.get("class", [])).lower()
            txt = f"{full} {alt} {cls}"

            score = 0
            if any(k in txt for k in ["store", "shop", "interior", "cafe", "coffee", "매장", "카페", "외관", "내부"]):
                score += 3
            if any(k in txt for k in ["hero", "main", "visual", "banner"]):
                score += 2
            if re.search(r"\.(jpg|jpeg|png|webp)$", full):
                score += 1

            candidates.append((score, full))

        if candidates:
            candidates.sort(key=lambda x: x[0], reverse=True)
            return candidates[0][1]

        return None
    except Exception:
        return None


def find_cafe_doc_id(cafe_key: str, label: str, docs: List[Dict[str, Any]]) -> Optional[str]:
    key_n = norm(cafe_key)
    label_n = norm(label)

    best_id = None
    best_score = -1

    for d in docs:
        doc_id = d["id"]
        name = str(d.get("name") or "")
        id_n = norm(doc_id)
        name_n = norm(name)

        score = 0
        if key_n and (key_n in id_n or id_n in key_n):
            score += 5
        if label_n and (label_n in name_n or name_n in label_n):
            score += 4
        if key_n and (key_n in name_n or name_n in key_n):
            score += 3

        if score > best_score:
            best_score = score
            best_id = doc_id

    return best_id if best_score > 0 else None


def main() -> int:
    cfg = load_crawler_config()
    cafes = cfg.get("cafes", {})

    fb = FirebaseClient()
    if not fb.is_available():
      logger.error("Firebase unavailable")
      return 1

    cafe_docs = [
        {"id": d.id, **(d.to_dict() or {})}
        for d in fb.db.collection("cafes").stream()
    ]

    updated = 0
    checked = 0
    skipped = 0
    errors = 0

    for cafe_key, c in cafes.items():
        if not c.get("active", True):
            continue

        url = str(c.get("url") or "").strip()
        label = str(c.get("label") or cafe_key)
        if not url.startswith("http"):
            skipped += 1
            continue

        checked += 1
        img = pick_site_image(url)
        if not img:
            logger.warning(f"no image: {cafe_key} ({url})")
            continue

        doc_id = find_cafe_doc_id(cafe_key, label, cafe_docs)
        if not doc_id:
            logger.warning(f"no matching cafe doc: {cafe_key} / {label}")
            continue

        try:
            fb.db.collection("cafes").document(doc_id).set(
                {
                    "imageUrl": img,
                    "imageSource": "site-crawl",
                },
                merge=True,
            )
            updated += 1
            logger.info(f"updated {doc_id} <- {img}")
        except Exception as e:
            errors += 1
            logger.error(f"update failed {doc_id}: {e}")

    summary = {
        "checked": checked,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
    }
    logger.info("SUMMARY %s", json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
