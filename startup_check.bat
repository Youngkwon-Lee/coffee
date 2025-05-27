@echo off
cd /d %~dp0
set last_run_file=data\last_run.txt
set log_dir=logs
set threshold_days=7

if not exist %log_dir% mkdir %log_dir%
if not exist data mkdir data

echo 원두 크롤러 시작 시간 확인 중 - %DATE% %TIME%

rem 마지막 실행 날짜 확인
if not exist %last_run_file% (
    echo 마지막 실행 기록이 없습니다. 크롤링을 실행합니다.
    goto run_crawler
)

rem 마지막 실행 날짜 읽기
set /p last_run=<%last_run_file%

rem 현재 날짜 계산
for /f "tokens=1-3 delims=/" %%a in ('echo %date%') do (
    set current_date=%%c%%a%%b
)

rem 마지막 실행 날짜와 현재 날짜의 차이 계산
set /a days_diff=(current_date - last_run) / 10000

if %days_diff% gtr %threshold_days% (
    echo 마지막 실행 후 %days_diff%일이 지났습니다. 크롤링을 실행합니다.
    goto run_crawler
) else (
    echo 마지막 실행 후 %days_diff%일이 지났습니다. 크롤링이 필요하지 않습니다.
    goto end
)

:run_crawler
set log_file=%log_dir%\startup_crawler_%date:~0,4%%date:~5,2%%date:~8,2%.log

echo 원두 크롤링 시작 - %DATE% %TIME% > %log_file%
echo ===================================== >> %log_file%

python scripts/run_crawler.py --all --output data/beans_%date:~0,4%%date:~5,2%%date:~8,2%.json >> %log_file% 2>&1

echo ===================================== >> %log_file%
echo 크롤링 완료 - %DATE% %TIME% >> %log_file%

rem 현재 날짜를 마지막 실행 날짜로 저장
for /f "tokens=1-3 delims=/" %%a in ('echo %date%') do (
    echo %%c%%a%%b > %last_run_file%
)

echo 크롤링 작업이 완료되었습니다!

:end
exit 