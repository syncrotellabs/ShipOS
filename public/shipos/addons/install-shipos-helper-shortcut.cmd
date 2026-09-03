@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "HELPER_SCRIPT=%SCRIPT_DIR%shipos-helper-tray.ps1"

if not exist "%HELPER_SCRIPT%" (
  echo Downloading ShipOS helper package...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $dir='%SCRIPT_DIR%'; $zip=Join-Path $dir 'shipos-helper.zip'; Invoke-WebRequest -UseBasicParsing -Uri 'https://gaming.echoboardhq.com/shipos/addons/shipos-helper.zip' -OutFile $zip; Expand-Archive -LiteralPath $zip -DestinationPath $dir -Force"
  if errorlevel 1 (
    echo Could not download or unpack:
    echo %HELPER_SCRIPT%
    pause
    exit /b 1
  )
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%HELPER_SCRIPT%" -InstallShortcut -NoStart -Mode LocalMod
echo.
echo ShipOS Telemetry Helper shortcut has been installed on the desktop.
echo Double-click it to start the helper in the Windows system tray.
echo.
pause
