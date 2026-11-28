$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $env:LOCALAPPDATA) { throw 'No se encontro LOCALAPPDATA para guardar los datos del usuario.' }
$data = Join-Path $env:LOCALAPPDATA 'SAINEI-POS\datos'
New-Item -ItemType Directory -Force -Path $data | Out-Null
$env:SAINEI_DATA = $data
Set-Location $root
$node = (Get-Command node.exe -ErrorAction Stop).Source
function Test-SaineiServer {
  for ($port = 9000; $port -le 9010; $port++) {
    try {
      $response = Invoke-RestMethod -Uri ('http://127.0.0.1:' + $port + '/api/ping') -TimeoutSec 1
      if ($response.service -eq 'SAINEI_POS' -and $response.server -eq $true -and [int]$response.port -eq $port) { return $true }
    } catch {}
  }
  return $false
}

# La tarea programada y el acceso directo pueden ejecutarse casi al mismo tiempo.
# Si SAINEI POS ya esta escuchando, reutilizarlo: nunca iniciar una segunda copia.
if (Test-SaineiServer) {
  Add-Content -Path (Join-Path $data 'servidor-inicio.log') -Value "$(Get-Date -Format o) SAINEI POS ya estaba activo; se reutiliza la instancia existente."
  exit 0
}

& $node (Join-Path $root 'server.js')
$exitCode = $LASTEXITCODE

# Si otra instancia gano la carrera y ocupo el puerto mientras Node arrancaba,
# confirmar su identidad antes de considerar que el servicio esta disponible.
if ($exitCode -ne 0) {
  for ($i = 0; $i -lt 8; $i++) {
    Start-Sleep -Milliseconds 750
    if (Test-SaineiServer) {
      Add-Content -Path (Join-Path $data 'servidor-inicio.log') -Value "$(Get-Date -Format o) Otra instancia SAINEI POS inicio primero; se reutiliza la instancia activa."
      exit 0
    }
  }
  Add-Content -Path (Join-Path $data 'servidor-inicio.log') -Value "$(Get-Date -Format o) El servidor termino con codigo $exitCode y no se encontro una instancia SAINEI POS activa."
  exit $exitCode
}
