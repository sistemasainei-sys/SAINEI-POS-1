@echo off
setlocal
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0desinstalar-sainei-pos.ps1"
if errorlevel 1 (
  echo Hubo un problema al quitar el inicio automatico. Revisa los permisos de Windows.
  pause
  exit /b 1
)
del "%USERPROFILE%\Desktop\SAINEI POS.lnk" >nul 2>&1
echo Se detuvo y quito el inicio automatico y las reglas de red de SAINEI POS.
echo Los DATOS del negocio NO se borraron: siguen en %%LOCALAPPDATA%%\SAINEI-POS\datos.
pause
