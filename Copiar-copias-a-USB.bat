@echo off
setlocal
cd /d "%~dp0"
if not exist "%~dp0datos\copias" (
  echo Todavia no hay copias en datos\copias
  pause
  exit /b
)
set /p DRV=Letra del pendrive o disco ^(por ejemplo E^): 
xcopy "%~dp0datos\copias\*" "%DRV%:\SAINEI-copias\" /Y /I /Q
echo.
echo Listo. Las copias quedaron en %DRV%:\SAINEI-copias
pause
