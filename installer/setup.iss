; Installateur de Feuillet v1.0 — Inno Setup 6
; Feuillet est un logiciel libre sous licence GPL v3 ou ultérieure (voir LICENSE).
; Compilation : npx tauri build --no-bundle, puis ISCC.exe installer\setup.iss
;
; Même AppId que la « Visionneuse Markdown » (ancien nom) : l'installation la remplace.

#define AppName      "Feuillet"
#define AppVersion   "1.0"
#define AppExe       "Feuillet.exe"
#define OldName      "Visionneuse Markdown"
#define OldExe       "VisionneuseMarkdown.exe"
#define ProgId       "Feuillet.md"
#define OldProgId    "VisionneuseMarkdown.md"
#define AppId        "{{6B3F2C1E-8D4A-4E7B-9C2F-5A1D0E3B7F42}"

[Setup]
; Langue proposée selon celle de Windows (anglais par défaut).
ShowLanguageDialog=auto
AppId={#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} v{#AppVersion}
VersionInfoVersion=1.0.0.0
VersionInfoProductVersion=1.0.0.0
VersionInfoDescription=Installateur {#AppName}
DefaultDirName={autopf}\{#AppName}
; Pas de réinstallation dans le dossier de l'ancien nom.
UsePreviousAppDir=no
UsePreviousGroup=no
AppPublisher=Les contributeurs de Feuillet
AppCopyright=Licence GPL v3
LicenseFile=..\LICENSE
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
; Installation pour l'utilisateur courant par défaut (pas besoin d'être administrateur),
; avec la possibilité de choisir « pour tous les utilisateurs ».
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=../release
OutputBaseFilename=Feuillet-v{#AppVersion}-setup
SetupIconFile=..\src-tauri\icons\icon.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName} v{#AppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ChangesAssociations=yes
CloseApplications=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[CustomMessages]
english.DesktopIcon=Create a desktop shortcut
english.Shortcuts=Shortcuts:
english.AssocMd=Open .md and .markdown files with %1
english.Association=File association:
english.DocType=Markdown document
english.SampleFile=example.md
english.Launch=Launch %1
english.WebView2Missing=The Microsoft Edge WebView2 component is not installed on this computer.%nIt is required to display the application (free download from Microsoft: "WebView2 Runtime").%n%nContinue the installation anyway?
french.DesktopIcon=Créer une icône sur le Bureau
french.Shortcuts=Raccourcis :
french.AssocMd=Ouvrir les fichiers .md et .markdown avec %1
french.Association=Association de fichiers :
french.DocType=Document Markdown
french.SampleFile=exemple.md
french.Launch=Lancer %1
french.WebView2Missing=Le composant Microsoft Edge WebView2 n'est pas installé sur cet ordinateur.%nIl est nécessaire pour afficher l'application (téléchargeable gratuitement sur le site de Microsoft : « WebView2 Runtime »).%n%nContinuer l'installation quand même ?

[Tasks]
Name: "desktopicon"; Description: "{cm:DesktopIcon}"; GroupDescription: "{cm:Shortcuts}"
Name: "assocmd"; Description: "{cm:AssocMd,{#AppName}}"; GroupDescription: "{cm:Association}"

[InstallDelete]
; Ancienne version (egui)
Type: files; Name: "{app}\md_viewer.exe"
; Ancien nom « Visionneuse Markdown » : dossier, raccourcis
Type: filesandordirs; Name: "{autopf}\{#OldName}"
Type: files; Name: "{autoprograms}\{#OldName}.lnk"
Type: files; Name: "{autodesktop}\{#OldName}.lnk"

[Files]
Source: "..\src-tauri\target\release\feuillet.exe"; DestDir: "{app}"; DestName: "{#AppExe}"; Flags: ignoreversion
; Chargeur WebView2 : compilé avec la chaîne GNU, l'exe en a besoin à côté de lui.
Source: "..\src-tauri\target\release\WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\LICENSE"; DestDir: "{app}"; DestName: "LICENSE.txt"; Flags: ignoreversion
; Document d'exemple dans la langue de l'installation
Source: "..\exemple.md"; DestDir: "{app}"; Languages: french; Flags: ignoreversion
Source: "..\example.md"; DestDir: "{app}"; Languages: english; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Registry]
; Nettoyage des anciennes versions (v0.1 et ancien nom « Visionneuse Markdown »)
Root: HKA; Subkey: "Software\Classes\Applications\md_viewer.exe"; Flags: deletekey dontcreatekey
Root: HKA; Subkey: "Software\Classes\Applications\{#OldExe}"; Flags: deletekey dontcreatekey
Root: HKA; Subkey: "Software\Classes\{#OldProgId}"; Flags: deletekey dontcreatekey
Root: HKA; Subkey: "Software\Classes\.md\OpenWithProgids"; ValueType: none; ValueName: "{#OldProgId}"; Flags: deletevalue dontcreatekey
Root: HKA; Subkey: "Software\Classes\.markdown\OpenWithProgids"; ValueType: none; ValueName: "{#OldProgId}"; Flags: deletevalue dontcreatekey
; Type de fichier « Document Markdown » géré par Feuillet
Root: HKA; Subkey: "Software\Classes\{#ProgId}"; ValueType: string; ValueName: ""; ValueData: "{cm:DocType}"; Flags: uninsdeletekey; Tasks: assocmd
Root: HKA; Subkey: "Software\Classes\{#ProgId}\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#AppExe},0"; Tasks: assocmd
Root: HKA; Subkey: "Software\Classes\{#ProgId}\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExe}"" ""%1"""; Tasks: assocmd
Root: HKA; Subkey: "Software\Classes\.md\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assocmd
Root: HKA; Subkey: "Software\Classes\.markdown\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assocmd
Root: HKA; Subkey: "Software\Classes\.md"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assocmd
Root: HKA; Subkey: "Software\Classes\.markdown"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assocmd
; Entrée « Ouvrir avec » dans l'explorateur
Root: HKA; Subkey: "Software\Classes\Applications\{#AppExe}\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExe}"" ""%1"""; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\Applications\{#AppExe}\SupportedTypes"; ValueType: string; ValueName: ".md"; ValueData: ""
Root: HKA; Subkey: "Software\Classes\Applications\{#AppExe}\SupportedTypes"; ValueType: string; ValueName: ".markdown"; ValueData: ""

[Run]
Filename: "{app}\{#AppExe}"; Parameters: """{app}\{cm:SampleFile}"""; Description: "{cm:Launch,{#AppName}}"; Flags: nowait postinstall skipifsilent

[Code]
// L'interface utilise WebView2 (le moteur d'Edge), présent sur tous les Windows 11.
// Sur un Windows 10 ancien, il peut manquer : on prévient au lieu d'échouer en silence.
function WebView2Installed(): Boolean;
var
  Version: String;
begin
  Result :=
    (RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0')) or
    (RegQueryStringValue(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0'));
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  if not WebView2Installed() then
    Result := MsgBox(CustomMessage('WebView2Missing'), mbConfirmation, MB_YESNO) = IDYES;
end;
