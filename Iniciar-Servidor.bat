@echo off
setlocal
cd /d "%~dp0"
title SAINEI POS - Servidor local
if not defined LOCALAPPDATA set "LOCALAPPDATA=%USERPROFILE%\AppData\Local"
set "SAINEI_LOCAL_MODE=1"
set "SAINEI_DATA=%LOCALAPPDATA%\SAINEI-POS\datos"
if not exist "%SAINEI_DATA%" mkdir "%SAINEI_DATA%"
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: No se encontro Node.js. Ejecuta 1-INSTALAR.bat.
  pause
  exit /b 2
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  echo ERROR: SAINEI POS requiere Node.js 22.13 o superior.
  pause
  exit /b 2
)
if not exist "%~dp0server.js" (
  echo ERROR: No se encontro server.js. Descarga el paquete completo.
  pause
  exit /b 2
)
:loop
node "%~dp0server.js"
if errorlevel 2 (
  echo ERROR: El servidor no pudo iniciarse. Revisa servidor.log.
  pause
  exit /b 2
)
echo El servidor se detuvo. Reiniciando en 5 segundos...
ping -n 6 127.0.0.1 >nul
goto loop
