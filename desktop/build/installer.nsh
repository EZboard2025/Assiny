; Ramppy Desktop — Custom NSIS installer script
; Installs Visual C++ Redistributable if not already present

!macro customInstall
  ; Check if VC++ 2015-2022 Redistributable x64 is installed
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\X64" "Installed"
  ${If} $0 != "1"
    DetailPrint "Instalando Visual C++ Redistributable..."
    File /oname=$PLUGINSDIR\vc_redist.x64.exe "${BUILD_RESOURCES_DIR}\vc_redist.x64.exe"
    ExecWait '"$PLUGINSDIR\vc_redist.x64.exe" /install /quiet /norestart' $0
    DetailPrint "Visual C++ Redistributable instalado (codigo: $0)"
  ${Else}
    DetailPrint "Visual C++ Redistributable ja instalado."
  ${EndIf}
!macroend
