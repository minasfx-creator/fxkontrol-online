; FX KONTROL NSIS custom installer script
; Enables WebGPU flags via registry on install

!macro customInstall
  ; Enable WebGPU experimental features for Electron (Chromium)
  WriteRegStr HKCU "Software\FX KONTROL" "Installed" "1"
  WriteRegStr HKCU "Software\FX KONTROL" "Version" "${VERSION}"
!macroend

!macro customUninstall
  DeleteRegKey HKCU "Software\FX KONTROL"
!macroend
