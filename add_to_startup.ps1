$currentPath = (Get-Location).Path
$batchFilePath = "$currentPath\startup_check.bat"
$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = "$startupFolder\CoffeeBeanCrawlerCheck.lnk"

Write-Host "커피 원두 크롤러 시작 프로그램 등록"
Write-Host "실행 파일: $batchFilePath"
Write-Host "시작 프로그램 폴더: $startupFolder"
Write-Host ""

# 바로가기 생성
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $batchFilePath
$Shortcut.WorkingDirectory = $currentPath
$Shortcut.Description = "커피 원두 크롤러 자동 실행"
$Shortcut.WindowStyle = 7  # 최소화
$Shortcut.Save()

Write-Host "시작 프로그램에 등록 완료: $shortcutPath"
Write-Host "이제 컴퓨터가 시작될 때마다 자동으로 크롤링 필요 여부를 확인합니다."
Write-Host "마지막 실행 후 7일이 지난 경우에만 크롤링이 실행됩니다."
Write-Host ""
Write-Host "엔터 키를 눌러 종료하세요..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 