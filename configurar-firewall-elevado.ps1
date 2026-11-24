$ErrorActionPreference = 'Stop'
$script = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'configurar-firewall-sainei.ps1'
if (-not (Test-Path $script)) { throw "No se encuentra el script de firewall: $script" }
$argsLine = '-NoProfile -ExecutionPolicy Bypass -File "' + $script + '"'
$process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -ArgumentList $argsLine
if ($process.ExitCode -ne 0) { throw "La configuracion del firewall termino con codigo $($process.ExitCode)." }
