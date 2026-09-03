@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "SHIPOS_WATCH_FILE=%APPDATA%\SpaceEngineers\Storage\ShipOSLocalTelemetry.latest.json"
set "SHIPOS_TELEMETRY_HOST=127.0.0.1"
set "SHIPOS_REMOTE_PUSH_URL=https://gaming.echoboardhq.com/api/shipos/telemetry"

echo ShipOS local mod bridge
echo Watching:
echo %SHIPOS_WATCH_FILE%
echo.
echo Local endpoint:
echo http://127.0.0.1:8795/telemetry/latest
echo.
echo EchoBoard relay:
echo %SHIPOS_REMOTE_PUSH_URL%
echo Pair a relay key through the ShipOS tray helper for remote uploads.
echo.

where node >nul 2>&1
if errorlevel 1 goto missing_node

node "%SCRIPT_DIR%shipos-telemetry-bridge.mjs"
exit /b %ERRORLEVEL%

:missing_node
echo Node.js was not found on PATH.
echo Install Node.js or run this from a terminal where node is available.
exit /b 1
