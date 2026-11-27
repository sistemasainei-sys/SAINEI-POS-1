@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "PORT=9000"
set "BASE_URL=http://localhost:%PORT%"
set "CLIENT_CONFIG=%LOCALAPPDATA%\SAINEI-POS\cliente.url"
if not defined LOCALAPPDATA set "LOCALAPPDATA=%USERPROFILE%\AppData\Local"
set "CLIENT_CONFIG=%LOCALAPPDATA%\SAINEI-POS\cliente.url"

if exist "%CLIENT_CONFIG%" (
  set /p CLIENT_URL=<"%CLIENT_CONFIG%"
  if defined CLIENT_URL (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$r=Invoke-RestMethod -Uri '!CLIENT_URL!/api/ping' -TimeoutSec 3;if($r.service -eq 'SAINEI_POS' -and $r.server -eq $true){exit 0}else{exit 2}}catch{exit 1}" >nul 2>&1
    if errorlevel 2 (
      echo ERROR: La direccion guardada responde, pero no se identifico un servidor SAINEI POS.
      echo Direccion: !CLIENT_URL!
      echo No se abrira una aplicacion desconocida ni se cambiara la configuracion.
      pause
      exit /b 2
    )
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
  ) else (
    del "%CLIENT_CONFIG%" >nul 2>nul
  )
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$r=Invoke-RestMethod -Uri '%BASE_URL%/api/ping' -TimeoutSec 2;if($r.service -eq 'SAINEI_POS' -and $r.server -eq $true){exit 0}else{exit 2}}catch{exit 1}" >nul 2>&1
if errorlevel 2 (
  echo ERROR: El puerto 9000 esta ocupado por otro servicio, no por SAINEI POS.
  echo No se iniciara otro servidor ni se tocara ningun dato.
  echo Cierra la aplicacion que usa ese puerto o solicita asistencia tecnica.
  pause
  exit /b 2
)
if errorlevel 1 (
  echo Iniciando el servidor SAINEI POS...
  start "" wscript.exe "%~dp0servidor-oculto.vbs"
  set "READY=0"
  for /L %%I in (1,1,20) do (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$r=Invoke-RestMethod -Uri '%BASE_URL%/api/ping' -TimeoutSec 1;if($r.service -eq 'SAINEI_POS' -and $r.server -eq $true){exit 0}else{exit 1}}catch{exit 1}" >nul 2>&1
    if not errorlevel 1 set "READY=1"
    if "!READY!"=="1" goto servidor_listo
    ping -n 2 127.0.0.1 >nul
  )
  echo ERROR: SAINEI POS no respondio despues de iniciar.
  echo Revisa el registro: %LOCALAPPDATA%\SAINEI-POS\datos\servidor.log
  pause
  exit /b 3
)
:servidor_listo
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
start "" "%BROWSER%" --app="%BASE_URL%" --user-data-dir="%LOCALAPPDATA%\SAINEI-POS" --window-size=1280,800
exit /b
