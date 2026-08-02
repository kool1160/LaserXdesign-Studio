!include "LogicLib.nsh"
!include "nsDialogs.nsh"

!ifndef BUILD_UNINSTALLER
Var LaserXDesktopShortcutCheckbox
Var LaserXDesktopShortcutRequested

Function laserxInstallOptionsPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 28u "Choose the shortcuts to create. LaserX always adds a Start Menu shortcut."
  Pop $0
  ${NSD_CreateCheckbox} 0 38u 100% 12u "Create a desktop shortcut"
  Pop $LaserXDesktopShortcutCheckbox
  ${If} $LaserXDesktopShortcutRequested == "1"
    ${NSD_Check} $LaserXDesktopShortcutCheckbox
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function laserxInstallOptionsPageLeave
  ${NSD_GetState} $LaserXDesktopShortcutCheckbox $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $LaserXDesktopShortcutRequested "1"
  ${Else}
    StrCpy $LaserXDesktopShortcutRequested "0"
  ${EndIf}
FunctionEnd

!macro customInit
  StrCpy $LaserXDesktopShortcutRequested "0"

  ${If} ${FileExists} "$DESKTOP\${SHORTCUT_NAME}.lnk"
    StrCpy $LaserXDesktopShortcutRequested "1"
  ${EndIf}

  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "--desktop-shortcut" $R1
  ${IfNot} ${Errors}
    StrCpy $LaserXDesktopShortcutRequested "1"
  ${EndIf}
!macroend

!macro customPageAfterChangeDir
  !insertmacro skipPageIfUpdated
  Page custom laserxInstallOptionsPageCreate laserxInstallOptionsPageLeave
!macroend

!macro customInstall
  ${If} $LaserXDesktopShortcutRequested == "1"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  ${Else}
    WinShell::UninstShortcut "$newDesktopLink"
    Delete "$newDesktopLink"
  ${EndIf}
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend

!else

!macro customUnInstall
  WinShell::UninstShortcut "$newDesktopLink"
  Delete "$newDesktopLink"

  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "--delete-app-data" $R1
  ${IfNot} ${Errors}
    RMDir /r "$APPDATA\LaserX Design Studio"
  ${EndIf}
!macroend

!macro customUnInstallSection
  Section /o "Also remove LaserX settings, credentials, recovery, logs, and caches" LASERX_REMOVE_USER_DATA
    SetShellVarContext current
    RMDir /r "$APPDATA\LaserX Design Studio"
  SectionEnd
!macroend
!endif
