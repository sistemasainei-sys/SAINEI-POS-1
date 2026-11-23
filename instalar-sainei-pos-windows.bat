@echo off
setlocal
cd /d "%~dp0"
title Instalador SAINEI POS
echo ==========================================
echo          INSTALADOR SAINEI POS
echo ==========================================
echo.
where node >nul 2>nul
if not errorlevel 1 goto comprobar_version
echo Node.js no esta instalado. Buscando instalador oficial mediante Windows Package Manager...
where winget >nul 2>nul
if errorlevel 1 (
  echo ERROR: No se encontro winget.
  echo Instala Node.js LTS desde https://nodejs.org y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)
winget install --id OpenJS.NodeJS.LTS --exact --source winget --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo No se pudo instalar Node.js automaticamente.
  echo Instala Node.js LTS desde https://nodejs.org y vuelve a ejecutar este archivo.
  pause
  exit /b 2
)
set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo Cierra esta ventana, abrela de nuevo y ejecuta el instalador otra vez.
  pause
  exit /b 3
)
:comprobar_version
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  echo ERROR: SAINEI POS requiere Node.js 22.13 o superior.
  echo Actualiza Node.js LTS y vuelve a ejecutar este archivo.
  pause
  exit /b 4
)
if not defined LOCALAPPDATA set LOCALAPPDATA=%USERPROFILE%\AppData\Local
set "SAINEI_DATA=%LOCALAPPDATA%\SAINEI-POS\datos"
if not exist "%SAINEI_DATA%" mkdir "%SAINEI_DATA%"
if not exist "%SAINEI_DATA%\copias" mkdir "%SAINEI_DATA%\copias"
echo.
echo Preparacion completada.
echo Los datos y la base SQLite se crearan automaticamente al iniciar el servidor.
echo Carpeta permanente de datos: %SAINEI_DATA%
echo.
echo Iniciando SAINEI POS...
call "%~dp0iniciar-sainei-pos-windows.bat"
endlocal
