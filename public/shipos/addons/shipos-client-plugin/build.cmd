@echo off
setlocal

set "DEFAULT_STEAM_BIN64=%ProgramFiles(x86)%\Steam\steamapps\common\SpaceEngineers\Bin64"
set "D_STEAM_BIN64=D:\SteamLibrary\steamapps\common\SpaceEngineers\Bin64"

if defined SpaceEngineersBin64 goto havePath
if exist "%DEFAULT_STEAM_BIN64%\Sandbox.Common.dll" set "SpaceEngineersBin64=%DEFAULT_STEAM_BIN64%"
if defined SpaceEngineersBin64 goto havePath
if exist "%D_STEAM_BIN64%\Sandbox.Common.dll" set "SpaceEngineersBin64=%D_STEAM_BIN64%"
if defined SpaceEngineersBin64 goto havePath
set "SpaceEngineersBin64=%DEFAULT_STEAM_BIN64%"

:havePath

echo SpaceEngineersBin64=%SpaceEngineersBin64%
if exist "%SpaceEngineersBin64%\Sandbox.Common.dll" goto build
echo Could not find Space Engineers assemblies in:
echo %SpaceEngineersBin64%
echo Checked:
echo %DEFAULT_STEAM_BIN64%
echo %D_STEAM_BIN64%
echo Set SpaceEngineersBin64 to your Space Engineers Bin64 directory and run again.
exit /b 1

:build
dotnet build "%~dp0ShipOSClientPlugin.csproj" -c Release /p:SpaceEngineersBin64="%SpaceEngineersBin64%"
