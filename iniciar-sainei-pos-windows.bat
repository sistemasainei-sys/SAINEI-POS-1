@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Instala Node.js 22.13 o superior para iniciar SAINEI POS.
  pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
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
