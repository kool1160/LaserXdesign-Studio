param(
  [switch]$SkipInstall,
  [switch]$LaunchClaude
)

$ErrorActionPreference = "Stop"

$Branch = "experiment/m14-physical-3d-preview-lab"
$RemoteBranch = "origin/$Branch"

$SourceCandidates = @(
  "C:\Users\kool1\OneDive-Personal\OneDrive\Documents\GitHub\LaserXDesign Studio",
  "C:\Users\kool1\OneDrive-Personal\OneDrive\Documents\GitHub\LaserXDesign Studio",
  "C:\Users\kool1\OneDrive\Documents\GitHub\LaserXDesign Studio"
)

$SourceRepo = $SourceCandidates | Where-Object {
  Test-Path (Join-Path $_ ".git")
} | Select-Object -First 1

if (-not $SourceRepo) {
  throw "LaserX source repository was not found. Edit `$SourceCandidates in this script to match the local repository path."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is not available in PATH. Install Git for Windows before continuing."
}

$WorktreeParent = Split-Path $SourceRepo -Parent
$Worktree = Join-Path $WorktreeParent "LaserXDesign Studio 3D"

Write-Host "Source repository: $SourceRepo"
Write-Host "3D worktree:      $Worktree"
Write-Host "Branch:           $Branch"

Push-Location $SourceRepo
try {
  git fetch origin --prune
  if ($LASTEXITCODE -ne 0) {
    throw "git fetch failed."
  }

  git show-ref --verify --quiet "refs/remotes/$RemoteBranch"
  if ($LASTEXITCODE -ne 0) {
    throw "Remote branch $RemoteBranch was not found. Confirm the branch exists on GitHub."
  }

  if (Test-Path $Worktree) {
    if (-not (Test-Path (Join-Path $Worktree ".git"))) {
      throw "The target worktree path exists but is not a Git worktree: $Worktree"
    }
    Write-Host "Existing 3D worktree found."
  }
  else {
    git show-ref --verify --quiet "refs/heads/$Branch"
    if ($LASTEXITCODE -eq 0) {
      git worktree add "$Worktree" "$Branch"
    }
    else {
      git worktree add --track -b "$Branch" "$Worktree" "$RemoteBranch"
    }
    if ($LASTEXITCODE -ne 0) {
      throw "Unable to create the 3D worktree."
    }
  }
}
finally {
  Pop-Location
}

Set-Location $Worktree

git status --short --branch
if ($LASTEXITCODE -ne 0) {
  throw "Unable to read worktree status."
}

$currentBranch = git branch --show-current
if ($currentBranch -ne $Branch) {
  throw "The worktree is on '$currentBranch', not '$Branch'."
}

if (-not $SkipInstall) {
  if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) {
      throw "pnpm install failed."
    }
  }
  else {
    Write-Warning "pnpm is not available. Install/enable the pinned repository package manager before implementation."
  }
}

$ClaudeFolder = Join-Path $Worktree "apps\physical-3d-preview-lab"
if (-not (Test-Path (Join-Path $ClaudeFolder "CLAUDE.md"))) {
  throw "The experiment CLAUDE.md was not found at $ClaudeFolder."
}

Set-Location $ClaudeFolder

Write-Host ""
Write-Host "Claude worktree is ready." -ForegroundColor Green
Write-Host "Start folder: $ClaudeFolder"
Write-Host "Research issue: https://github.com/kool1160/LaserXdesign-Studio/issues/34"
Write-Host ""

$StartInstruction = "Read the root CLAUDE.md, this folder's CLAUDE.md, GitHub Issue #34, and the complete PROJECT_BRIEF.md. Verify the branch and live M13/M14 gate. Perform Phase 0 only: inspect current authoritative manufacturing and contour contracts, complete ENGINE_DECISION.md, and report the smallest first implementation slice. Do not code before the engine decision is complete."

if ($LaunchClaude) {
  if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    throw "Claude Code is not installed or not available in PATH."
  }
  claude --model sonnet $StartInstruction
}
else {
  Write-Host "Run this command to begin:"
  Write-Host "claude --model sonnet `"$StartInstruction`"" -ForegroundColor Cyan
}
