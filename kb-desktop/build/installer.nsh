; =====================================================================
; Customização do instalador NSIS (electron-builder injeta este arquivo)
; Adiciona uma página "Atalhos" com a opção de criar atalho na Área de
; Trabalho. createDesktopShortcut está false no package.json — o atalho
; é criado (e removido na desinstalação) exclusivamente por aqui.
; =====================================================================

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; O uninstaller compila este mesmo arquivo sem a página customizada —
; declarar as variáveis lá geraria warning "never set" (tratado como erro).
!ifndef BUILD_UNINSTALLER
  Var DesktopShortcutCheckbox
  Var DesktopShortcutState
!endif

!macro customPageAfterChangeDir
  Page custom shortcutsPageCreate shortcutsPageLeave

  Function shortcutsPageCreate
    !insertmacro MUI_HEADER_TEXT "Atalhos" "Escolha os atalhos que deseja criar"
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}
    ${NSD_CreateCheckbox} 0u 20u 100% 12u "Criar atalho na Área de Trabalho"
    Pop $DesktopShortcutCheckbox
    ${NSD_Check} $DesktopShortcutCheckbox
    nsDialogs::Show
  FunctionEnd

  Function shortcutsPageLeave
    ${NSD_GetState} $DesktopShortcutCheckbox $DesktopShortcutState
  FunctionEnd
!macroend

!macro customInstall
  ${If} $DesktopShortcutState == 1
    CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ${EndIf}
!macroend

!macro customUnInstall
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
!macroend
