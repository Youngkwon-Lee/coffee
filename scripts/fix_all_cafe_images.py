#!/usr/bin/env python3
import re
import requests
from urllib.parse import urljoin

import firebase_admin
from firebase_admin import credentials, firestore

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
BAD_KW = ["logo", "icon", "favicon", "progress", "loading", "btn_back", "sprite", "dummy", ".gif", "via.placeholder", "placehold.co"]


def abs_url(base: str, src: str) -> str:
    if not src:
        return ""
    if src.startswith("//"):
        return "https:" + src
    return urljoin(base, src)


def is_bad(url: str) -> bool:
    u = (url or "").lower()
    return any(k in u for k in BAD_KW)


def is_photo_like(url: str) -> bool:
    if not url or is_bad(url):
        return False
    try:
        r = requests.head(url, timeout=10, allow_redirects=True, headers={"User-Agent": UA})
        ctype = (r.headers.get("content-type") or "").lower()
        clen = int(r.headers.get("content-length") or 0)
        if "image/" not in ctype:
            return False
        if "gif" in ctype:
            return False
        if 0 < clen < 15000:
            return False
        return True
    except Exception:
        return False


def pick_from_website(url: str) -> str:
    try:
        r = requests.get(url, timeout=15, headers={"User-Agent": UA})
        if r.status_code != 200:
            return ""
        html = r.text

        # meta first
        for pat in [
            r'<meta[^>]+property=["\']og:image(?:[:\w-]*)?["\'][^>]+content=["\']([^"\']+)',
            r'<meta[^>]+name=["\']twitter:image(?:[:\w-]*)?["\'][^>]+content=["\']([^"\']+)',
        ]:
            m = re.search(pat, html, re.I)
            if m:
                cand = abs_url(url, m.group(1).strip())
                if is_photo_like(cand):
                    return cand

        # img fallback
        imgs = re.findall(r'<img[^>]+(?:src|data-src)=["\']([^"\']+)', html, re.I)
        scored = []
        for src in imgs:
            cand = abs_url(url, src)
            if not is_photo_like(cand):
                continue
            txt = cand.lower()
            score = 0
            if any(k in txt for k in ["store", "interior", "main", "visual", "about", "shop", "cafe"]):
                score += 3
            if any(k in txt for k in ["banner", "hero"]):
                score += 1
            scored.append((score, cand))
        if scored:
            scored.sort(key=lambda x: x[0], reverse=True)
            return scored[0][1]
    except Exception:
        return ""
    return ""


def main():
    cred = credentials.Certificate("firebase_credentials.json")
    try:
        firebase_admin.get_app()
    except Exception:
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    docs = list(db.collection("cafes").stream())

    fixed = 0
    cleared = 0
    skipped = 0

    for d in docs:
        data = d.to_dict() or {}
        img = str(data.get("imageUrl") or data.get("image") or "").strip()
        website = str(data.get("website") or data.get("url") or "").strip()

        needs_fix = (not img) or is_bad(img)
        if not needs_fix:
            # also treat absolute URL 404 case quickly
            if img.startswith("http"):
                try:
                    rr = requests.head(img, timeout=8, allow_redirects=True, headers={"User-Agent": UA})
                    if rr.status_code != 200:
                        needs_fix = True
                except Exception:
                    needs_fix = True
            elif img.startswith("/"):
                needs_fix = True

        if not needs_fix:
            skipped += 1
            continue

        new_img = ""
        if website.startswith("http"):
            new_img = pick_from_website(website)

        if new_img:
            db.collection("cafes").document(d.id).set({"imageUrl": new_img, "imageSource": "website-fix"}, merge=True)
            fixed += 1
            print(f"FIXED {d.id} -> {new_img}")
        else:
            db.collection("cafes").document(d.id).set({"imageUrl": "", "imageSource": ""}, merge=True)
            cleared += 1
            print(f"CLEARED {d.id}")

    print({"fixed": fixed, "cleared": cleared, "skipped": skipped, "total": len(docs)})


if __name__ == "__main__":
    main()
