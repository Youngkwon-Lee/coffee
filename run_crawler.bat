@echo off
cd /d %~dp0
set log_dir=logs
set log_file=%log_dir%\crawler_%date:~0,4%%date:~5,2%%date:~8,2%.log

if not exist %log_dir% mkdir %log_dir%

echo 커피 원두 크롤러 실행 - %DATE% %TIME% >> %log_file%
echo ===================================== >> %log_file%

python scripts/run_crawler.py --all --output data/beans_%date:~0,4%%date:~5,2%%date:~8,2%.json >> %log_file% 2>&1

echo ===================================== >> %log_file%
echo 크롤링 완료 - %DATE% %TIME% >> %log_file%
echo. >> %log_file%

echo 크롤링 작업 완료! 로그 파일: %log_file% 