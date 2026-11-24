@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SAINEI POS - Instalacion en la PC principal
rem Compatibilidad oficial: Windows 10 actualizado (build 17763 o superior) y Windows 11.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$os=Get-CimInstance Win32_OperatingSystem; $b=[int]$os.BuildNumber; if (($os.Caption -notmatch 'Windows 10|Windows 11') -or $b -lt 17763) { Write-Host 'SAINEI POS requiere Windows 10 actualizado o Windows 11.' -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
  echo.
  echo Este instalador requiere Windows 10 actualizado o Windows 11.
  echo Mac, iPhone, iPad y Android se conectan como cajas cliente desde el navegador.
  pause
  exit /b 10
)
echo ============================================================
echo   SAINEI POS - Instalacion en la PC principal (servidor)
echo ============================================================
echo.
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Pidiendo permiso de administrador...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
set NODEOK=0
where node >nul 2>&1
if %errorlevel%==0 (
  node -e "var v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=13)?0:1)" >nul 2>&1
  if not errorlevel 1 set NODEOK=1
)
if "%NODEOK%"=="0" (
  echo Falta Node.js version 22.13 o mas nueva ^(es el motor del servidor, gratuito^).
  echo Se intenta instalar ahora con winget. Necesita internet SOLO para este paso.
  echo.
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  echo.
  echo Cuando termine, CIERRA esta ventana y vuelve a abrir 1-INSTALAR.bat.
  echo Si winget no funciona, descarga Node.js LTS desde https://nodejs.org e instalalo; luego abri 1-INSTALAR.bat otra vez.
  pause
  exit /b
)
echo [1/4] Node.js correcto.
echo [2/4] Permitiendo el acceso desde otras PC de la red ^(puertos 8080 y 8081^)...
netsh advfirewall firewall delete rule name="SAINEI POS" >nul 2>&1
netsh advfirewall firewall add rule name="SAINEI POS" dir=in action=allow protocol=TCP localport=8080,8081 profile=private,domain >nul
echo [3/4] Programando el inicio automatico del servidor al encender la PC...
schtasks /Create /TN "SAINEI POS Servidor" /TR "wscript.exe \"%~dp0servidor-oculto.vbs\"" /SC ONLOGON /F >nul
echo [4/4] Creando el acceso directo "SAINEI POS" en el Escritorio...
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\SAINEI POS.lnk');$s.TargetPath='%~dp02-Abrir-Caja.bat';$s.WorkingDirectory='%~dp0';$s.Save()"
echo.
echo Iniciando el servidor...
start "" wscript.exe "%~dp0servidor-oculto.vbs"
timeout /t 5 >nul
echo.
echo ============================================================
echo  LISTO. Para abrir el sistema use el acceso "SAINEI POS" del Escritorio.
echo  Direcciones para las otras PC y celulares ^(misma red^):
echo ============================================================
if exist "%~dp0datos\direcciones.txt" (type "%~dp0datos\direcciones.txt") else (echo Todavia no se genero. Abri 2-Abrir-Caja.bat y mira datos\direcciones.txt)
echo.
echo NO MUEVA ni cambie de lugar esta carpeta despues de instalar.
echo Si la mueve, vuelva a ejecutar 1-INSTALAR.bat.
pause
