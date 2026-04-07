import re
from typing import Any, Dict, List
from urllib.parse import urljoin, urlparse, parse_qs

from bs4 import BeautifulSoup

from coffee_crawler.crawlers.base_crawler import BaseCrawler


class TerarosaCrawler(BaseCrawler):
    """테라로사 전용 API 크롤러.

    테라로사 상품 목록은 서버의 /api/product/list/ 엔드포인트에서
    AJAX(JSON) 응답으로 내려오기 때문에 HTML 파싱이 아닌 API 호출 기반으로
    수집합니다.
    """

    def __init__(self, cafe_id: str, config: Dict[str, Any]):
        super().__init__(cafe_id, config)
        self.product_list_url = config.get("url", "https://terarosa.com/product/list/")
        self.api_url = config.get("api_url", "/api/product/list/")
        self.page_size = int(config.get("page_size", 30))
        self.goto_page = int(config.get("goto_page", 1))

    @staticmethod
    def _normalize_price(raw: Any) -> int:
        if raw is None:
            return 0
        text = str(raw)
        digits = re.sub(r"[^0-9]", "", text)
        return int(digits) if digits else 0

    @staticmethod
    def _clean_html(text: str) -> str:
        if not text:
            return ""
        soup = BeautifulSoup(text, "html.parser")
        return " ".join(soup.get_text(" ", strip=True).split())

    @staticmethod
    def _extract_category(url: str) -> str:
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        return (qs.get("category") or qs.get("Category") or ["12"])[0]

    def _crawl_impl(self, test_mode: bool = False) -> List[Dict[str, Any]]:
        category = self._extract_category(self.product_list_url)

        # 1) 목록 페이지 먼저 호출해 세션/토큰 초기화
        response, success = self._safe_request(self.product_list_url)
        if not success:
            self.logger.error("테라로사 목록 페이지 초기 요청 실패")
            return []

        soup = BeautifulSoup(response.text, "html.parser")
        token = ((soup.find("meta", attrs={"name": "csrf-token"}) or {}).get("content", "") or "").strip()
        if not token:
            token = (soup.find("script", string=lambda s: s and "CSRF_TOKEN" in s) or {}).get_text() if soup else ""

        # 토큰 문자열 정규화 (fallback)
        if not token and soup:
            m = re.search(r'window\.CSRF_TOKEN\s*=\s*"([^"]+)"', soup.get_text())
            if m:
                token = m.group(1)

        headers = {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
        }
        if token:
            headers["X-CSRF-Token"] = token

        params = (
            f"Category={category}"
            f"&OrderBy="
            f"&SearchText="
            f"&Event="
            f"&rmin="
            f"&rmax="
            f"&sub="
            f"&gubun=product-list"
            f"&GotoPage={self.goto_page}"
            f"&PageSize={self.page_size}"
        )

        api_url = self.api_url
        if api_url.startswith("/"):
            parsed = urlparse(self.product_list_url)
            api_url = f"{parsed.scheme}://{parsed.netloc}{api_url}"

        api_response, api_success = self._safe_request(api_url, method="POST", data=params, headers=headers)
        if not api_success:
            self.logger.error("테라로사 API 요청 실패")
            return []

        payload = api_response.json()
        if not isinstance(payload, dict):
            self.logger.warning("테라로사 API 응답 형식이 예외적입니다")
            return []

        rows = payload.get("rows") or []
        if not rows:
            self.logger.warning(f"테라로사 API rows 없음: {payload.get('reason', '')}")
            return []

        if test_mode:
            rows = rows[: self.test_limit]

        results: List[Dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, dict):
                continue

            item_key = row.get("itemkey", "")
            detail_url = f"/product/detail/?ItemCode={item_key}"
            if category:
                detail_url += f"&category={category}"

            image = (row.get("img_list") or "").strip()
            if image and not image.startswith(("http://", "https://")):
                image = urljoin(self.product_list_url, image)

            note = self._clean_html(row.get("itemexplain", "") or "")

            bean = {
                "cafe_id": self.cafe_id,
                "name": (row.get("itemname") or "").strip(),
                "brand": self.cafe.name,
                "price": self._normalize_price(row.get("saleprice")),
                "origin": self._clean_html(row.get("datetype", "")),
                "process": self._clean_html(row.get("datevalue", "")),
                "description": note,
                "flavor_notes": note,
                "url": urljoin(self.product_list_url, detail_url),
                "images": [image] if image else [],
                "itemkey": item_key,
            }
            # 빈 항목 제거
            if bean.get("name"):
                results.append(bean)

        return results

    def _safe_request(self, url: str, method: str = "GET", **kwargs):
        if method == "POST":
            return self.http_client.post(url, data=kwargs.get("data"), headers=kwargs.get("headers"))
        return self.http_client.get(url, headers=kwargs.get("headers"))
