# Ejecutar PowerShell como Administrador en la PC que sera servidor.
$ErrorActionPreference = 'Stop'
$ruleName = 'SAINEI POS - Red local privada'
$port = 8080
try {
  $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
  if ($existing) { Remove-NetFirewallRule -DisplayName $ruleName }
  New-NetFirewallRule -DisplayName $ruleName `
    -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port `
    -Profile Private -RemoteAddress LocalSubnet `
    -Description 'Permite SAINEI POS solo desde equipos de la red privada local.' | Out-Null
  Write-Host 'Regla creada: TCP 8080 solo desde la subred local y perfil Privado.' -ForegroundColor Green
  Write-Host 'No habilita acceso publico ni reenvio de puertos del router.'
  Write-Host 'Asegurate de que Windows identifique la red del comercio como Privada.'
} catch {
  Write-Error ('No se pudo configurar el firewall: ' + $_.Exception.Message)
  exit 1
}
