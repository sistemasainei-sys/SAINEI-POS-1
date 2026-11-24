$ErrorActionPreference = 'Stop'
# Busca el servidor SAINEI POS activo en la red local sin pedir IP al usuario.
$port = 45808
$client = [System.Net.Sockets.UdpClient]::new()
$client.EnableBroadcast = $true
$client.Client.ReceiveTimeout = 3500
$client.Client.Bind([System.Net.IPEndPoint]::new([System.Net.IPAddress]::Any, 0))
$bytes = [System.Text.Encoding]::UTF8.GetBytes('SAINEI_POS_DISCOVER_V1')
$target = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Broadcast, $port)
try {
  [void]$client.Send($bytes, $bytes.Length, $target)
  $async = $client.BeginReceive($null, $null)
  if (-not $async.AsyncWaitHandle.WaitOne(3500)) { exit 1 }
  $remote = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Any, 0)
  $response = $client.EndReceive($async, [ref]$remote)
  $data = ([System.Text.Encoding]::UTF8.GetString($response) | ConvertFrom-Json)
  if ($data.service -ne 'SAINEI_POS' -or [int]$data.version -ne 1 -or [int]$data.port -lt 1) { exit 1 }
  $url = 'http://' + $remote.Address.IPAddressToString + ':' + [int]$data.port
  Write-Output $url
  exit 0
} catch { exit 1 } finally { $client.Dispose() }
