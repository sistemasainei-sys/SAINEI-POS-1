@echo off
setlocal
title Actualizador SAINEI POS
cd /d "%~dp0"
echo ==========================================
echo        ACTUALIZADOR SAINEI POS
echo ==========================================
echo.
echo Esta carpeta contiene la NUEVA version extraida.
echo Los datos del comercio se conservaran y se respaldaran.
echo.
set "SOURCE=%~dp0"
set /p "TARGET=Escribi la ruta de la carpeta donde esta instalado SAINEI POS: "
if not defined TARGET (
  echo No se indico la carpeta instalada.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0actualizar-sainei-pos.ps1" -Source "%SOURCE%" -Target "%TARGET%"
if errorlevel 1 (
  echo.
  echo No se completo la actualizacion. Revisa el mensaje anterior.
  pause
  exit /b 2
)
echo.
echo Actualizacion de archivos completada.
echo Los datos y respaldos permanecen en %%LOCALAPPDATA%%\SAINEI-POS\datos.
pause
endlocal
