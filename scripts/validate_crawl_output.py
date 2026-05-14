#!/usr/bin/env python3
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

PLACEHOLDER_TOKENS = ('placeholder', 'example.com', 'placehold.co', 'via.placeholder.com')


def main():
    if len(sys.argv) < 2:
        print('Usage: python scripts/validate_crawl_output.py <crawl-json> [--allow-zero brand1,brand2] [--report report.json]')
        return 1

    path = Path(sys.argv[1])
    allow_zero = set()
    report_path = None
    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == '--allow-zero' and i + 1 < len(sys.argv):
            allow_zero = {x.strip() for x in sys.argv[i + 1].split(',') if x.strip()}
            i += 2
            continue
        if arg == '--report' and i + 1 < len(sys.argv):
            report_path = Path(sys.argv[i + 1])
            i += 2
            continue
        i += 1

    if not path.exists():
        print(f'❌ output not found: {path}')
        return 1

    rows = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(rows, list):
        print('❌ crawl output is not a list')
        return 1

    by_brand = Counter()
    issues = defaultdict(list)
    issue_types = Counter()
    total = len(rows)

    for idx, row in enumerate(rows):
        brand = str(row.get('brand') or '').strip() or 'unknown'
        name = str(row.get('name') or '').strip()
        link = str(row.get('link') or row.get('url') or row.get('product_url') or '').strip()
        by_brand[brand] += 1

        if not name:
            issues[brand].append(f'row#{idx}: missing name')
            issue_types['missing_name'] += 1
        if not link:
            issues[brand].append(f'{name or f"row#{idx}"}: empty link')
            issue_types['empty_link'] += 1
        if any(tok in link.lower() for tok in PLACEHOLDER_TOKENS):
            issues[brand].append(f'{name or f"row#{idx}"}: placeholder link {link}')
            issue_types['placeholder_link'] += 1
        if row.get('isSample'):
            issues[brand].append(f'{name or f"row#{idx}"}: sample row present')
            issue_types['sample_row'] += 1

    zero_brands = sorted([brand for brand in allow_zero if by_brand.get(brand, 0) == 0])
    blocking_zero = [brand for brand, count in by_brand.items() if count == 0 and brand not in allow_zero]
    # by_brand won't include absent brands; caller should pass allowed zeros only for exceptional known brands

    bad = {brand: msgs for brand, msgs in issues.items() if msgs}
    summary = {
        'ok': False,
        'total_rows': total,
        'brands': dict(sorted(by_brand.items())),
        'issue_brand_count': len(bad),
        'allowed_zero_brands': zero_brands,
        'issues_by_brand': {brand: msgs for brand, msgs in sorted(bad.items())},
        'issue_types': dict(sorted(issue_types.items())),
    }

    if bad:
        if report_path:
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        print('\n❌ validation issues:')
        for brand, msgs in sorted(bad.items()):
            print(f'- {brand}: {len(msgs)} issue(s)')
            for msg in msgs[:10]:
                print(f'  - {msg}')
        return 1

    summary['ok'] = True
    if report_path:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print('\n✅ validation passed')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
