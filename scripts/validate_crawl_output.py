#!/usr/bin/env python3
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

try:
    import yaml
except ImportError:  # 설정을 못 읽으면 기존 검사만 수행한다
    yaml = None

PLACEHOLDER_TOKENS = ('placeholder', 'example.com', 'placehold.co', 'via.placeholder.com')
CONFIG_PATH = Path(__file__).resolve().parent.parent / 'config' / 'crawler_config.yaml'


def expected_brands():
    """설정에서 active=true인 카페의 label 목록.

    산출물에 등장한 브랜드만 검사하면, 한 카페가 통째로 실패해 0건이 되었을 때
    그 브랜드는 집계에 아예 나타나지 않아 검증을 그냥 통과한다. 기대 목록과
    대조해야 '수집이 멈춘 것'을 잡아낼 수 있다.
    """
    if yaml is None or not CONFIG_PATH.exists():
        return None
    try:
        cfg = yaml.safe_load(CONFIG_PATH.read_text(encoding='utf-8')) or {}
    except Exception:
        return None
    cafes = cfg.get('cafes') or {}
    return {
        str(c.get('label') or cafe_id).strip()
        for cafe_id, c in cafes.items()
        if c.get('active')
    }


def main():
    if len(sys.argv) < 2:
        print('Usage: python scripts/validate_crawl_output.py <crawl-json> [--allow-zero brand1,brand2]')
        return 1

    path = Path(sys.argv[1])
    allow_zero = set()
    if len(sys.argv) >= 4 and sys.argv[2] == '--allow-zero':
        allow_zero = {x.strip() for x in sys.argv[3].split(',') if x.strip()}

    if not path.exists():
        print(f'❌ output not found: {path}')
        return 1

    rows = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(rows, list):
        print('❌ crawl output is not a list')
        return 1

    by_brand = Counter()
    issues = defaultdict(list)
    total = len(rows)

    for idx, row in enumerate(rows):
        brand = str(row.get('brand') or '').strip() or 'unknown'
        name = str(row.get('name') or '').strip()
        link = str(row.get('link') or row.get('url') or row.get('product_url') or '').strip()
        by_brand[brand] += 1

        if not name:
            issues[brand].append(f'row#{idx}: missing name')
        if not link:
            issues[brand].append(f'{name or f"row#{idx}"}: empty link')
        if any(tok in link.lower() for tok in PLACEHOLDER_TOKENS):
            issues[brand].append(f'{name or f"row#{idx}"}: placeholder link {link}')
        if row.get('isSample'):
            issues[brand].append(f'{name or f"row#{idx}"}: sample row present')

    zero_brands = sorted([brand for brand in allow_zero if by_brand.get(brand, 0) == 0])

    # 설정상 활성인데 산출물에 한 건도 없는 브랜드 = 수집이 멈춘 것.
    expected = expected_brands()
    missing = sorted(
        b for b in (expected or set())
        if by_brand.get(b, 0) == 0 and b not in allow_zero
    )

    bad = {brand: msgs for brand, msgs in issues.items() if msgs}
    summary = {
        'total_rows': total,
        'brands': dict(sorted(by_brand.items())),
        'issue_brand_count': len(bad),
        'allowed_zero_brands': zero_brands,
        'expected_brands': sorted(expected) if expected else None,
        'missing_brands': missing,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if missing:
        print('\n❌ 수집 결과가 0건인 활성 카페:')
        for brand in missing:
            print(f'  - {brand}')
        print('  크롤러가 조용히 실패했을 가능성이 높다. 의도된 중단이면 --allow-zero로 넘긴다.')
        return 1

    if expected is None:
        print('\n⚠️  crawler_config.yaml을 읽지 못해 누락 검사를 건너뛴다(PyYAML 미설치 또는 파일 없음).')

    if bad:
        print('\n❌ validation issues:')
        for brand, msgs in sorted(bad.items()):
            print(f'- {brand}: {len(msgs)} issue(s)')
            for msg in msgs[:10]:
                print(f'  - {msg}')
        return 1

    print('\n✅ validation passed')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
