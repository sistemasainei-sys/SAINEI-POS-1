@echo off
setlocal
cd /d "%~dp0"
title SAINEI POS - Servidor local
if not defined LOCALAPPDATA set "LOCALAPPDATA=%USERPROFILE%\AppData\Local"
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
echo Iniciando SAINEI POS en el puerto 9000...
node "%~dp0server.js"
set "SERVER_EXIT=%ERRORLEVEL%"
if not "%SERVER_EXIT%"=="0" (
  echo.
  echo ERROR: El servidor SAINEI POS se detuvo con codigo %SERVER_EXIT%.
  echo No se reiniciara en bucle. Revisa:
  echo %SAINEI_DATA%\servidor.log
  echo Si el puerto 9000 esta ocupado, identifica el proceso antes de detenerlo.
  pause
  exit /b %SERVER_EXIT%
)
echo El servidor SAINEI POS se cerro correctamente.
pause
endlocal
