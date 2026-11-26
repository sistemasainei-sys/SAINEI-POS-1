$ErrorActionPreference = 'Continue'

# Detener y quitar la tarea actual y el nombre usado por versiones anteriores.
$taskNames = @('SAINEI POS - Servidor automatico', 'SAINEI POS Servidor')
foreach ($taskName in $taskNames) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
}

# Detener únicamente procesos Node que ejecuten el servidor desde una carpeta SAINEI POS.
$processes = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'server\.js' -and $_.CommandLine -match 'SAINEI-POS' }
foreach ($process in $processes) {
  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}

# Quitar reglas de firewall de SAINEI POS; no modifica reglas de otros programas.
$ruleNames = @(
  'SAINEI POS - Red local privada',
  'SAINEI POS - Descubrimiento LAN',
  'SAINEI POS - Acceso remoto Tailscale',
  'SAINEI POS'
)
foreach ($ruleName in $ruleNames) {
  Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue |
    Remove-NetFirewallRule -ErrorAction SilentlyContinue
}

Write-Host 'SAINEI POS detenido y desinstalado. La carpeta de datos se conserva.' -ForegroundColor Green
