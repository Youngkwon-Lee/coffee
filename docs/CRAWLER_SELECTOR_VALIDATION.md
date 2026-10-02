# 상품 링크 selector 검증

프릳츠의 상품 카드는 정상이어도 링크 selector가 바뀌면 원두 수집이 0건이 된다.
`scripts/test_bean_filter.py`의 기존 운영 preflight는 이제 실제 프릳츠 HTML 카드
fixture 두 개와 현재 설정의 상품 링크를 함께 검사한다. 이전 `.box > a` 설정으로
되돌리면 실패하므로, 운영 workflow 변경 없이 설정 회귀를 크롤 전에 차단한다.

프로젝트 Python 환경과 `requirements.test.txt` 의존성을 사용한다.

```sh
python scripts/test_crawler_selectors.py
python scripts/test_bean_filter.py
python scripts/check_crawler_selectors.py --cafe fritz
```

마지막 명령은 설정된 목록 페이지를 GET하고 상품 카드 수, selector 일치 수,
유효한 HTTP(S) 링크 수를 출력한다. 실제 상품 카드가 없거나 링크 누락·잘못된
href가 하나라도 있으면 종료 코드 1을 반환한다. 샘플 데이터를 만들거나 상세
페이지를 요청하지 않으며 DB 쓰기와 알림을 하지 않는다. HTML 타입 설정을 지원한다.

저장된 HTML을 네트워크 요청 없이 확인할 수도 있다.

```sh
python scripts/check_crawler_selectors.py --cafe fritz --html scripts/fixtures/fritz_product_cards.html
```

fixture는 2026-10-02 실제 응답에서 가져온 원두와 드립백 카드다. 오프라인 테스트는
현재 selector와 실제 파서·필터 경로를 검증한다. 향후 사이트 구조 변경 여부는
목록 페이지를 직접 검사해야 한다. 이 도구는 원두 필터·전체 수집·운영 validator를
대체하지 않으며 새로운 예약 실행을 만들지 않는다.
