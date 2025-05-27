$currentPath = (Get-Location).Path
$taskName = "CoffeeBeanCrawler"
$taskDescription = "주기적으로 커피 원두 정보를 수집하는 작업"
$batchFilePath = "$currentPath\run_crawler.bat"

# 작업 스케줄러 설정
$action = New-ScheduledTaskAction -Execute "$batchFilePath"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 3am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -AllowStartIfOnBatteries -RunOnlyIfNetworkAvailable

# 작업 등록 (처음 실행 시 관리자 권한 필요)
Write-Host "커피 원두 크롤러 작업 스케줄러 등록"
Write-Host "작업 이름: $taskName"
Write-Host "실행 파일: $batchFilePath"
Write-Host "실행 주기: 매주 월요일 오전 3시"
Write-Host "설정: 컴퓨터가 꺼져 있었을 경우 다음 시작 시 실행, 네트워크 연결 필요"
Write-Host ""
Write-Host "이 스크립트를 관리자 권한으로 실행하세요."
Write-Host "명령어: Start-Process PowerShell -Verb RunAs -ArgumentList '-File $PSCommandPath'"
Write-Host ""
Write-Host "관리자 권한으로 실행 중인 경우, 계속하려면 아무 키나 누르세요..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description $taskDescription -Force
    Write-Host "작업 등록 완료"
} catch {
    Write-Host "오류 발생: $_"
    Write-Host "관리자 권한으로 실행하지 않아 발생한 오류일 수 있습니다."
}

Write-Host "엔터 키를 눌러 종료하세요..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 