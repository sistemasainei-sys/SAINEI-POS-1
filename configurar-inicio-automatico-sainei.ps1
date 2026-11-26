$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runner = Join-Path $root 'ejecutar-servidor-sainei.ps1'
if (-not (Test-Path $runner)) { throw "No se encuentra el iniciador: $runner" }
$node = Get-Command node.exe -ErrorAction Stop
$version = (& $node.Source -p "process.versions.node").Trim()
$parts = $version.Split('.')
if ([int]$parts[0] -lt 22 -or ([int]$parts[0] -eq 22 -and [int]$parts[1] -lt 13)) { throw "Se requiere Node.js 22.13 o superior. Version detectada: $version" }
$taskName = 'SAINEI POS - Servidor automatico'
$powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $runner + '"'
$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId ("{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Inicia el servidor SAINEI POS al iniciar sesion en esta PC.' -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host 'Inicio automatico de SAINEI POS configurado para este usuario.' -ForegroundColor Green
Write-Host 'El servidor se iniciara al iniciar sesion en Windows.'
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try { $client = [System.Net.Sockets.TcpClient]::new(); $client.Connect('127.0.0.1',8090); $client.Dispose(); $ready = $true; break } catch { Start-Sleep -Seconds 1 }
}
if ($ready) { Start-Process 'http://localhost:8090' } else { Write-Warning 'El servidor aun no responde en el puerto 8090. Revisa el registro de SAINEI POS.' }
