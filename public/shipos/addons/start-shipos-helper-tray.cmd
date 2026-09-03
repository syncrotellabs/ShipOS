@echo off
setlocal

set "INSTALL_DIR=%LOCALAPPDATA%\ShipOS\Helper"
set "HELPER_SCRIPT=%INSTALL_DIR%\shipos-helper-tray.ps1"

echo Updating ShipOS Telemetry Helper...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $root=Join-Path $env:LOCALAPPDATA 'ShipOS\Helper'; $zip=Join-Path $env:TEMP 'shipos-helper-update.zip'; New-Item -ItemType Directory -Path $root -Force | Out-Null; Invoke-WebRequest -UseBasicParsing -Uri ('https://gaming.echoboardhq.com/shipos/addons/shipos-helper.zip?ts=' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) -OutFile $zip; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and (($_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*\ShipOS\Helper\shipos-helper-tray.ps1*') -or ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*\ShipOS\Helper\shipos-telemetry-bridge.mjs*')) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 350; Expand-Archive -LiteralPath $zip -DestinationPath $root -Force; Remove-Item -LiteralPath $zip -Force"
if errorlevel 1 (
  echo Could not update the ShipOS helper.
  pause
  exit /b 1
)

echo Starting the current ShipOS Telemetry Helper in the system tray...
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%HELPER_SCRIPT%" -Mode LocalMod
exit /b 0
