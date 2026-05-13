# Returns the first LAN IPv4 (Wi-Fi / Ethernet), skipping virtual adapters.
$ip = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.PrefixOrigin -eq 'Dhcp' -and
        $_.IPAddress -notlike '169.*' -and
        $_.InterfaceAlias -notmatch 'Virtual|vEthernet|WSL|Loopback|Hyper-V'
    } |
    Sort-Object -Property @{ Expression = { $_.InterfaceAlias -match 'Wi-?Fi' }; Descending = $true } |
    Select-Object -First 1 -ExpandProperty IPAddress

if (-not $ip) {
    $ip = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.*' } |
        Select-Object -First 1 -ExpandProperty IPAddress
}

Write-Output $ip
