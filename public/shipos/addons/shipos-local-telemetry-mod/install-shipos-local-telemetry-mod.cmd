@echo off
setlocal

set "SOURCE=%~dp0ShipOSLocalTelemetry"
set "TARGET=%APPDATA%\SpaceEngineers\Mods\ShipOSLocalTelemetry"

if not exist "%SOURCE%\Data\Scripts\ShipOSLocalTelemetry\ShipOSLocalTelemetrySession.cs" goto missing_source

echo Installing ShipOSLocalTelemetry to:
echo %TARGET%
echo.

mkdir "%TARGET%" >nul 2>&1
robocopy "%SOURCE%" "%TARGET%" /E
set "ROBOCOPY_EXIT=%ERRORLEVEL%"

if %ROBOCOPY_EXIT% LSS 8 goto installed

echo.
echo Install failed. Robocopy exit code: %ROBOCOPY_EXIT%
exit /b %ROBOCOPY_EXIT%

:installed
echo.
echo Installed. Add the local mod named ShipOSLocalTelemetry to your save and reload the world.
exit /b 0

:missing_source
echo ShipOSLocalTelemetry source folder was not found next to this installer.
exit /b 1
