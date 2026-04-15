#!/usr/bin/env python3
import re
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
    cred = credentials.Certificate('firebase_credentials.json')
    try:
        firebase_admin.get_app()
    except Exception:
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    docs = list(db.collection('beans').stream())

    fixed = 0
    dead = 0
    unchanged = 0

    for d in docs:
        data = d.to_dict() or {}
        raw = str(data.get('link') or data.get('url') or data.get('product_url') or '')
        norm = normalize(raw)

        status, code = check_url(norm) if norm else ('dead', None)

        updates = {
            'link': norm if status == 'ok' else '',
            'linkStatus': status,
        }

        if raw == updates['link'] and data.get('linkStatus') == status:
            unchanged += 1
            continue

        db.collection('beans').document(d.id).set(updates, merge=True)
        if status == 'dead':
            dead += 1
        else:
            fixed += 1

    print({'total': len(docs), 'fixed': fixed, 'dead': dead, 'unchanged': unchanged})


if __name__ == '__main__':
    main()
