@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Instala Node.js 22.13 o superior para iniciar SAINEI POS.
  pause
  exit /b 1
)
for /f "tokens=1,2 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a& set NODE_MINOR=%%b
set NODE_MAJOR=%NODE_MAJOR: v=%
if %NODE_MAJOR% LSS 22 (
  echo ERROR: SAINEI POS requiere Node.js 22.13 o superior.
  pause
  exit /b 1
)
if not defined LOCALAPPDATA set LOCALAPPDATA=%USERPROFILE%\AppData\Local
set "SAINEI_DATA=%LOCALAPPDATA%\SAINEI-POS\datos"
if not exist "%SAINEI_DATA%" mkdir "%SAINEI_DATA%"
echo SAINEI POS guardara los datos en:
echo %SAINEI_DATA%
echo No cierres esta ventana mientras uses el sistema.
node server.js
if errorlevel 1 (
  echo SAINEI POS se cerro con un error. Revisa el mensaje anterior.
  pause
)
endlocal
