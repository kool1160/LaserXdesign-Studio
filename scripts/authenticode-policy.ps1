Set-StrictMode -Version Latest

function ConvertTo-LaserxThumbprint {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Value,
    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  $normalized = [regex]::Replace($Value, "\s", "").ToUpperInvariant()
  if ($normalized -notmatch "^[0-9A-F]{40}$") {
    throw "$Label must be a complete 40-character SHA-1 certificate thumbprint."
  }
  return $normalized
}

function Get-LaserxSigningPolicy {
  $ciValue = $env:LASERX_CI_SIGNING_THUMBPRINT
  $productionValue = $env:LASERX_EXPECTED_SIGNER_THUMBPRINT
  $hasCiValue = -not [string]::IsNullOrWhiteSpace($ciValue)
  $hasProductionValue = -not [string]::IsNullOrWhiteSpace($productionValue)

  if ($hasCiValue -and $hasProductionValue) {
    throw "CI and production signer identities cannot be configured together."
  }
  if ($hasCiValue) {
    return [pscustomobject]@{
      Mode = "ci"
      ExpectedThumbprint = ConvertTo-LaserxThumbprint -Value $ciValue -Label "LASERX_CI_SIGNING_THUMBPRINT"
      RequiresTrustedChain = $false
    }
  }
  if (-not $hasProductionValue) {
    throw "LASERX_EXPECTED_SIGNER_THUMBPRINT is required for production Authenticode validation."
  }
  return [pscustomobject]@{
    Mode = "production"
    ExpectedThumbprint = ConvertTo-LaserxThumbprint -Value $productionValue -Label "LASERX_EXPECTED_SIGNER_THUMBPRINT"
    RequiresTrustedChain = $true
  }
}

function Assert-LaserxAuthenticodeSignature {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Signature,
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [object]$Policy
  )

  if ($null -eq $Signature.SignerCertificate) {
    throw "Authenticode signer certificate is missing for $Path (status $($Signature.Status))."
  }
  $observedThumbprint = ConvertTo-LaserxThumbprint `
    -Value ([string]$Signature.SignerCertificate.Thumbprint) `
    -Label "Observed signer thumbprint for $Path"
  if ($observedThumbprint -cne $Policy.ExpectedThumbprint) {
    throw "Authenticode signer identity mismatch for $Path. Expected $($Policy.ExpectedThumbprint), observed $observedThumbprint."
  }

  if ($Policy.RequiresTrustedChain) {
    if ([string]$Signature.Status -cne "Valid") {
      throw "Production Authenticode validation failed for $Path with status $($Signature.Status)."
    }
  }
  elseif ([string]$Signature.Status -in @("NotSigned", "HashMismatch")) {
    throw "CI Authenticode validation failed for $Path with status $($Signature.Status)."
  }

  return [pscustomobject]@{
    Mode = [string]$Policy.Mode
    ExpectedThumbprint = [string]$Policy.ExpectedThumbprint
    ObservedThumbprint = $observedThumbprint
    Status = [string]$Signature.Status
    Subject = [string]$Signature.SignerCertificate.Subject
  }
}
