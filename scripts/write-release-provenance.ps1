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

if ($SourceCommit -notmatch "^[0-9a-f]{40}$") {
  throw "SourceCommit must be a complete lowercase Git commit SHA."
}

$artifactRoot = (Resolve-Path -LiteralPath $ArtifactDirectory).Path
$installerPath = Join-Path $artifactRoot "LaserX-Design-Studio-Setup-$ExpectedVersion-x64.exe"
$applicationPath = Join-Path $artifactRoot "win-unpacked\LaserX Design Studio.exe"
$artifacts = @($installerPath, $applicationPath)

$records = foreach ($path in $artifacts) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Release artifact is missing: $path"
  }
  $signature = Get-AuthenticodeSignature -LiteralPath $path
  if ($signature.Status -ne "Valid" -or $null -eq $signature.SignerCertificate) {
    throw "Release artifact is not validly Authenticode signed: $path ($($signature.Status))"
  }
  $item = Get-Item -LiteralPath $path
  [ordered]@{
    fileName = $item.Name
    relativePath = [IO.Path]::GetRelativePath($artifactRoot, $item.FullName).Replace("\", "/")
    byteLength = $item.Length
    sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    signature = [ordered]@{
      status = [string]$signature.Status
      subject = $signature.SignerCertificate.Subject
      thumbprint = $signature.SignerCertificate.Thumbprint.ToLowerInvariant()
      notAfter = $signature.SignerCertificate.NotAfter.ToUniversalTime().ToString("O")
    }
  }
}

$manifest = [ordered]@{
  schemaVersion = 1
  product = "LaserX Design Studio"
  channel = "beta"
  version = $ExpectedVersion
  sourceCommit = $SourceCommit
  platform = "windows"
  architecture = "x64"
  generatedAt = [DateTimeOffset]::UtcNow.ToString("O")
  artifacts = $records
}

$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$json = $manifest | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($resolvedOutput, "$json`n", [Text.UTF8Encoding]::new($false))
Write-Output "Wrote signed release provenance: $resolvedOutput"
