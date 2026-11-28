@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
if not defined LOCALAPPDATA set "LOCALAPPDATA=%USERPROFILE%\AppData\Local"
set "CLIENT_CONFIG=%LOCALAPPDATA%\SAINEI-POS\cliente.url"
set "PORT_FILE=%TEMP%\sainei-port-%RANDOM%.txt"
set "PORT="
if not exist "%CLIENT_CONFIG%" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0descubrir-servidor-sainei.ps1" > "%PORT_FILE%" 2>nul
  if not errorlevel 1 (
    set /p CLIENT_URL=<"%PORT_FILE%"
    if defined CLIENT_URL (
      if not exist "%LOCALAPPDATA%\SAINEI-POS" mkdir "%LOCALAPPDATA%\SAINEI-POS"
      >"%CLIENT_CONFIG%" echo !CLIENT_URL!
      start "" "!CLIENT_URL!"
      del "%PORT_FILE%" >nul 2>nul
      exit /b 0
    )
  )
)
if exist "%CLIENT_CONFIG%" (
  set /p CLIENT_URL=<"%CLIENT_CONFIG%"
  if defined CLIENT_URL (
    start "" "!CLIENT_URL!"
    exit /b 0
  )
)
call :find_server
if defined PORT goto open_app
echo Iniciando el servidor SAINEI POS...
start "" wscript.exe "%~dp0servidor-oculto.vbs"
for /L %%I in (1,1,40) do (
  call :find_server
  if defined PORT goto open_app
  ping -n 2 127.0.0.1 >nul
)
echo ERROR: SAINEI POS no respondio en los puertos 9000 a 9010.
echo Revisa %LOCALAPPDATA%\SAINEI-POS\datos\servidor.log
pause
exit /b 3

:find_server
set "PORT="
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "for($p=9000;$p -le 9010;$p++){try{$r=Invoke-RestMethod -Uri ('http://127.0.0.1:'+$p+'/api/ping') -TimeoutSec 1;if($r.service -eq 'SAINEI_POS' -and $r.server -eq $true -and [int]$r.port -eq $p){Write-Output $p;exit 0}}catch{}};exit 1" > "%PORT_FILE%" 2>nul
if exist "%PORT_FILE%" set /p PORT=<"%PORT_FILE%"
del "%PORT_FILE%" >nul 2>nul
exit /b 0

:open_app
set "BASE_URL=http://localhost:%PORT%"
set "BROWSER="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER (
  start "" "%BASE_URL%"
  exit /b 0
)
start "" "%BROWSER%" --app="%BASE_URL%" --user-data-dir="%LOCALAPPDATA%\SAINEI-POS" --window-size=1280,800
exit /b 0
