; AgentSuiteLocal Inno Setup installer script
; Build with: iscc installer\AgentSuiteLocal.iss
; Requires: Inno Setup 6 (https://jrsoftware.org/isinfo.php)

#define MyAppName "AgentSuiteLocal"
#define MyAppVersion "0.7.0"
#define MyAppPublisher "Scott Converse"
#define MyAppURL "https://github.com/scottconverse/AgentSuiteLocal"
#define MyAppExeName "AgentSuiteLocal.exe"
#define MyOutputDir "..\dist"
#define MySourceDir "..\dist\AgentSuiteLocal"

[Setup]
; Unique AppId — do NOT change after first release (controls uninstall detection)
AppId={{8F2A4B1C-3D7E-4A5F-9B8C-2E1D6F0A3C4B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=..\LICENSE
OutputDir={#MyOutputDir}
OutputBaseFilename={#MyAppName}-{#MyAppVersion}-setup
SetupIconFile=..\agentsuitelocal\assets\icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
; Require admin for Program Files installation
PrivilegesRequired=admin
; Minimum Windows version: Windows 10 (6.2 = Win 8 minimum for winotify; 10.0 required for modern shell)
MinVersion=10.0
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startupentry"; Description: "Start AgentSuiteLocal when Windows starts"; GroupDescription: "Startup:"; Flags: unchecked

[Files]
; Main application directory (PyInstaller onedir output)
Source: "{#MySourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; LICENSE in install root for reference
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
; Add to startup if user chose the startup task
Root: HKCU; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "{#MyAppName}"; ValueData: """{app}\{#MyAppExeName}"""; Flags: uninsdeletevalue; Tasks: startupentry

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; A6: On uninstall, call the built-in uninstall endpoint to stop the backend gracefully
Filename: "powershell.exe"; Parameters: "-NonInteractive -Command ""try {{ Invoke-RestMethod -Method POST -Uri 'http://127.0.0.1:8765/api/uninstall' -TimeoutSec 5 }} catch {{ }}"" "; Flags: runhidden

[Code]
// A6: Check if AgentSuiteLocal is running and offer to close it before uninstall
function InitializeUninstall(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
  if Exec('tasklist', '/FI "IMAGENAME eq AgentSuiteLocal.exe" /NH', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then begin
    if ResultCode = 0 then begin
      if MsgBox('AgentSuiteLocal is currently running. Close it before uninstalling?', mbConfirmation, MB_YESNO) = IDYES then begin
        Exec('taskkill', '/F /IM AgentSuiteLocal.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
        Sleep(1500);
      end;
    end;
  end;
end;
