[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($env:CI -ne "true" -or [string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) {
  throw "The disposable signing certificate may be created only on an isolated CI runner."
}
if ([string]::IsNullOrWhiteSpace($env:GITHUB_ENV)) {
  throw "GITHUB_ENV is required to pass the disposable certificate to later workflow steps."
}

$passwordText = [Guid]::NewGuid().ToString("N")
$password = ConvertTo-SecureString $passwordText -AsPlainText -Force
$pfxPath = Join-Path $env:RUNNER_TEMP "laserx-ci-signing.pfx"
$cerPath = Join-Path $env:RUNNER_TEMP "laserx-ci-signing.cer"
$certificate = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=LaserX Design Studio CI Test Signing" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyAlgorithm RSA `
  -KeyLength 3072 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddDays(7)

Export-PfxCertificate -Cert $certificate -FilePath $pfxPath -Password $password | Out-Null
Export-Certificate -Cert $certificate -FilePath $cerPath | Out-Null
Import-Certificate -FilePath $cerPath -CertStoreLocation "Cert:\CurrentUser\Root" | Out-Null

Add-Content -LiteralPath $env:GITHUB_ENV -Value "WIN_CSC_LINK=$pfxPath"
Add-Content -LiteralPath $env:GITHUB_ENV -Value "WIN_CSC_KEY_PASSWORD=$passwordText"
Add-Content -LiteralPath $env:GITHUB_ENV -Value "LASERX_CI_SIGNING_THUMBPRINT=$($certificate.Thumbprint)"
Write-Output "Created and trusted disposable CI-only code-signing certificate $($certificate.Thumbprint)."
