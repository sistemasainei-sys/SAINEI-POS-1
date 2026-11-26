# Ejecutar PowerShell como Administrador en la PC principal.
# Requiere Tailscale instalado y conectado en esta PC y en los dispositivos autorizados.
# No abre puertos en el router ni publica SAINEI POS en internet.
$ErrorActionPreference = 'Stop'
$ruleName = 'SAINEI POS - Acceso remoto Tailscale'
$port = 9000
try {
  $adapters = @(Get-NetAdapter -IncludeHidden | Where-Object {
    $_.Status -eq 'Up' -and ($_.Name -match 'Tailscale' -or $_.InterfaceDescription -match 'Tailscale')
  })
  if ($adapters.Count -ne 1) {
    throw 'No se encontro exactamente una interfaz Tailscale activa. Instala/inicia Tailscale y vuelve a ejecutar este script.'
  }
  $adapter = $adapters[0]
  $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
  if ($existing) { Remove-NetFirewallRule -DisplayName $ruleName }
  New-NetFirewallRule -DisplayName $ruleName `
    -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port `
    -Profile Any -InterfaceAlias $adapter.Name -RemoteAddress '100.64.0.0/10' `
    -Description 'SAINEI POS: permite TCP 9000 solo por la interfaz Tailscale y direcciones privadas del tailnet.' | Out-Null
  Write-Host ('Acceso remoto habilitado por Tailscale en la interfaz: ' + $adapter.Name) -ForegroundColor Green
  Write-Host 'En el dispositivo remoto abre http://IP-TAILSCALE-DE-LA-PC-PRINCIPAL:9000'
  Write-Host 'No abras TCP 9000 en el router. Protege el tailnet y autoriza solo tus propios dispositivos.'
} catch {
  Write-Error ('No se pudo configurar el acceso remoto: ' + $_.Exception.Message)
  exit 1
}
