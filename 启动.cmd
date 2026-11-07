@echo off
rem CuoJian launcher shim (ASCII only on purpose: safe under any console code page).
rem All logic lives in tools\dev.ps1 so that every failure stops and keeps the window.
cd /d "%~dp0"
where powershell.exe >nul 2>nul
if errorlevel 1 goto :no_powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\dev.ps1"
if errorlevel 1 pause
exit /b 0

:no_powershell
echo.
echo   Windows PowerShell was not found on this computer.
echo   Easiest fix: just use the online version (no install needed):
echo   https://Velestia-star.github.io/cuojian/
echo.
pause
exit /b 1
