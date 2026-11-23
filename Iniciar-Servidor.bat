@echo off
setlocal
cd /d "%~dp0"
set "SAINEI_DATA=%~dp0datos"
title SAINEI POS - Servidor (no cerrar esta ventana)
:loop
node "%~dp0servidor\server.js"
if errorlevel 2 (
  echo Hace falta Node.js 22.13 o mas nuevo. Ejecuta 1-INSTALAR.bat
  pause
  exit /b 2
)
echo.
echo El servidor se detuvo. Reiniciando en 5 segundos... ^(cierre esta ventana para salir^)
ping -n 6 127.0.0.1 >nul
goto loop
