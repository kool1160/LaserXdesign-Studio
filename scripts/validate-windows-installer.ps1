[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$UpgradeFixtureInstaller,
  [Parameter(Mandatory = $true)]
  [string]$CurrentInstaller,
  [Parameter(Mandatory = $true)]
  [string]$ExpectedVersion
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "authenticode-policy.ps1")

if ($env:CI -ne "true" -and $env:LASERX_ALLOW_INSTALL_TEST -ne "1") {
  throw "Installer validation changes the current user's installed applications. Run only on an isolated CI user or set LASERX_ALLOW_INSTALL_TEST=1 explicitly."
}

$upgradeInstallerPath = (Resolve-Path -LiteralPath $UpgradeFixtureInstaller).Path
$currentInstallerPath = (Resolve-Path -LiteralPath $CurrentInstaller).Path
$productName = "LaserX Design Studio"
$executableName = "$productName.exe"
$uninstallerName = "Uninstall $productName.exe"
$startMenuShortcut = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs\$productName.lnk"
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "$productName.lnk"
$userDataPath = Join-Path ([Environment]::GetFolderPath("ApplicationData")) $productName
$sentinelPath = Join-Path $userDataPath "m13-upgrade-preservation.txt"
$signingPolicy = Get-LaserxSigningPolicy

function Invoke-Installer {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [switch]$DesktopShortcut
  )
  $arguments = @("/currentuser", "/S")
  if ($DesktopShortcut) {
    $arguments += "--desktop-shortcut"
  }
  $process = Start-Process -FilePath $Path -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
  if ($process.ExitCode -ne 0) {
    throw "Installer failed with exit code $($process.ExitCode): $Path"
  }
}

function Get-InstallEntry {
  $entry = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" |
    Where-Object { $_.DisplayName -eq $productName } |
    Select-Object -First 1
  if ($null -eq $entry) {
    throw "The $productName uninstall registry entry was not created."
  }
  return $entry
}

function Get-InstalledExecutable {
  $path = Join-Path (Split-Path -Parent (Get-UninstallerPath)) $executableName
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "The installed executable is missing: $path"
  }
  return $path
}

function Get-UninstallerPath {
  $entry = Get-InstallEntry
  foreach ($propertyName in @("QuietUninstallString", "UninstallString")) {
    $property = $entry.PSObject.Properties[$propertyName]
    if ($null -eq $property -or [string]::IsNullOrWhiteSpace([string]$property.Value)) {
      continue
    }
    $command = [Environment]::ExpandEnvironmentVariables([string]$property.Value)
    $path = $null
    if ($command -match '^\s*"(?<path>[^"]+\.exe)"') {
      $path = $Matches.path
    }
    elseif ($command -match '^\s*(?<path>.+?\.exe)(?:\s|$)') {
      $path = $Matches.path
    }
    if ($null -ne $path -and (Test-Path -LiteralPath $path -PathType Leaf)) {
      return $path
    }
  }
  throw "The $uninstallerName path is missing from the uninstall registry entry."
}

function Invoke-Uninstaller {
  param([switch]$DeleteAppData)
  $uninstaller = Get-UninstallerPath
  $arguments = @("/currentuser", "/S")
  if ($DeleteAppData) {
    $arguments += "--delete-app-data"
  }
  $process = Start-Process -FilePath $uninstaller -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
  if ($process.ExitCode -ne 0) {
    throw "Uninstaller failed with exit code $($process.ExitCode): $uninstaller"
  }
}

function Assert-Signed {
  param([Parameter(Mandatory = $true)][string]$Path)
  $signature = Get-AuthenticodeSignature -LiteralPath $Path
  Assert-LaserxAuthenticodeSignature -Signature $signature -Path $Path -Policy $signingPolicy | Out-Null
}

function Assert-AppLaunch {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Label
  )
  $launched = Start-Process -FilePath $Path -PassThru
  try {
    $windowReady = $false
    for ($attempt = 0; $attempt -lt 100; $attempt += 1) {
      Start-Sleep -Milliseconds 100
      $launched.Refresh()
      if ($launched.HasExited) {
        throw "$Label exited before the main window appeared."
      }
      if ($launched.MainWindowHandle -ne 0) {
        $windowReady = $true
        break
      }
    }
    if (-not $windowReady) {
      throw "$Label did not show a main window within 10 seconds."
    }
  }
  finally {
    if (-not $launched.HasExited) {
      Stop-Process -Id $launched.Id -Force
      $launched.WaitForExit(5000) | Out-Null
    }
  }
}

try {
  Remove-Item Env:LASERX_USER_DATA_PATH -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $userDataPath) {
    throw "Installer validation requires a clean application-data root, but one already exists: $userDataPath"
  }
  Assert-Signed -Path $upgradeInstallerPath
  Assert-Signed -Path $currentInstallerPath
  Invoke-Installer -Path $upgradeInstallerPath
  if (Test-Path -LiteralPath $desktopShortcut) {
    throw "A fresh silent install created the optional desktop shortcut without selection."
  }

  $upgradeExecutable = Get-InstalledExecutable
  Assert-Signed -Path $upgradeExecutable
  Assert-AppLaunch -Path $upgradeExecutable -Label "The clean-installed upgrade fixture"
  foreach ($runtimeDirectory in @("session", "logs", "crash-dumps")) {
    $runtimePath = Join-Path $userDataPath $runtimeDirectory
    if (-not (Test-Path -LiteralPath $runtimePath -PathType Container)) {
      throw "The clean-installed application did not create its default runtime directory: $runtimePath"
    }
  }
  Set-Content -LiteralPath $sentinelPath -Value "preserve across upgrade and default uninstall" -Encoding utf8NoBOM

  Invoke-Installer -Path $currentInstallerPath -DesktopShortcut
  $entry = Get-InstallEntry
  if ([string]$entry.DisplayVersion -cne $ExpectedVersion) {
    throw "The installed display version does not match the M13 beta: $($entry.DisplayVersion)"
  }
  $installedExecutable = Get-InstalledExecutable
  Assert-Signed -Path $installedExecutable
  foreach ($shortcut in @($startMenuShortcut, $desktopShortcut)) {
    if (-not (Test-Path -LiteralPath $shortcut -PathType Leaf)) {
      throw "Expected shortcut is missing: $shortcut"
    }
  }
  if (-not (Test-Path -LiteralPath $sentinelPath -PathType Leaf)) {
    throw "Upgrade removed existing per-user data."
  }

  Assert-AppLaunch -Path $startMenuShortcut -Label "The Start Menu launch"

  $env:LASERX_INSTALLED_EXECUTABLE_PATH = $installedExecutable
  $env:LASERX_EXPECTED_USER_DATA_PATH = $userDataPath
  & pnpm.cmd --filter @laserx/desktop exec playwright test tests/e2e/m13-installed-beta.spec.ts
  if ($LASTEXITCODE -ne 0) {
    throw "The clean-installed primary workflow failed."
  }
  foreach ($relativePath in @(
      "recent-projects.json",
      "credentials\ai-provider.json",
      "logs\main.log",
      "session",
      "crash-dumps"
    )) {
    $createdPath = Join-Path $userDataPath $relativePath
    if (-not (Test-Path -LiteralPath $createdPath)) {
      throw "The clean-installed application did not create expected user data: $createdPath"
    }
  }

  Invoke-Uninstaller
  foreach ($shortcut in @($startMenuShortcut, $desktopShortcut)) {
    if (Test-Path -LiteralPath $shortcut) {
      throw "Uninstall left a shortcut behind: $shortcut"
    }
  }
  foreach ($relativePath in @(
      "m13-upgrade-preservation.txt",
      "recent-projects.json",
      "credentials\ai-provider.json",
      "logs\main.log",
      "session",
      "crash-dumps"
    )) {
    $preservedPath = Join-Path $userDataPath $relativePath
    if (-not (Test-Path -LiteralPath $preservedPath)) {
      throw "Default uninstall removed application-created user data: $preservedPath"
    }
  }

  Invoke-Installer -Path $currentInstallerPath
  Invoke-Uninstaller -DeleteAppData
  if (Test-Path -LiteralPath $userDataPath) {
    throw "Explicit remove-user-data uninstall left the LaserX user-data directory behind."
  }

  Write-Output "M13 installer validation passed: signed upgrade, Start Menu launch, optional desktop shortcut, installed primary workflow, clean uninstall, and explicit user-data removal."
}
finally {
  Remove-Item Env:LASERX_INSTALLED_EXECUTABLE_PATH -ErrorAction SilentlyContinue
  Remove-Item Env:LASERX_EXPECTED_USER_DATA_PATH -ErrorAction SilentlyContinue
  try {
    if ($null -ne (Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -eq $productName } |
        Select-Object -First 1)) {
      Invoke-Uninstaller -DeleteAppData
    }
  }
  catch {
    Write-Warning "Final installer cleanup failed: $($_.Exception.Message)"
  }
}
