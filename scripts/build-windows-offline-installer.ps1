param(
  [switch]$SkipBuild,
  [string]$Configuration = "production"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Dist = Join-Path $Root "dist"
$ReleaseRoot = Join-Path $Root "release\windows"
$PackageName = "FXKONTROL-Windows-Offline"
$PackageDir = Join-Path $ReleaseRoot $PackageName
$AppDir = Join-Path $PackageDir "app"
$ZipPath = Join-Path $ReleaseRoot "$PackageName.zip"

function Write-Step($Message) {
  Write-Host "==> $Message" -ForegroundColor Cyan
}

if (-not $SkipBuild) {
  Write-Step "Building FXKONTROL web app for offline Windows package"
  Push-Location $Root
  try {
    npm run build
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $Dist)) {
  throw "dist folder not found. Run npm run build first or omit -SkipBuild."
}

Write-Step "Preparing package folder"
if (Test-Path $PackageDir) {
  Remove-Item -LiteralPath $PackageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $AppDir -Force | Out-Null
Copy-Item -Path (Join-Path $Dist "*") -Destination $AppDir -Recurse -Force

@'
param(
  [int]$Port = 48732,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$AppRoot = Join-Path $PSScriptRoot "app"
$Prefix = "http://127.0.0.1:$Port/"

function Get-ContentType([string]$Path) {
  switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8"; break }
    ".js"   { "text/javascript; charset=utf-8"; break }
    ".mjs"  { "text/javascript; charset=utf-8"; break }
    ".css"  { "text/css; charset=utf-8"; break }
    ".json" { "application/json; charset=utf-8"; break }
    ".png"  { "image/png"; break }
    ".jpg"  { "image/jpeg"; break }
    ".jpeg" { "image/jpeg"; break }
    ".svg"  { "image/svg+xml"; break }
    ".ico"  { "image/x-icon"; break }
    ".woff2"{ "font/woff2"; break }
    ".mp4"  { "video/mp4"; break }
    default { "application/octet-stream" }
  }
}

if (-not (Test-Path $AppRoot)) {
  throw "FXKONTROL offline app folder not found: $AppRoot"
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($Prefix)

try {
  $listener.Start()
} catch {
  Write-Host "FXKONTROL offline server could not start on $Prefix" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  throw
}

if (-not $NoBrowser) {
  Start-Process $Prefix
}

Write-Host "FXKONTROL offline running at $Prefix"
Write-Host "Close this window to stop the local offline server."

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $requestPath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($requestPath)) {
      $requestPath = "index.html"
    }

    $candidate = Join-Path $AppRoot $requestPath
    $fullPath = [IO.Path]::GetFullPath($candidate)
    $appRootFull = [IO.Path]::GetFullPath($AppRoot)

    if (-not $fullPath.StartsWith($appRootFull, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $fullPath -PathType Leaf)) {
      $fullPath = Join-Path $AppRoot "index.html"
    }

    try {
      $bytes = [IO.File]::ReadAllBytes($fullPath)
      $context.Response.StatusCode = 200
      $context.Response.ContentType = Get-ContentType $fullPath
      $context.Response.Headers.Add("Cache-Control", "no-store")
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      $message = [Text.Encoding]::UTF8.GetBytes("FXKONTROL offline server error")
      $context.Response.StatusCode = 500
      $context.Response.OutputStream.Write($message, 0, $message.Length)
    } finally {
      $context.Response.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
'@ | Set-Content -Path (Join-Path $PackageDir "launch-fxkontrol.ps1") -Encoding UTF8

@'
$ErrorActionPreference = "Stop"
$InstallDir = Join-Path $env:LOCALAPPDATA "FXKONTROL"
$SourceDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

if (-not (Test-Path (Join-Path $SourceDir "launch-fxkontrol.ps1"))) {
  throw "Run install.ps1 from the extracted FXKONTROL-Windows-Offline folder. Current source folder '$SourceDir' does not contain launch-fxkontrol.ps1."
}

if (Test-Path $InstallDir) {
  Remove-Item -LiteralPath $InstallDir -Recurse -Force
}
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Copy-Item -Path (Join-Path $SourceDir "*") -Destination $InstallDir -Recurse -Force

$ShortcutTargets = @(
  (Join-Path ([Environment]::GetFolderPath("Desktop")) "FXKONTROL Offline.lnk"),
  (Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs\FXKONTROL Offline.lnk")
)

$Wsh = New-Object -ComObject WScript.Shell
foreach ($ShortcutPath in $ShortcutTargets) {
  $Parent = Split-Path $ShortcutPath -Parent
  if (-not (Test-Path $Parent)) { New-Item -ItemType Directory -Path $Parent -Force | Out-Null }
  $Shortcut = $Wsh.CreateShortcut($ShortcutPath)
  $Shortcut.TargetPath = "powershell.exe"
  $Shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$InstallDir\launch-fxkontrol.ps1`""
  $Shortcut.WorkingDirectory = $InstallDir
  $Shortcut.IconLocation = "$InstallDir\app\favicon.ico"
  $Shortcut.Description = "FXKONTROL offline local app"
  $Shortcut.Save()
}

Write-Host "FXKONTROL Offline installed in $InstallDir" -ForegroundColor Green
Write-Host "Use the Desktop or Start Menu shortcut to launch."
'@ | Set-Content -Path (Join-Path $PackageDir "install.ps1") -Encoding UTF8

@'
$ErrorActionPreference = "Stop"
$InstallDir = Join-Path $env:LOCALAPPDATA "FXKONTROL"
$ShortcutTargets = @(
  (Join-Path ([Environment]::GetFolderPath("Desktop")) "FXKONTROL Offline.lnk"),
  (Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs\FXKONTROL Offline.lnk")
)
foreach ($ShortcutPath in $ShortcutTargets) {
  if (Test-Path $ShortcutPath) { Remove-Item -LiteralPath $ShortcutPath -Force }
}
if (Test-Path $InstallDir) {
  Remove-Item -LiteralPath $InstallDir -Recurse -Force
}
Write-Host "FXKONTROL Offline removed." -ForegroundColor Green
'@ | Set-Content -Path (Join-Path $PackageDir "uninstall.ps1") -Encoding UTF8

@"
FXKONTROL Windows Offline
=========================

Install:
  1. Extract this ZIP.
  2. Open PowerShell inside the extracted FXKONTROL-Windows-Offline folder.
  3. Run:
  powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1

Run without installing:
  powershell -NoProfile -ExecutionPolicy Bypass -File .\launch-fxkontrol.ps1

Notes:
  - Runs fully from local files through a 127.0.0.1 PowerShell HTTP server.
  - No internet is required after this package is generated.
  - Safety/hardware state remains governed by the app readiness and provenance layers.
"@ | Set-Content -Path (Join-Path $PackageDir "README-WINDOWS-OFFLINE.txt") -Encoding UTF8

Write-Step "Compressing offline installer zip"
if (Test-Path $ZipPath) {
  Remove-Item -LiteralPath $ZipPath -Force
}
Compress-Archive -Path (Join-Path $PackageDir "*") -DestinationPath $ZipPath -Force

Write-Host ""
Write-Host "Windows offline installer created:" -ForegroundColor Green
Write-Host "  $ZipPath"
