param(
  [string]$CertDir = ".certs\bridge",
  [string]$DnsName = "fxk-relay.local",
  [string]$IpAddress = ""
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path "."
$fullCertDir = Join-Path $root $CertDir
New-Item -ItemType Directory -Force -Path $fullCertDir | Out-Null

$passphrasePath = Join-Path $fullCertDir "pfx-passphrase.txt"
if (Test-Path $passphrasePath) {
  $passphrase = (Get-Content $passphrasePath -Raw).Trim()
} else {
  $bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $passphrase = [Convert]::ToBase64String($bytes)
  Set-Content -Path $passphrasePath -Value $passphrase -Encoding ascii
}

if (-not $IpAddress) {
  $IpAddress = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    Select-Object -First 1 -ExpandProperty IPAddress)
}

$rootSubject = "CN=FXK Local Bridge Dev Root"
$leafSubject = "CN=FXK Local Bridge"
$rootCertPath = Join-Path $fullCertDir "fxk-local-root.cer"
$pfxPath = Join-Path $fullCertDir "fxk-local-bridge.pfx"
$securePassphrase = ConvertTo-SecureString -String $passphrase -Force -AsPlainText

$existingRoot = Get-ChildItem Cert:\CurrentUser\Root |
  Where-Object { $_.Subject -eq $rootSubject } |
  Sort-Object NotAfter -Descending |
  Select-Object -First 1

if (-not $existingRoot) {
  $existingRoot = New-SelfSignedCertificate `
    -Subject $rootSubject `
    -CertStoreLocation Cert:\CurrentUser\Root `
    -KeyAlgorithm RSA `
    -KeyLength 4096 `
    -KeyExportPolicy Exportable `
    -KeyUsage CertSign, CRLSign, DigitalSignature `
    -TextExtension @("2.5.29.19={critical}{text}ca=1&pathlength=1") `
    -NotAfter (Get-Date).AddYears(5)
}

Export-Certificate -Cert $existingRoot -FilePath $rootCertPath | Out-Null

Get-ChildItem Cert:\CurrentUser\My |
  Where-Object { $_.Subject -eq $leafSubject } |
  Remove-Item -Force -ErrorAction SilentlyContinue

$dnsNames = @($DnsName, "localhost")
$sanParts = @(
  "DNS=$DnsName",
  "DNS=localhost",
  "IPAddress=127.0.0.1"
)
if ($IpAddress) {
  $sanParts += "IPAddress=$IpAddress"
}

$leaf = New-SelfSignedCertificate `
  -Subject $leafSubject `
  -CertStoreLocation Cert:\CurrentUser\My `
  -Signer $existingRoot `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -KeyExportPolicy Exportable `
  -KeyUsage DigitalSignature, KeyEncipherment `
  -TextExtension @(
    "2.5.29.17={text}$($sanParts -join '&')",
    "2.5.29.37={text}1.3.6.1.5.5.7.3.1"
  ) `
  -NotAfter (Get-Date).AddYears(2)

Export-PfxCertificate -Cert $leaf -FilePath $pfxPath -Password $securePassphrase | Out-Null

Write-Host "Created bridge certificate:"
Write-Host "  PFX:  $pfxPath"
Write-Host "  Root: $rootCertPath"
Write-Host "  DNS:  $($dnsNames -join ', ')"
Write-Host "  IP:   127.0.0.1$($(if ($IpAddress) { ', ' + $IpAddress } else { '' }))"
Write-Host ""
Write-Host "Run the bridge with:"
Write-Host "  npm run bridge:local"
