@echo off
setlocal
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
schtasks /Delete /TN "SAINEI POS Servidor" /F >nul 2>&1
netsh advfirewall firewall delete rule name="SAINEI POS" >nul 2>&1
del "%USERPROFILE%\Desktop\SAINEI POS.lnk" >nul 2>&1
echo Se quito el inicio automatico, la regla del firewall y el acceso directo.
echo Los DATOS del negocio NO se borraron: siguen en la carpeta "datos".
pause
