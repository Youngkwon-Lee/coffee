#!/usr/bin/env python3
import argparse
import json
import os
import sys
from statistics import mean
from typing import Any, Dict, List


def json_print(payload: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run PaddleOCR against an image.")
    parser.add_argument("--image", help="Path to the image file")
    parser.add_argument("--lang", default="korean", help="PaddleOCR language code")
    parser.add_argument("--mode", default="text", choices=["text"], help="OCR output mode")
    parser.add_argument("--health", action="store_true", help="Check whether PaddleOCR is available")
    parser.add_argument("--use-angle-cls", action="store_true", default=True, help="Enable angle classifier")
    return parser.parse_args()


def load_paddleocr() -> Any:
    try:
        from paddleocr import PaddleOCR  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "PaddleOCR is not installed. Install it with `pip install paddleocr` and a PaddlePaddle CPU runtime."
        ) from exc

    return PaddleOCR


def normalize_lines(result: Any) -> List[Dict[str, Any]]:
    lines: List[Dict[str, Any]] = []
    if not result:
        return lines

    if isinstance(result, list) and result and isinstance(result[0], dict):
        for page in result:
            texts = page.get("rec_texts") or []
            scores = page.get("rec_scores") or []
            polys = page.get("rec_polys") or []

            for index, text_value in enumerate(texts):
                text = str(text_value).strip()
                confidence = float(scores[index]) if index < len(scores) else 0.0
                box = polys[index].tolist() if index < len(polys) and hasattr(polys[index], "tolist") else polys[index] if index < len(polys) else None
                if not text:
                    continue
                lines.append(
                    {
                        "text": text,
                        "confidence": confidence,
                        "box": box,
                    }
                )
        return lines

    pages = result[0] if isinstance(result, list) and result else result
    if isinstance(pages, list):
        for item in pages:
            if not isinstance(item, list) or len(item) < 2:
                continue
            box, text_info = item[0], item[1]
            if not isinstance(text_info, (list, tuple)) or len(text_info) < 2:
                continue
            text = str(text_info[0]).strip()
            confidence = float(text_info[1])
            if not text:
                continue
            lines.append(
                {
                    "text": text,
                    "confidence": confidence,
                    "box": box,
                }
            )
    return lines


def run_health_check(args: argparse.Namespace) -> int:
    try:
        load_paddleocr()
        json_print(
            {
                "status": "ok",
                "engine": "paddleocr",
                "lang": args.lang,
                "python": sys.version.split()[0],
            }
        )
        return 0
    except RuntimeError as exc:
        json_print(
            {
                "status": "error",
                "engine": "paddleocr",
                "details": str(exc),
            }
        )
        return 1


def run_ocr(args: argparse.Namespace) -> int:
    if not args.image:
        json_print({"error": "Missing --image"})
        return 2

    if not os.path.exists(args.image):
        json_print({"error": f"Image not found: {args.image}"})
        return 2

    try:
        PaddleOCR = load_paddleocr()
    except RuntimeError as exc:
        json_print({"error": str(exc), "code": "PADDLE_OCR_NOT_INSTALLED"})
        return 1

    try:
        ocr = PaddleOCR(
            lang=args.lang,
            use_textline_orientation=args.use_angle_cls,
        )
        result = ocr.predict(input=args.image)
        lines = normalize_lines(result)
        text = "\n".join(line["text"] for line in lines)
        avg_confidence = mean(line["confidence"] for line in lines) if lines else 0.0

        json_print(
            {
                "text": text,
                "lines": lines,
                "confidence": avg_confidence,
                "source": "paddle-ocr",
                "lang": args.lang,
            }
        )
        return 0
    except Exception as exc:  # pragma: no cover - prototype route should surface details
        json_print(
            {
                "error": "PaddleOCR execution failed",
                "details": str(exc),
                "code": "PADDLE_OCR_FAILED",
            }
        )
        return 1


def main() -> int:
    args = parse_args()
    if args.health:
        return run_health_check(args)
    return run_ocr(args)


if __name__ == "__main__":
    raise SystemExit(main())
