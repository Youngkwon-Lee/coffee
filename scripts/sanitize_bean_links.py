#!/usr/bin/env python3
import os
import re
from collections import Counter
import requests
import firebase_admin
from firebase_admin import credentials, firestore

UA = 'Mozilla/5.0'
TIMEOUT = 12


def normalize(url: str) -> str:
    if not url:
        return ''
    return str(url).replace('\\u0026', '&').rstrip('\\').strip()


def check_url(url: str):
    if not url.startswith('http'):
        return 'invalid', None
    try:
        r = requests.get(url, timeout=TIMEOUT, allow_redirects=True, headers={'User-Agent': UA})
        if r.status_code >= 400:
            return 'dead', r.status_code
        return 'ok', r.status_code
    except Exception:
        return 'dead', None


def main():
    try:
        firebase_admin.get_app()
    except Exception:
        cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', 'firebase_credentials.json')
        if os.path.exists(cred_path):
            firebase_admin.initialize_app(credentials.Certificate(cred_path))
        else:
            firebase_admin.initialize_app()

    db = firestore.client()
    docs = list(db.collection('beans').stream())

    fixed = 0
    dead = 0
    unchanged = 0
    dead_by_brand = Counter()
    dead_examples = []

    for d in docs:
        data = d.to_dict() or {}
        raw = str(data.get('link') or data.get('url') or data.get('product_url') or '')
        norm = normalize(raw)
        brand = str(data.get('brand') or 'unknown').strip() or 'unknown'
        name = str(data.get('name') or '').strip()

        status, code = check_url(norm) if norm else ('dead', None)

        updates = {
            'linkStatus': status,
        }
        if norm:
            updates['link'] = norm
        if raw and raw != norm:
            updates['rawLink'] = raw

        next_link = updates.get('link', raw)
        if raw == next_link and data.get('linkStatus') == status and (not raw or data.get('rawLink') == updates.get('rawLink')):
            unchanged += 1
            continue

        db.collection('beans').document(d.id).set(updates, merge=True)
        if status == 'dead':
            dead += 1
            dead_by_brand[brand] += 1
            if len(dead_examples) < 20:
                dead_examples.append({
                    'id': d.id,
                    'brand': brand,
                    'name': name,
                    'raw': raw,
                    'normalized': norm,
                    'code': code,
                })
        else:
            fixed += 1

    print({
        'total': len(docs),
        'fixed': fixed,
        'dead': dead,
        'unchanged': unchanged,
        'dead_by_brand_top10': dead_by_brand.most_common(10),
        'dead_examples': dead_examples,
    })


if __name__ == '__main__':
    main()
