$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "authenticode-policy.ps1")

$originalCiThumbprint = $env:LASERX_CI_SIGNING_THUMBPRINT
$originalProductionThumbprint = $env:LASERX_EXPECTED_SIGNER_THUMBPRINT
$trustedThumbprint = "0123456789ABCDEF0123456789ABCDEF01234567"
$otherThumbprint = "89ABCDEF0123456789ABCDEF0123456789ABCDEF"

function New-TestSignature {
  param(
    [Parameter(Mandatory = $true)][string]$Status,
    [Parameter(Mandatory = $true)][string]$Thumbprint
  )
  return [pscustomobject]@{
    Status = $Status
    SignerCertificate = [pscustomobject]@{
      Thumbprint = $Thumbprint
      Subject = "CN=LaserX signing policy regression fixture"
    }
  }
}

function Assert-Throws {
  param(
    [Parameter(Mandatory = $true)][scriptblock]$Action,
    [Parameter(Mandatory = $true)][string]$ExpectedMessage
  )
  try {
    & $Action
  }
  catch {
    if ($_.Exception.Message -notlike "*$ExpectedMessage*") {
      throw "Expected failure containing '$ExpectedMessage', observed '$($_.Exception.Message)'."
    }
    return
  }
  throw "Expected failure containing '$ExpectedMessage', but the action passed."
}

try {
  Remove-Item Env:LASERX_CI_SIGNING_THUMBPRINT -ErrorAction SilentlyContinue
  $env:LASERX_EXPECTED_SIGNER_THUMBPRINT = $trustedThumbprint
  $productionPolicy = Get-LaserxSigningPolicy
  Assert-LaserxAuthenticodeSignature `
    -Signature (New-TestSignature -Status "Valid" -Thumbprint $trustedThumbprint) `
    -Path "production-correct.exe" `
    -Policy $productionPolicy | Out-Null
  Assert-Throws -ExpectedMessage "signer identity mismatch" -Action {
    Assert-LaserxAuthenticodeSignature `
      -Signature (New-TestSignature -Status "Valid" -Thumbprint $otherThumbprint) `
      -Path "production-wrong-certificate.exe" `
      -Policy $productionPolicy
  }
  Assert-Throws -ExpectedMessage "status UnknownError" -Action {
    Assert-LaserxAuthenticodeSignature `
      -Signature (New-TestSignature -Status "UnknownError" -Thumbprint $trustedThumbprint) `
      -Path "production-untrusted.exe" `
      -Policy $productionPolicy
  }

  Remove-Item Env:LASERX_EXPECTED_SIGNER_THUMBPRINT -ErrorAction SilentlyContinue
  Assert-Throws -ExpectedMessage "LASERX_EXPECTED_SIGNER_THUMBPRINT is required" -Action {
    Get-LaserxSigningPolicy
  }

  $env:LASERX_CI_SIGNING_THUMBPRINT = $trustedThumbprint
  $ciPolicy = Get-LaserxSigningPolicy
  Assert-LaserxAuthenticodeSignature `
    -Signature (New-TestSignature -Status "UnknownError" -Thumbprint $trustedThumbprint) `
    -Path "ci-self-signed.exe" `
    -Policy $ciPolicy | Out-Null
  Assert-Throws -ExpectedMessage "signer identity mismatch" -Action {
    Assert-LaserxAuthenticodeSignature `
      -Signature (New-TestSignature -Status "UnknownError" -Thumbprint $otherThumbprint) `
      -Path "ci-wrong-certificate.exe" `
      -Policy $ciPolicy
  }
  Assert-Throws -ExpectedMessage "status HashMismatch" -Action {
    Assert-LaserxAuthenticodeSignature `
      -Signature (New-TestSignature -Status "HashMismatch" -Thumbprint $trustedThumbprint) `
      -Path "ci-tampered.exe" `
      -Policy $ciPolicy
  }

  $env:LASERX_EXPECTED_SIGNER_THUMBPRINT = $otherThumbprint
  Assert-Throws -ExpectedMessage "cannot be configured together" -Action {
    Get-LaserxSigningPolicy
  }

  Write-Output "Authenticode policy regression tests passed: production requires the reviewed exact signer and trusted status; CI remains exact-thumbprint and tamper-closed."
}
finally {
  if ($null -eq $originalCiThumbprint) {
    Remove-Item Env:LASERX_CI_SIGNING_THUMBPRINT -ErrorAction SilentlyContinue
  }
  else {
    $env:LASERX_CI_SIGNING_THUMBPRINT = $originalCiThumbprint
  }
  if ($null -eq $originalProductionThumbprint) {
    Remove-Item Env:LASERX_EXPECTED_SIGNER_THUMBPRINT -ErrorAction SilentlyContinue
  }
  else {
    $env:LASERX_EXPECTED_SIGNER_THUMBPRINT = $originalProductionThumbprint
  }
}
