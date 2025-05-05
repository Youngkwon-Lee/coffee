# Coffee Backend

이 프로젝트는 Coffee 서비스의 백엔드 서버입니다.

## 폴더 구조

```
coffee-backend/
├── src/            # 소스 코드
├── node_modules/   # 외부 패키지
├── .env            # 환경 변수 파일
├── package.json    # npm 설정 파일
├── README.md       # 프로젝트 설명 파일
└── ...
```

## 실행 방법

1. 패키지 설치
   ```bash
   npm install
   ```
2. 환경 변수 파일(.env) 작성
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=your_db_user
   DB_PASS=your_db_password
   ```
3. 서버 실행
   ```bash
   npm start
   ```

## 환경 변수 예시 (.env)
```
PORT=3000
DB_HOST=localhost
DB_USER=your_db_user
DB_PASS=your_db_password
```

## 기타
- 문의사항이나 버그 제보는 이슈로 등록해 주세요. 