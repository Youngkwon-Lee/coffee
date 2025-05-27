@echo off
cd /d %~dp0
set log_dir=logs
set log_file=%log_dir%\manual_crawler_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%.log
set log_file=%log_file: =0%

if not exist %log_dir% mkdir %log_dir%
if not exist data mkdir data

echo 수동 크롤링 시작 - %DATE% %TIME%
echo 이 창을 닫지 마세요. 크롤링이 완료되면 자동으로 닫힙니다.
echo.

echo 수동 크롤링 시작 - %DATE% %TIME% > %log_file%
echo ===================================== >> %log_file%

python scripts/run_crawler.py --all --output data/beans_manual_%date:~0,4%%date:~5,2%%date:~8,2%.json >> %log_file% 2>&1

echo ===================================== >> %log_file%
echo 크롤링 완료 - %DATE% %TIME% >> %log_file%

echo.
echo 크롤링 작업이 완료되었습니다!
echo 결과 파일: data\beans_manual_%date:~0,4%%date:~5,2%%date:~8,2%.json
echo 로그 파일: %log_file%
echo.
echo 5초 후 이 창이 자동으로 닫힙니다...
timeout /t 5 > nul 