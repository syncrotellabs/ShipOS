@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "BRIDGE_SCRIPT=%SCRIPT_DIR%shipos-telemetry-bridge.mjs"
set "SHIPOS_TELEMETRY_HOST=127.0.0.1"
set "SHIPOS_REMOTE_PUSH_URL=https://gaming.echoboardhq.com/api/shipos/telemetry"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on PATH.
  echo Install Node.js or run this from a shell where node is available.
  pause
  exit /b 1
)

if not exist "%BRIDGE_SCRIPT%" (
  echo Missing bridge script:
  echo %BRIDGE_SCRIPT%
  pause
  exit /b 1
)

echo Starting ShipOS telemetry bridge...
echo Local endpoint: http://127.0.0.1:8795/telemetry/latest
echo EchoBoard relay: %SHIPOS_REMOTE_PUSH_URL%
echo Pair a relay key from the ShipOS telemetry panel before expecting remote uploads.
node "%BRIDGE_SCRIPT%"
pause
