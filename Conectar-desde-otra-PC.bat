@echo off
setlocal
cd /d "%~dp0"
title SAINEI POS - Configurar caja cliente
if not exist "%~dp0instalar-sainei-pos-windows.bat" (
  echo ERROR: Falta instalar-sainei-pos-windows.bat. Descarga el paquete completo de SAINEI POS.
  pause
  exit /b 1
)
rem La deteccion automatica identifica el servidor y configura esta PC como caja cliente.
call "%~dp0instalar-sainei-pos-windows.bat"
endlocal
