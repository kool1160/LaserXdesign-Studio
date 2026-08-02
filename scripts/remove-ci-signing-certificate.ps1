[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"
$thumbprint = $env:LASERX_CI_SIGNING_THUMBPRINT
if ([string]::IsNullOrWhiteSpace($thumbprint)) {
  Write-Output "No disposable CI signing certificate was registered."
  exit 0
}

$path = "Cert:\CurrentUser\My\$thumbprint"
if (Test-Path -LiteralPath $path) {
  Remove-Item -LiteralPath $path -Force
}
Write-Output "Removed disposable CI-only code-signing certificate $thumbprint."
