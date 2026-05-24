#Requires -Version 5.1
<#
.SYNOPSIS
  FX KONTROL — Instalador para Windows
  Copia os arquivos para Arquivos de Programas e cria atalhos.
#>

param(
  [string]$InstallDir = "$env:ProgramFiles\FX KONTROL"
)

# ── Verifica se rodou como Administrador ──────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $isAdmin) {
  Write-Host "`n[FX KONTROL] Relancando como Administrador...`n" -ForegroundColor Yellow
  Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
  exit
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   FX KONTROL - Instalador Windows      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$source = Join-Path $PSScriptRoot "win-unpacked"

if (-not (Test-Path $source)) {
  Write-Host "[ERRO] Pasta 'win-unpacked' nao encontrada em: $PSScriptRoot" -ForegroundColor Red
  Write-Host "       Certifique-se de extrair o ZIP completo antes de instalar." -ForegroundColor Red
  Read-Host "Pressione Enter para sair"
  exit 1
}

Write-Host "Destino da instalacao: $InstallDir" -ForegroundColor White
Write-Host ""

# ── Criar diretório de instalação ─────────────────────────────────────
if (-not (Test-Path $InstallDir)) {
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}

# ── Copiar arquivos ───────────────────────────────────────────────────
Write-Host "[1/4] Copiando arquivos..." -ForegroundColor Green
try {
  Copy-Item -Path "$source\*" -Destination $InstallDir -Recurse -Force
  Write-Host "      OK — $(((Get-ChildItem $InstallDir -Recurse -File).Count)) arquivos copiados" -ForegroundColor Gray
} catch {
  Write-Host "[ERRO] Falha ao copiar arquivos: $_" -ForegroundColor Red
  Read-Host "Pressione Enter para sair"
  exit 1
}

$exePath = Join-Path $InstallDir "FX KONTROL.exe"

# ── Atalho na Área de Trabalho ────────────────────────────────────────
Write-Host "[2/4] Criando atalho na Area de Trabalho..." -ForegroundColor Green
try {
  $desktopPath = [Environment]::GetFolderPath("CommonDesktopDirectory")
  $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut("$desktopPath\FX KONTROL.lnk")
  $shortcut.TargetPath   = $exePath
  $shortcut.WorkingDirectory = $InstallDir
  $shortcut.Description  = "FX KONTROL - Plataforma de Shows Pirotecnicos e Drones"
  $shortcut.IconLocation = $exePath
  $shortcut.Save()
  Write-Host "      OK — $desktopPath\FX KONTROL.lnk" -ForegroundColor Gray
} catch {
  Write-Host "      AVISO: nao foi possivel criar atalho na area de trabalho" -ForegroundColor Yellow
}

# ── Atalho no Menu Iniciar ────────────────────────────────────────────
Write-Host "[3/4] Criando atalho no Menu Iniciar..." -ForegroundColor Green
try {
  $startMenuPath = Join-Path ([Environment]::GetFolderPath("CommonPrograms")) "FX KONTROL"
  if (-not (Test-Path $startMenuPath)) { New-Item -ItemType Directory -Force -Path $startMenuPath | Out-Null }
  $shortcut2 = (New-Object -ComObject WScript.Shell).CreateShortcut("$startMenuPath\FX KONTROL.lnk")
  $shortcut2.TargetPath   = $exePath
  $shortcut2.WorkingDirectory = $InstallDir
  $shortcut2.Description  = "FX KONTROL - Plataforma de Shows Pirotecnicos e Drones"
  $shortcut2.IconLocation = $exePath
  $shortcut2.Save()
  Write-Host "      OK — $startMenuPath" -ForegroundColor Gray
} catch {
  Write-Host "      AVISO: nao foi possivel criar atalho no Menu Iniciar" -ForegroundColor Yellow
}

# ── Registrar no Adicionar/Remover Programas ─────────────────────────
Write-Host "[4/4] Registrando no Sistema (Adicionar/Remover Programas)..." -ForegroundColor Green
try {
  $regKey      = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\FXKontrol"
  $desktopDir  = [Environment]::GetFolderPath('CommonDesktopDirectory')
  $programsDir = [Environment]::GetFolderPath('CommonPrograms')
  $uninstallCmd = "powershell -Command ""Remove-Item -Recurse -Force '$InstallDir'; Remove-Item -Force '$desktopDir\FX KONTROL.lnk' -ErrorAction SilentlyContinue; Remove-Item -Recurse -Force '$programsDir\FX KONTROL' -ErrorAction SilentlyContinue; Remove-ItemProperty HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\FXKontrol -Name * -ErrorAction SilentlyContinue"""
  New-Item -Path $regKey -Force | Out-Null
  Set-ItemProperty $regKey -Name "DisplayName"      -Value "FX KONTROL"
  Set-ItemProperty $regKey -Name "DisplayVersion"   -Value "1.0.0"
  Set-ItemProperty $regKey -Name "Publisher"        -Value "FX KONTROL"
  Set-ItemProperty $regKey -Name "InstallLocation"  -Value $InstallDir
  Set-ItemProperty $regKey -Name "DisplayIcon"      -Value $exePath
  Set-ItemProperty $regKey -Name "UninstallString"  -Value $uninstallCmd
  Set-ItemProperty $regKey -Name "EstimatedSize"    -Value 180000
  Write-Host "      OK" -ForegroundColor Gray
} catch {
  Write-Host "      AVISO: registro opcional falhou (app funciona normalmente)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Instalacao concluida com sucesso!    " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Instalado em: $InstallDir" -ForegroundColor White
Write-Host "   Use o atalho 'FX KONTROL' na Area de Trabalho para iniciar." -ForegroundColor White
Write-Host ""

$launch = Read-Host "Deseja abrir o FX KONTROL agora? (S/N)"
if ($launch -match '^[Ss]') {
  Start-Process $exePath
}
