# 비원두 상품 재유입 방지

2026-10-02, 운영 목록에 오츠 의류·가방·모자와 디폴트밸류 유리잔이 노출됐다.
현재 main의 이름 기반 제외 필터에 해당 상품 종류의 키워드가 빠져 있었다.

기존 codex/preserve-bean-quality-ui-20260913 브랜치에서 명확한 굿즈 키워드 10개만 이식했다.
cap 같은 짧은 문자열 대신 구체적인 상품 종류를 사용해 Cappuccino Blend와 Mexico 원두를 유지한다.
원두 묶음 '블렌드 커피 3종 (각 200g x3)'도 원두이므로 보존한다. 퀵커피·아메리카노는 후속 분류 검토 대상이다.

검증: 실제 BaseCrawler 회귀 37건 통과(굿즈 23개 제외, 원두 12개 유지, 설명 함정 2개 유지).
프릳츠 상품 링크 fixture 통과. 오츠 목록 dry-run은 12개 중 10개 제외, 정상 원두 250g/500g 두 개 수집.
두 행 모두 실제 상품 링크가 있고 샘플이 아니다. DISABLE_FIREBASE=true USE_SELENIUM=false 사용, 알림 옵션 미사용.

운영 coffee-37b81 Firestore 공개 beans 문서 231개를 읽기 전용 조회했고 명확한 굿즈 후보 10개를 확인했다.
DB 쓰기·삭제·알림은 수행하지 않았다. 필터는 신규 수집에만 적용되며 기존 문서는 별도 정리가 필요하다.

실행: python scripts/test_bean_filter.py
실제 목록: DISABLE_FIREBASE=true USE_SELENIUM=false python scripts/run_crawler.py --cafe oats --dry-run --output <path>

vercel.json의 git.deploymentEnabled=false로 모든 브랜치의 Git 자동 배포를 차단한다.
기존 웹 배포는 유지한다. 향후 웹 릴리스는 별도 승인된 로컬 빌드와 reviewed prebuilt artifact로 진행한다.
자동화 소유권 기록은 second-brain의 registry/index에 함께 남긴다. 크롤러 스케줄이나 실행 권한은 바꾸지 않는다.
