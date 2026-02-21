"""
GLM-OCR 기반 커피 원두 이미지 분석 핸들러

2단계 접근: 이미지 → OCR 텍스트 추출 → 정규식 기반 구조화 파싱

사용법:
    from coffee_crawler.utils.ocr_handler import CoffeeOCRHandler

    handler = CoffeeOCRHandler()
    if handler.is_available():
        result = handler.extract_from_image("path/to/image.jpg")
        # result = {"cafe_name": "...", "bean_name": "...", ...}

        result = handler.extract_from_bytes(image_bytes)
"""

import logging
import re
import tempfile
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# 가공방식 정규화 매핑
_PROCESS_MAP = {
    "워시드": "Washed", "수세식": "Washed", "washed": "Washed",
    "내추럴": "Natural", "건조식": "Natural", "natural": "Natural",
    "허니": "Honey", "honey": "Honey",
    "혐기성": "Anaerobic", "anaerobic": "Anaerobic",
    "세미워시드": "Semi-washed", "semi-washed": "Semi-washed",
    "펄프드": "Pulped Natural", "pulped": "Pulped Natural",
}

# 로스팅 정규화 매핑
_ROAST_MAP = {
    "라이트": "Light", "light": "Light",
    "미디엄 라이트": "Medium-Light", "미디엘 라이트": "Medium-Light",
    "medium light": "Medium-Light",
    "미디엄 다크": "Medium-Dark", "medium dark": "Medium-Dark",
    "미디엄": "Medium", "medium": "Medium",
    "다크": "Dark", "dark": "Dark",
    "프렌치": "French", "french": "French",
}


def _parse_coffee_text(text: str) -> dict[str, str]:
    """OCR 텍스트에서 커피 정보를 정규식으로 추출합니다."""

    def _get(patterns: list[re.Pattern]) -> str:
        for p in patterns:
            m = p.search(text)
            if m:
                return m.group(1).strip()
        return ""

    bean_name = _get([
        re.compile(r"품\s*명[:\s]+(.+)", re.I),
        re.compile(r"bean\s*name[:\s]+(.+)", re.I),
    ])

    origin = _get([
        re.compile(r"^원산지[:\s]+(.+)", re.I | re.M),
        re.compile(r"^origin[:\s]+(.+)", re.I | re.M),
    ])

    # 가공방식
    raw_process = _get([
        re.compile(r"가공\s*방식[:\s]+(.+)", re.I),
        re.compile(r"process(?:ing)?[:\s]+(.+)", re.I),
    ])
    processing = raw_process
    for k, v in _PROCESS_MAP.items():
        if k in raw_process.lower():
            processing = v
            break

    # 로스팅 (OCR이 "팅"을 "팀/테/틴" 등으로 오인식하는 경우 포함)
    raw_roast = _get([
        re.compile(r"로스[팅팀틴테][:\s]+(.+)", re.I),
        re.compile(r"roast(?:ing)?[:\s]+(.+)", re.I),
    ])
    roast_level = raw_roast
    for k, v in _ROAST_MAP.items():
        if k in raw_roast.lower():
            roast_level = v
            break

    variety = _get([
        re.compile(r"품\s*종[:\s]+(.+)", re.I),
        re.compile(r"variety[:\s]+(.+)", re.I),
    ])

    # 카페명: 본문에서 "커피" 또는 "로스터" 포함하는 줄 (제목 제외)
    cafe_name = ""
    for line in text.splitlines():
        line = line.strip()
        if not line or "증명서" in line or "원산지" in line:
            continue
        if re.search(r"(커피|로스터|Coffee|Roaster)", line, re.I):
            cafe_name = line
            break

    return {
        "cafe_name": cafe_name,
        "bean_name": bean_name,
        "origin": origin,
        "processing": processing,
        "roast_level": roast_level,
        "variety": variety,
    }


class CoffeeOCRHandler:
    """GLM-OCR을 사용한 커피 원두 이미지 분석기 (2단계 접근)"""

    def __init__(
        self,
        host: str | None = None,
        model: str = "glm-ocr",
        timeout: float = 120.0,
    ):
        import os
        self.host = host or os.environ.get("OLLAMA_TUNNEL_URL") or os.environ.get("OLLAMA_HOST") or "http://localhost:11434"
        self.model = model
        self.timeout = timeout
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            from glm_ocr.client import OllamaOCR
            from glm_ocr.config import OllamaConfig

            config = OllamaConfig(
                host=self.host,
                model=self.model,
                timeout=self.timeout,
            )
            self._client = OllamaOCR(config)
        return self._client

    def is_available(self) -> bool:
        """Ollama 서버와 모델이 사용 가능한지 확인합니다."""
        try:
            client = self._get_client()
            ok, msg = client.check_connection()
            if not ok:
                logger.warning(f"GLM-OCR 사용 불가: {msg}")
            return ok
        except Exception as e:
            logger.warning(f"GLM-OCR 연결 실패: {e}")
            return False

    def extract_text(self, image_path: str | Path) -> str:
        """Step 1: 이미지에서 원시 텍스트를 추출합니다."""
        from glm_ocr.models import OCRMode

        client = self._get_client()
        results = client.process_file(Path(image_path), mode=OCRMode.TEXT)
        if not results or not results[0].ok:
            return ""
        return results[0].text

    def extract_from_image(self, image_path: str | Path) -> dict[str, Any]:
        """2단계: OCR 텍스트 추출 → 정규식 파싱으로 커피 정보 추출"""
        raw_text = self.extract_text(image_path)
        if not raw_text.strip():
            logger.warning(f"OCR 텍스트 추출 실패: {image_path}")
            return {}

        result = _parse_coffee_text(raw_text)
        result["raw_text"] = raw_text
        return result

    def extract_from_bytes(self, image_bytes: bytes, suffix: str = ".png") -> dict[str, Any]:
        """바이트 데이터에서 커피 정보를 추출합니다."""
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        try:
            return self.extract_from_image(tmp_path)
        finally:
            Path(tmp_path).unlink(missing_ok=True)
