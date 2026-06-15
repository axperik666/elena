@echo off
REM Обёртка для CLI: любой вызов браузера → только Google Chrome (не Edge)
set "URL=%~1"
if "%URL%"=="" exit /b 0
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "%URL%"
