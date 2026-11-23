@echo off
setlocal
cd /d "%~dp0"
set "SAINEI_DATA=%~dp0datos-prueba"
title SAINEI POS - Servidor de PRUEBA (datos de ejemplo, puerto 8081)
echo MODO PRUEBA: usa datos de ejemplo en la carpeta datos-prueba y el puerto 8081.
echo Los datos REALES no se tocan. Abri http://localhost:8081 en el navegador.
node "%~dp0servidor\server.js" --demo --port=8081
pause
