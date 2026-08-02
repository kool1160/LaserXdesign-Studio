[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ArtifactDirectory,
  [Parameter(Mandatory = $true)]
  [string]$ExpectedVersion,
  [Parameter(Mandatory = $true)]
  [string]$SourceCommit,
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "authenticode-policy.ps1")

if ($SourceCommit -notmatch "^[0-9a-f]{40}$") {
  throw "SourceCommit must be a complete lowercase Git commit SHA."
}

$artifactRoot = (Resolve-Path -LiteralPath $ArtifactDirectory).Path
$installerPath = Join-Path $artifactRoot "LaserX-Design-Studio-Setup-$ExpectedVersion-x64.exe"
$applicationPath = Join-Path $artifactRoot "win-unpacked\LaserX Design Studio.exe"
$artifacts = @($installerPath, $applicationPath)
$signingPolicy = Get-LaserxSigningPolicy

$records = foreach ($path in $artifacts) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Release artifact is missing: $path"
  }
  $signature = Get-AuthenticodeSignature -LiteralPath $path
  $validatedSignature = Assert-LaserxAuthenticodeSignature `
    -Signature $signature `
    -Path $path `
    -Policy $signingPolicy
  $item = Get-Item -LiteralPath $path
  $artifactPrefix = $artifactRoot.TrimEnd("\", "/") + [IO.Path]::DirectorySeparatorChar
  if (-not $item.FullName.StartsWith($artifactPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Release artifact escaped the requested artifact directory: $($item.FullName)"
  }
  [ordered]@{
    fileName = $item.Name
    relativePath = $item.FullName.Substring($artifactPrefix.Length).Replace("\", "/")
    byteLength = $item.Length
    sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    signature = [ordered]@{
      status = $validatedSignature.Status
      subject = $validatedSignature.Subject
      expectedThumbprint = $validatedSignature.ExpectedThumbprint.ToLowerInvariant()
      observedThumbprint = $validatedSignature.ObservedThumbprint.ToLowerInvariant()
      notAfter = $signature.SignerCertificate.NotAfter.ToUniversalTime().ToString("O")
    }
  }
}

$manifest = [ordered]@{
  schemaVersion = 2
  product = "LaserX Design Studio"
  channel = "beta"
  version = $ExpectedVersion
  sourceCommit = $SourceCommit
  platform = "windows"
  architecture = "x64"
  signingPolicy = [ordered]@{
    mode = $signingPolicy.Mode
    requiresTrustedChain = $signingPolicy.RequiresTrustedChain
    expectedThumbprint = $signingPolicy.ExpectedThumbprint.ToLowerInvariant()
  }
  generatedAt = [DateTimeOffset]::UtcNow.ToString("O")
  artifacts = $records
}

$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$json = $manifest | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($resolvedOutput, "$json`n", [Text.UTF8Encoding]::new($false))
Write-Output "Wrote signed release provenance: $resolvedOutput"
