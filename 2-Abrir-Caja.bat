@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "PORT=9000"
set "CLIENT_CONFIG=%LOCALAPPDATA%\SAINEI-POS\cliente.url"
if exist "%CLIENT_CONFIG%" (
  set /p CLIENT_URL=<"%CLIENT_CONFIG%"
  if not defined CLIENT_URL (
    del "%CLIENT_CONFIG%" >nul 2>nul
  ) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try{(Invoke-WebRequest -UseBasicParsing '!CLIENT_URL!/api/ping' -TimeoutSec 3).StatusCode}catch{exit 1}" >nul 2>&1
    if errorlevel 1 (
      echo Buscando nuevamente el servidor SAINEI POS en la red...
      powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0descubrir-servidor-sainei.ps1" > "%TEMP%\sainei-servidor-url.txt"
      if errorlevel 1 (
        echo No se encontro el servidor. Verifica que la PC principal este encendida y en la misma red.
        pause
        exit /b 1
      )
      set /p CLIENT_URL=<"%TEMP%\sainei-servidor-url.txt"
      >"%CLIENT_CONFIG%" echo !CLIENT_URL!
    )
    start "" "!CLIENT_URL!"
    exit /b 0
  )
)
powershell -NoProfile -Command "try{(Invoke-WebRequest -UseBasicParsing http://localhost:%PORT%/api/ping -TimeoutSec 2).StatusCode}catch{exit 1}" >nul 2>&1
if errorlevel 1 (
  echo Iniciando el servidor...
  start "" wscript.exe "%~dp0servidor-oculto.vbs"
  ping -n 6 127.0.0.1 >nul
)
set "BROWSER="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER (
  echo No se encontro Microsoft Edge ni Google Chrome en esta computadora.
  pause
  exit /b 1
)
start "" "%BROWSER%" --app="http://localhost:%PORT%" --user-data-dir="%LOCALAPPDATA%\SAINEI-POS" --window-size=1280,800
exit /b
