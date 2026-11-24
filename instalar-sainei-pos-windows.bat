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
  echo Actualiza Node.js LTS y vuelve a ejecutar el instalador.
  pause
  exit /b 4
)
if not defined LOCALAPPDATA set "LOCALAPPDATA=%USERPROFILE%\AppData\Local"
set "SAINEI_DATA=%LOCALAPPDATA%\SAINEI-POS\datos"
if not exist "%SAINEI_DATA%" mkdir "%SAINEI_DATA%"
if not exist "%SAINEI_DATA%\copias" mkdir "%SAINEI_DATA%\copias"
echo.
echo Datos permanentes: %SAINEI_DATA%
echo Configurando inicio automatico del servidor...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar-inicio-automatico-sainei.ps1"
echo Configurando firewall para permitir cajas en la red privada local...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar-firewall-elevado.ps1"
if errorlevel 1 echo AVISO: No se pudo configurar el firewall. Ejecuta configurar-firewall-sainei.ps1 como administrador para habilitar las cajas.

if errorlevel 1 (
  echo No se pudo configurar el inicio automatico.
  echo Puedes iniciar manualmente con iniciar-sainei-pos-windows.bat.
  pause
  exit /b 5
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p='%~dp02-Abrir-Caja.bat';$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\SAINEI POS.lnk');$s.TargetPath=$p;$s.WorkingDirectory='%~dp0';$s.Save()"
echo.
echo Instalacion preparada. Se creo el acceso directo SAINEI POS en el Escritorio.
echo Los datos quedan fuera de la carpeta del programa y no se borran al actualizar.
endlocal
