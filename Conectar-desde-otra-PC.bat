@echo off
setlocal
cd /d "%~dp0"
set "FILE=%~dp0servidor.txt"
set "ADDR="
if exist "%FILE%" set /p ADDR=<"%FILE%"
if defined ADDR goto abrir
echo Escriba la direccion de la PC principal, por ejemplo 192.168.1.20
echo ^(la ve en la pantalla al terminar 1-INSTALAR.bat, o en datos\direcciones.txt de la PC principal^)
set /p IP=Direccion: 
echo %IP% | find ":" >nul || set "IP=%IP%:8080"
> "%FILE%" echo %IP%
set "ADDR=%IP%"
:abrir
echo Conectando con %ADDR% ... ^(si cambia la direccion, borre el archivo servidor.txt^)
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
start "" "%BROWSER%" --app="http://%ADDR%" --user-data-dir="%LOCALAPPDATA%\SAINEI-POS-REMOTO" --window-size=1280,800
exit /b
