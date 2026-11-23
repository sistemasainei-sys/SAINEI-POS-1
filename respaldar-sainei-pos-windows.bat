@echo off
setlocal
if not defined LOCALAPPDATA set LOCALAPPDATA=%USERPROFILE%\AppData\Local
set "SAINEI_SOURCE=%LOCALAPPDATA%\SAINEI-POS\datos\copias"
set "SAINEI_DEST=%~1"
if "%SAINEI_DEST%"=="" set "SAINEI_DEST=%SAINEI_BACKUP_DEST%"
if "%SAINEI_DEST%"=="" (
  echo Uso: respaldar-sainei-pos-windows.bat E:\SAINEI-RESPALDOS
  echo Indica una unidad externa o carpeta segura como destino.
  pause
  exit /b 2
)
if not exist "%SAINEI_SOURCE%" (
  echo ERROR: No se encuentra la carpeta de copias: %SAINEI_SOURCE%
  pause
  exit /b 3
)
if not exist "%SAINEI_DEST%" mkdir "%SAINEI_DEST%"
robocopy "%SAINEI_SOURCE%" "%SAINEI_DEST%" *.db /E /XO /R:2 /W:2
set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 (
  echo ERROR: No se pudo completar la copia. Codigo robocopy %RC%.
  pause
  exit /b %RC%
)
echo Copia externa finalizada en: %SAINEI_DEST%
echo Conserva esta unidad separada de la computadora principal.
pause
exit /b 0
