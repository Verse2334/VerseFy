; Kill any lingering Versefy.exe before the built-in "app is running" check fires.
; Fixes false-positive dialog on fresh installs caused by AV/SmartScreen holding a
; handle on the extracted exe, or orphan processes from a cancelled prior install.
!macro customInit
  nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
  Pop $R0
  ${If} $R0 = 0
    nsProcess::_KillProcess "${APP_EXECUTABLE_FILENAME}"
    Pop $R0
    Sleep 800
  ${EndIf}
!macroend
