@echo off
setlocal
cd /d "%~dp0"
title SAINEI POS - Instalador
if not exist "%~dp0instalar-sainei-pos-windows.bat" (
  echo ERROR: Falta instalar-sainei-pos-windows.bat. Descarga el paquete completo.
  pause
  exit /b 1
)
call "%~dp0instalar-sainei-pos-windows.bat"
endlocal
