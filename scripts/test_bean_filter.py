#!/usr/bin/env python3
"""
원두 필터 회귀 테스트.

이 테스트가 존재하는 이유: config는 `filters.exclude`, 코드는 `filters.exclude_keywords`를
읽고 있었다. 키 이름 하나가 어긋나 제외 목록이 빈 채로 굿즈·드립백·선물세트 61개가
원두로 저장됐고, 크롤러 로그는 계속 초록색이었다. 조용히 통과하는 실패였다.

그래서 여기서는 "필터가 동작한다"가 아니라 **"필터가 실제로 로드됐다"**까지 확인한다.
빈 목록은 모든 이름을 통과시키므로, 통과 자체로는 아무것도 증명하지 못한다.

실행: python3 scripts/test_bean_filter.py   (pytest 불필요)
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import yaml  # noqa: E402

CONFIG_PATH = ROOT / "config" / "crawler_config.yaml"

# 굿즈·부산물 — 원두 목록에 들어오면 안 된다. 실제 DB에서 발견된 이름들이다.
MUST_EXCLUDE = [
    "OATSLIFE x Karactor MILKFORM Pullover",
    "[프릳츠] 드립백",
    "드립백 (200개)",
    "[프릳츠] 홈 커피 선물세트 (쇼핑백 포함)",
    "드립백 버라이어티 3개입",
    "[보자기 포장] 동백 드립백 선물세트 버라이어티 15개입",
    "[프릳츠] 캡슐 종합 세트",
    "앤트러사이트 원두 선물세트(3종) -블랙",
    "[프릳츠] 콜드브루 1L",
    "[폰트커피]  오버타임 콜드브루 1L 원액",
    "COLD BREW 디카페인",
    "커피 텀블러",
    "로고 머그컵",
]

# 정상 원두 — 절대 빠지면 안 된다. 하나라도 빠지면 판매 대상이 사라진다.
MUST_INCLUDE = [
    "에티오피아 예가체프 코케 허니 200g",
    "콜롬비아 후일라 수프리모",
    "프릳츠 올드독 블렌드 1kg",
    "케냐 AA 니에리",
    "과테말라 안티구아 200g",
    "디카페인 콜롬비아 200g",  # 디카페인은 원두다 (설정에서 주석 처리돼 있음)
    "블루마운틴 No.1",
]

# 설명에 추출 안내가 있는 정상 원두. 제외 검사가 설명까지 보면 이게 통째로 빠진다.
DESCRIPTION_TRAPS = [
    {
        "name": "에티오피아 구지 우라가 200g",
        "description": "핸드드립과 콜드브루 모두 좋습니다. 선물세트로도 준비했습니다.",
    },
    {
        "name": "브라질 세라도 내추럴",
        "description": "드립백으로도 만들어 드립니다. 텀블러에 담아 드세요.",
    },
]


def load_filter_keywords():
    cfg = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))
    filters = cfg.get("filters", {}) or {}
    return filters.get("exclude_keywords") or filters.get("exclude") or []


def make_crawler():
    """실제 BaseCrawler의 필터 경로를 그대로 쓴다 — 로직을 복제하면 의미가 없다."""
    from coffee_crawler.crawlers.base_crawler import BaseCrawler

    class Probe(BaseCrawler):
        def _crawl_impl(self, test_mode: bool = False):
            return []

    return Probe("fritz", {"name": "테스트", "url": "https://example.com"})


def main() -> int:
    failures = []

    # 1. 설정 키 이름. 이게 어긋난 것이 실제 원인이었다.
    cfg = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))
    filters = cfg.get("filters", {}) or {}
    if "exclude_keywords" not in filters:
        failures.append(
            "config/crawler_config.yaml의 filters에 `exclude_keywords` 키가 없습니다. "
            f"현재 키: {list(filters.keys())} — base_crawler는 exclude_keywords를 읽습니다."
        )

    keywords = load_filter_keywords()
    if len(keywords) < 20:
        failures.append(f"제외 키워드가 {len(keywords)}개뿐입니다 (최소 20개 기대).")

    # 2. 크롤러가 필터를 실제로 로드했는지. 빈 목록은 전부 통과시킨다.
    crawler = make_crawler()
    if not crawler.exclude_keywords:
        failures.append(
            "BaseCrawler가 제외 키워드를 로드하지 못했습니다 (빈 목록). "
            "빈 목록은 모든 굿즈를 통과시킵니다 — 아래 통과 결과는 무의미합니다."
        )
    else:
        print(f"제외 키워드 {len(crawler.exclude_keywords)}개 로드 확인")

    # 3. 굿즈는 빠져야 한다.
    for name in MUST_EXCLUDE:
        if crawler._should_include({"name": name}):
            failures.append(f"굿즈가 통과했습니다: {name}")

    # 4. 정상 원두는 남아야 한다.
    for name in MUST_INCLUDE:
        if not crawler._should_include({"name": name}):
            failures.append(f"정상 원두가 제외됐습니다: {name}")

    # 5. 설명에 추출 안내가 있어도 남아야 한다.
    for item in DESCRIPTION_TRAPS:
        if not crawler._should_include(item):
            failures.append(
                f"설명 때문에 정상 원두가 제외됐습니다: {item['name']} "
                "— 제외 검사는 제품명만 봐야 합니다."
            )

    total = len(MUST_EXCLUDE) + len(MUST_INCLUDE) + len(DESCRIPTION_TRAPS)
    if failures:
        print(f"\n실패 {len(failures)}건 / 검사 {total}건\n")
        for f in failures:
            print(f"  x {f}")
        return 1

    print(f"통과: 굿즈 {len(MUST_EXCLUDE)}개 제외, 원두 {len(MUST_INCLUDE)}개 유지, "
          f"설명 함정 {len(DESCRIPTION_TRAPS)}개 통과 (총 {total}건)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
