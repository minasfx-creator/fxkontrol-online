param(
  [switch]$SkipBuild,
  [switch]$OpenXcode
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$IosDir = Join-Path $Root "ios"

function Write-Step($Message) {
  Write-Host "==> $Message" -ForegroundColor Cyan
}

Push-Location $Root
try {
  if (-not $SkipBuild) {
    Write-Step "Building web assets for native iOS"
    npm run build
  }

  if (-not (Test-Path $IosDir)) {
    Write-Step "Creating Capacitor iOS native project"
    npx cap add ios
  } else {
    Write-Step "iOS project already exists"
  }

  Write-Step "Syncing Capacitor iOS native project"
  npx cap sync ios

  if ($OpenXcode) {
    Write-Step "Opening iOS project in Xcode"
    npx cap open ios
  }
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "iOS native project ready." -ForegroundColor Green
Write-Host "On macOS, open ios/App/App.xcworkspace in Xcode, set signing team, then Archive."
