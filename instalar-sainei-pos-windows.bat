@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Instalador SAINEI POS
echo ==========================================
echo          INSTALADOR SAINEI POS
echo ==========================================
echo.
if not defined LOCALAPPDATA set "LOCALAPPDATA=%USERPROFILE%\AppData\Local"
set "SAINEI_DISCOVERY=%TEMP%\sainei-servidor-url.txt"

rem Una PC que ya fue caja cliente conserva ese rol aunque el servidor este apagado.
if exist "%LOCALAPPDATA%\SAINEI-POS\cliente.url" goto mantener_cliente

rem Detectar un servidor activo antes de instalar Node.js: las cajas no necesitan Node.
if exist "%~dp0descubrir-servidor-sainei.ps1" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0descubrir-servidor-sainei.ps1" > "%SAINEI_DISCOVERY%"
  if not errorlevel 1 (
    set /p SAINEI_SERVER_URL=<"%SAINEI_DISCOVERY%"
    if defined SAINEI_SERVER_URL (
      if not exist "%LOCALAPPDATA%\SAINEI-POS" mkdir "%LOCALAPPDATA%\SAINEI-POS"
      >"%LOCALAPPDATA%\SAINEI-POS\cliente.url" echo !SAINEI_SERVER_URL!
      del "%SAINEI_DISCOVERY%" >nul 2>nul
      goto mantener_cliente
    )
  )
)
if exist "%SAINEI_DISCOVERY%" del "%SAINEI_DISCOVERY%" >nul 2>nul

rem Si no se encontro servidor, esta computadora sera el servidor principal.
where node >nul 2>nul
if errorlevel 1 (
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
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  echo ERROR: SAINEI POS requiere Node.js 22.13 o superior.
  echo Actualiza Node.js LTS y vuelve a ejecutar el instalador.
  pause
  exit /b 4
)
set "SAINEI_DATA=%LOCALAPPDATA%\SAINEI-POS\datos"
if not exist "%SAINEI_DATA%" mkdir "%SAINEI_DATA%"
if not exist "%SAINEI_DATA%\copias" mkdir "%SAINEI_DATA%\copias"
echo.
echo Esta computadora sera el SERVIDOR PRINCIPAL.
echo Datos permanentes: %SAINEI_DATA%
echo Configurando inicio automatico del servidor...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar-inicio-automatico-sainei.ps1"
set "STARTUP_RESULT=%ERRORLEVEL%"
if not "%STARTUP_RESULT%"=="0" (
  echo No se pudo configurar el inicio automatico.
  echo Puedes iniciar manualmente con iniciar-sainei-pos-windows.bat.
  pause
  exit /b 5
)
echo Configurando firewall para permitir cajas en la red privada local...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar-firewall-elevado.ps1"
if errorlevel 1 echo AVISO: No se pudo configurar el firewall. La deteccion automatica de cajas puede requerir configurar el firewall manualmente.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p='%~dp02-Abrir-Caja.bat';$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\SAINEI POS.lnk');$s.TargetPath=$p;$s.WorkingDirectory='%~dp0';$s.Save()"
if errorlevel 1 (
  echo No se pudo crear el acceso directo del Escritorio.
  pause
  exit /b 6
)
echo.
echo Instalacion del servidor preparada. Se creo el acceso directo SAINEI POS.
echo Instala las cajas adicionales con esta PC encendida y conectada a la misma red privada.
endlocal
exit /b 0

:mantener_cliente
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$target='%~dp02-Abrir-Caja.bat';$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\SAINEI POS.lnk');$s.TargetPath=$target;$s.WorkingDirectory='%~dp0';$s.Save()"
echo.
echo SERVIDOR SAINEI POS DETECTADO: !SAINEI_SERVER_URL!
echo Esta computadora quedo configurada como CAJA CLIENTE.
echo No se instala servidor ni se crea una base de datos separada.
echo Los datos se guardan unicamente en la computadora principal.
endlocal
exit /b 0
