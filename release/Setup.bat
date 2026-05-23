@echo off
title FX KONTROL - Instalador
chcp 65001 >nul 2>&1

echo.
echo  ============================================
echo    FX KONTROL - Instalador Windows
echo    Coreografias de Fogos e Drones
echo  ============================================
echo.
echo  Iniciando instalacao...
echo.

PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-FXKontrol.ps1"

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo  [ERRO] Instalacao falhou. Verifique as mensagens acima.
  pause
)
