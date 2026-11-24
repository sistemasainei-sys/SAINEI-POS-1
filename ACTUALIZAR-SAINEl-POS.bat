@echo off
setlocal
title Actualizador SAINEI POS
cd /d "%~dp0"
echo ==========================================
echo        ACTUALIZADOR SAINEI POS
echo ==========================================
echo.
echo Selecciona la carpeta EXTRAIDA de la nueva version.
echo No selecciones la carpeta de datos del comercio.
set /p "SOURCE=Ruta completa de la nueva version: "
if not defined SOURCE (
  echo No se indico una carpeta.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0actualizar-sainei-pos.ps1" -Source "%SOURCE%" -Target "%~dp0"
if errorlevel 1 (
  echo.
  echo No se completo la actualizacion. Los datos del comercio se mantienen separados.
  pause
  exit /b 2
)
echo.
echo Actualizacion de archivos completada.
echo Los datos y respaldos permanecen en %%LOCALAPPDATA%%\SAINEI-POS\datos.
pause
endlocal
