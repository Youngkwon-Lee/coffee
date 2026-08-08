#!/usr/bin/env python3
"""
OG 이미지 생성 — 텔레그램·카톡·트위터 링크 미리보기용 1200x630.

현재 유입 경로가 텔레그램 채널인데 미리보기 이미지가 없어서 링크가 맨 텍스트로
보인다. 광고비보다 이쪽이 먼저다.

색은 앱 실제 팔레트를 그대로 쓴다(tailwind.config.js의 coffee.dark/gold/light).
공유 화면에서만 다른 브랜드처럼 보이면 신뢰가 깎인다.

실행: python3 scripts/make_og_image.py
결과: public/og-image.png
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "og-image.png"

W, H = 1200, 630

# tailwind.config.js의 coffee 팔레트
DARK = (0x12, 0x0F, 0x0D)
MEDIUM = (0x1C, 0x18, 0x16)
GOLD = (0xC5, 0xA8, 0x80)
LIGHT = (0xF8, 0xF6, 0xF3)
LATTE = (0xA6, 0x90, 0x7C)

FONT_PATH = "/System/Library/Fonts/AppleSDGothicNeo.ttc"


def font(size: int, index: int) -> ImageFont.FreeTypeFont:
    # AppleSDGothicNeo.ttc는 굵기별 컬렉션이다. index로 Regular/Bold를 고른다.
    return ImageFont.truetype(FONT_PATH, size, index=index)


def main() -> None:
    img = Image.new("RGB", (W, H), DARK)
    d = ImageDraw.Draw(img)

    # 위에서 아래로 아주 옅은 명도 변화. 단색이면 썸네일에서 납작해 보인다.
    for y in range(H):
        t = y / H
        d.line(
            [(0, y), (W, y)],
            fill=tuple(int(DARK[i] + (MEDIUM[i] - DARK[i]) * t) for i in range(3)),
        )

    # 우측 상단 골드 원호 — 레이더의 스윕을 암시한다. 배경보다 살짝 밝은 정도로만.
    for r, alpha in ((560, 46), (430, 38), (300, 30), (180, 22)):
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(overlay).ellipse(
            [W - 250 - r, -r + 90, W - 250 + r, r + 90],
            outline=GOLD + (alpha,),
            width=3,
        )
        img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    d = ImageDraw.Draw(img)

    x = 90

    # 좌측 골드 세로 바 — 시선 시작점을 만든다.
    d.rectangle([x, 208, x + 5, 300], fill=GOLD)

    d.text((x + 26, 196), "원두레이더", font=font(74, 4), fill=LIGHT)
    d.text(
        (x + 28, 292),
        "국내 로스터리 원두 신상 · 재입고 알림",
        font=font(35, 0),
        fill=GOLD,
    )

    d.text(
        (x + 28, 370),
        "프릳츠 · 앤트러사이트 · 테라로사 · 모모스 등 17곳을 매일 수집합니다.",
        font=font(27, 0),
        fill=LATTE,
    )
    d.text(
        (x + 28, 412),
        "찜한 원두가 재입고되면 텔레그램으로 알려드립니다.",
        font=font(27, 0),
        fill=LATTE,
    )

    # 하단 구분선 + 도메인
    d.line([(x + 28, 508), (W - 120, 508)], fill=(0x2A, 0x24, 0x20), width=1)
    d.text((x + 28, 530), "coffee-omega-lovat.vercel.app", font=font(25, 0), fill=(0x6B, 0x5D, 0x52))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    kb = OUT.stat().st_size / 1024
    print(f"{OUT.relative_to(ROOT)}  {W}x{H}  {kb:.0f}KB")

    # 텔레그램·카톡은 큰 이미지를 받아오다 실패하면 미리보기를 통째로 생략한다.
    if kb > 300:
        raise SystemExit(f"파일이 {kb:.0f}KB로 큽니다. 300KB 이하로 줄이세요.")


if __name__ == "__main__":
    main()
