#!/usr/bin/env python3
import json
import os
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

import yaml

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_STATE_PATH = ROOT / 'reports' / 'crawl_monitor_state.json'
DEFAULT_RUN_META_PATH = ROOT / 'reports' / 'current_run_meta.json'
DEFAULT_VALIDATION_PATH = ROOT / 'reports' / 'validation_report.json'
DEFAULT_SUMMARY_PATH = ROOT / 'reports' / 'crawl_summary.json'

SEOUL_TZ = timezone(timedelta(hours=9))


def load_json(path: Path, default: Any):
    if not path.exists():
        return deepcopy(default)
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return deepcopy(default)


def load_config() -> Dict[str, Any]:
    config_path = ROOT / 'config' / 'crawler_config.yaml'
    return yaml.safe_load(config_path.read_text(encoding='utf-8')) or {}


def parse_dt(value: Any):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return None
    return None


def iso_now() -> str:
    return datetime.now(SEOUL_TZ).isoformat()


def compute_freshness_status(last_success_at: str, freshness_days: int) -> str:
    dt = parse_dt(last_success_at)
    if not dt:
        return 'unknown'
    now = datetime.now(dt.tzinfo or SEOUL_TZ)
    return 'stale' if now - dt > timedelta(days=freshness_days) else 'fresh'


def main():
    config = load_config()
    monitoring = config.get('monitoring', {})
    cafes_cfg = config.get('cafes', {})

    state_path = Path(os.environ.get('CRAWL_MONITOR_STATE_PATH', DEFAULT_STATE_PATH))
    run_meta_path = Path(os.environ.get('CRAWL_RUN_META_PATH', DEFAULT_RUN_META_PATH))
    validation_path = Path(os.environ.get('CRAWL_VALIDATION_REPORT_PATH', DEFAULT_VALIDATION_PATH))
    summary_path = Path(os.environ.get('CRAWL_SUMMARY_PATH', DEFAULT_SUMMARY_PATH))

    prev_state = load_json(state_path, {})
    prev_cafes = {row.get('cafe_id'): row for row in prev_state.get('cafes', []) if row.get('cafe_id')}
    run_meta = load_json(run_meta_path, {'cafes': []})
    validation = load_json(validation_path, {})
    summary = load_json(summary_path, {})

    threshold = int(monitoring.get('consecutive_failure_alert_threshold', 3) or 3)
    default_priority = monitoring.get('default_priority', 'normal')
    default_freshness_days = int(monitoring.get('default_freshness_days', 8) or 8)
    run_url = os.environ.get('RUN_URL', '').strip()

    cafe_counts = summary.get('cafe_breakdown', {}) if isinstance(summary.get('cafe_breakdown'), dict) else {}
    validation_issues_by_brand = validation.get('issues_by_brand', {}) if isinstance(validation.get('issues_by_brand'), dict) else {}

    cafes: List[Dict[str, Any]] = []
    alert_candidates: List[Dict[str, Any]] = []

    run_meta_by_id = {row.get('cafe_id'): row for row in run_meta.get('cafes', []) if row.get('cafe_id')}

    for cafe_id, cafe_cfg in cafes_cfg.items():
        if not cafe_cfg.get('active', False):
            continue

        prev = prev_cafes.get(cafe_id, {})
        meta = run_meta_by_id.get(cafe_id, {})
        label = cafe_cfg.get('label', cafe_id)
        priority = cafe_cfg.get('priority', default_priority)
        freshness_days = int(cafe_cfg.get('freshness_days', default_freshness_days) or default_freshness_days)
        bean_count = int(meta.get('bean_count') or cafe_counts.get(cafe_id) or 0)
        previous_bean_count = int(prev.get('latest_bean_count') or 0)
        success = bool(meta.get('success'))

        last_success_at = prev.get('last_success_at')
        last_failure_at = prev.get('last_failure_at')
        consecutive_failures = int(prev.get('consecutive_failures') or 0)
        last_error_type = prev.get('last_error_type')
        status_reason = 'no_run_meta'

        if meta:
            if success:
                last_success_at = meta.get('finished_at') or meta.get('started_at') or last_success_at
                consecutive_failures = 0
                last_error_type = None
                status_reason = 'latest_run_success'
            else:
                last_failure_at = meta.get('finished_at') or meta.get('started_at') or last_failure_at
                consecutive_failures += 1
                last_error_type = meta.get('error_type') or 'unknown_error'
                status_reason = 'latest_run_failed'

        brand_validation_issues = validation_issues_by_brand.get(label) or validation_issues_by_brand.get(cafe_id) or []
        if brand_validation_issues:
            if success:
                status_reason = 'validation_failed'
            last_error_type = 'validation_error'

        freshness_status = compute_freshness_status(last_success_at, freshness_days)

        status = 'healthy'
        if last_error_type in {'validation_error', 'apply_error', 'fetch_error', 'parsing_error', 'environment_error', 'unknown_error'} and consecutive_failures > 0:
            status = 'failing'
        elif freshness_status == 'stale':
            status = 'stale'
        elif meta and success and previous_bean_count and bean_count == 0:
            status = 'warning'
            status_reason = 'empty_count_after_success'

        recent_change_detected = previous_bean_count != 0 and bean_count != previous_bean_count
        alert_eligible = consecutive_failures >= threshold
        alert_state_changed = alert_eligible and not bool(prev.get('alert_eligible'))

        cafe_state = {
            'cafe_id': cafe_id,
            'label': label,
            'priority': priority,
            'status': status,
            'status_reason': status_reason,
            'freshness_days': freshness_days,
            'freshness_status': freshness_status,
            'last_success_at': last_success_at,
            'last_failure_at': last_failure_at,
            'consecutive_failures': consecutive_failures,
            'last_error_type': last_error_type,
            'latest_bean_count': bean_count,
            'previous_bean_count': previous_bean_count,
            'recent_change_detected': recent_change_detected,
            'run_url': run_url or meta.get('run_url') or prev.get('run_url'),
            'dashboard_path': '/admin/crawl-monitor',
            'alert_threshold': threshold,
            'alert_eligible': alert_eligible,
            'alert_state_changed': alert_state_changed,
            'last_checked_at': iso_now(),
            'latest_meta': meta,
            'validation_issues': brand_validation_issues,
        }
        cafes.append(cafe_state)

        if alert_state_changed:
            alert_candidates.append({
                'cafe_id': cafe_id,
                'label': label,
                'priority': priority,
                'consecutive_failures': consecutive_failures,
                'last_error_type': last_error_type,
                'last_failure_at': last_failure_at,
                'last_success_at': last_success_at,
                'run_url': cafe_state['run_url'],
            })

    totals = {
        'cafes': len(cafes),
        'healthy': sum(1 for row in cafes if row['status'] == 'healthy'),
        'warning': sum(1 for row in cafes if row['status'] == 'warning'),
        'stale': sum(1 for row in cafes if row['status'] == 'stale'),
        'failing': sum(1 for row in cafes if row['status'] == 'failing'),
        'top_priority_failing': sum(1 for row in cafes if row['priority'] == 'top_priority' and row['status'] == 'failing'),
        'top_priority_stale': sum(1 for row in cafes if row['priority'] == 'top_priority' and row['status'] == 'stale'),
        'alert_candidates': len(alert_candidates),
    }

    result = {
        'generated_at': iso_now(),
        'run_url': run_url,
        'thresholds': {
            'consecutive_failure_alert_threshold': threshold,
            'default_freshness_days': default_freshness_days,
        },
        'totals': totals,
        'alerts': alert_candidates,
        'cafes': sorted(cafes, key=lambda row: (row['priority'] != 'top_priority', row['status'] != 'failing', row['label'])),
    }

    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')

    alert_candidates_path = state_path.with_name('crawl_alert_candidates.json')
    alert_candidates_path.write_text(json.dumps({'generated_at': iso_now(), 'alerts': alert_candidates}, ensure_ascii=False, indent=2), encoding='utf-8')

    print(json.dumps({
        'ok': True,
        'state_path': str(state_path),
        'cafes': totals['cafes'],
        'failing': totals['failing'],
        'stale': totals['stale'],
        'alert_candidates': totals['alert_candidates'],
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
