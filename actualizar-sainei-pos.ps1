[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][string]$Target
)
$ErrorActionPreference = 'Stop'
$taskName = 'SAINEI POS - Servidor automatico'
$sourcePath = [IO.Path]::GetFullPath($Source.Trim('"'))
$targetPath = [IO.Path]::GetFullPath($Target)
if (-not $env:LOCALAPPDATA) { throw 'No se encontro LOCALAPPDATA.' }
$dataPath = Join-Path $env:LOCALAPPDATA 'SAINEI-POS\datos'
$backupRoot = Join-Path $env:LOCALAPPDATA 'SAINEI-POS\actualizaciones'
if (-not (Test-Path (Join-Path $sourcePath 'server.js'))) { throw 'La carpeta nueva no contiene server.js.' }
if (-not (Test-Path (Join-Path $sourcePath 'index.html')) -and -not (Test-Path (Join-Path $sourcePath 'app\index.html'))) { throw 'La carpeta nueva no contiene index.html ni app\index.html.' }
if ($sourcePath.TrimEnd('\') -eq $targetPath.TrimEnd('\')) { throw 'La carpeta de origen debe ser distinta de la instalacion actual.' }
if (-not (Test-Path (Join-Path $targetPath 'server.js'))) { throw 'No se encontro una instalacion SAINEI POS en la carpeta de destino.' }
if (-not $env:LOCALAPPDATA) { throw 'No se encontro LOCALAPPDATA.' }

New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
if (Test-Path $dataPath) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backupPath = Join-Path $backupRoot ('datos-antes-de-actualizar-' + $stamp)
  New-Item -ItemType Directory -Force -Path $backupPath | Out-Null
}

Write-Host 'Deteniendo el inicio automatico de SAINEI POS...'
try { Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue } catch {}
Start-Sleep -Seconds 2

# Detener solo procesos Node que ejecuten el server.js de esta instalacion.
$escapedTarget = [regex]::Escape($targetPath.TrimEnd('\'))
$nodeProcesses = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
  $_.CommandLine -and $_.CommandLine -match 'server\.js' -and $_.CommandLine -match $escapedTarget
}
foreach ($proc in $nodeProcesses) {
  Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

if (Test-Path $dataPath) {
  Write-Host 'Creando copia completa de los datos antes de actualizar...'
  Get-ChildItem -LiteralPath $dataPath -Force | Copy-Item -Destination $backupPath -Recurse -Force
  if (-not (Test-Path (Join-Path $backupPath 'sainei.db'))) { throw 'No se encontro sainei.db en la copia previa. Actualizacion cancelada.' }
  Write-Host ('Copia previa: ' + $backupPath) -ForegroundColor Green
} else {
  Write-Warning 'Todavia no existe la carpeta de datos; no se encontro una base para respaldar.'
}

Write-Host 'Copiando archivos nuevos sin tocar datos, configuraciones locales ni repositorio...'
$excludeDirs = @('datos','datos-prueba','.git','node_modules')
$excludeFiles = @('.env','.env.local','.env.production')
$robocopyArgs = @($sourcePath, $targetPath, '/E','/COPY:DAT','/DCOPY:DAT','/R:2','/W:2','/XJ','/XF') + $excludeFiles + @('/XD') + $excludeDirs
& robocopy.exe @robocopyArgs
$copyCode = $LASTEXITCODE
if ($copyCode -ge 8) {
  throw "Robocopy informo un error (codigo $copyCode). La copia de datos previa permanece guardada."
}

Write-Host 'Actualizando tarea de inicio automatico...'
$setup = Join-Path $targetPath 'configurar-inicio-automatico-sainei.ps1'
if (Test-Path $setup) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $setup
  if ($LASTEXITCODE -ne 0) { throw 'Los archivos se copiaron, pero no se pudo reconfigurar el inicio automatico.' }
} else {
  Write-Warning 'No se encontro el configurador de inicio automatico.'
}
Write-Host 'Actualizacion de archivos finalizada. No se realizaron pruebas funcionales.' -ForegroundColor Green
