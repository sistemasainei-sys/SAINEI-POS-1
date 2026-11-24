$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $env:LOCALAPPDATA) { throw 'No se encontro LOCALAPPDATA para guardar los datos del usuario.' }
$data = Join-Path $env:LOCALAPPDATA 'SAINEI-POS\datos'
New-Item -ItemType Directory -Force -Path $data | Out-Null
$env:SAINEI_DATA = $data
Set-Location $root
$node = (Get-Command node.exe -ErrorAction Stop).Source
& $node (Join-Path $root 'server.js')
if ($LASTEXITCODE -ne 0) { Add-Content -Path (Join-Path $data 'servidor-inicio.log') -Value "$(Get-Date -Format o) El servidor termino con codigo $LASTEXITCODE" }
