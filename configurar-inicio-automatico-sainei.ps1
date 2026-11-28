$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runner = Join-Path $root 'ejecutar-servidor-sainei.ps1'
$server = Join-Path $root 'server.js'
if (-not (Test-Path $runner)) { throw "No se encuentra el iniciador: $runner" }
if (-not (Test-Path $server)) { throw "No se encuentra server.js: $server" }
if (-not $env:LOCALAPPDATA) { throw 'No se encontro LOCALAPPDATA.' }
$data = Join-Path $env:LOCALAPPDATA 'SAINEI-POS\datos'
New-Item -ItemType Directory -Force -Path $data | Out-Null
$env:SAINEI_DATA = $data
$logOut = Join-Path $data 'servidor-salida.log'
$logErr = Join-Path $data 'servidor-error.log'
$uri = $null
function Get-SaineiServer {
  for ($port = 9000; $port -le 9010; $port++) {
    try {
      $response = Invoke-RestMethod -Uri ('http://127.0.0.1:' + $port + '/api/ping') -TimeoutSec 1
      if ($response.service -eq 'SAINEI_POS' -and $response.server -eq $true -and [int]$response.port -eq $port) { return $port }
    } catch {}
  }
  return $null
}

# Comprobar primero si ya existe un servidor SAINEI POS.
$alreadyRunning = [bool](Get-SaineiServer)

if (-not $alreadyRunning) {
  $node = Get-Command node.exe -ErrorAction Stop
  $version = (& $node.Source -p "process.versions.node").Trim()
  $parts = $version.Split('.')
  if ([int]$parts[0] -lt 22 -or ([int]$parts[0] -eq 22 -and [int]$parts[1] -lt 13)) {
    throw "Se requiere Node.js 22.13 o superior. Version detectada: $version"
  }
  # Arranque directo para que la instalacion inicial no dependa del Programador de tareas.
  $process = Start-Process -FilePath $node.Source -ArgumentList @('server.js') -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput $logOut -RedirectStandardError $logErr
  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 750
    if ($process.HasExited) {
      $details = ''
      if (Test-Path $logErr) { $details = Get-Content $logErr -Raw -ErrorAction SilentlyContinue }
      if (Test-Path (Join-Path $data 'servidor.log')) { $details += (Get-Content (Join-Path $data 'servidor.log') -Tail 30 -ErrorAction SilentlyContinue | Out-String) }
      throw "El servidor SAINEI POS se cerro al iniciar. Codigo: $($process.ExitCode). $details"
    }
    try {
      if (Get-SaineiServer) { $ready = $true; break }
    } catch {}
  }
  if (-not $ready) {
    $details = ''
    if (Test-Path $logErr) { $details = Get-Content $logErr -Raw -ErrorAction SilentlyContinue }
    if (Test-Path (Join-Path $data 'servidor.log')) { $details += (Get-Content (Join-Path $data 'servidor.log') -Tail 30 -ErrorAction SilentlyContinue | Out-String) }
    throw "SAINEI POS no respondio en http://localhost:9000/api/ping. Registro: $data. $details"
  }
}

# El inicio automatico se registra despues de comprobar el servidor.
try {
  $taskName = 'SAINEI POS - Servidor automatico'
  $powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $runner + '"'
  $action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory $root
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
  $principal = New-ScheduledTaskPrincipal -UserId ("{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME) -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Inicia el servidor SAINEI POS al iniciar sesion en esta PC.' -Force | Out-Null
  Write-Host 'Inicio automatico configurado.' -ForegroundColor Green
} catch {
  Write-Warning "El servidor funciona ahora, pero no se pudo configurar el inicio automatico: $($_.Exception.Message)"
}
# No se abrira una pagina que pueda pertenecer a otro programa: solo se abre tras validar SAINEI_POS.
Write-Host 'Comprobacion correcta: SAINEI POS responde en un puerto local disponible.' -ForegroundColor Green
Start-Process 'http://localhost:9000'
exit 0
