param(
  [switch]$DryRun,
  [string]$ServiceName = "convex-backend"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$composeFile = Join-Path $repoRoot "docker/docker-compose.local.yml"
$composeEnv = Join-Path $repoRoot "docker/.env"

function Set-EnvVar {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )

  if (-not (Test-Path $FilePath)) {
    Write-Host "Skipping missing file: $FilePath"
    return
  }

  $raw = Get-Content -Path $FilePath -Raw
  $escaped = [regex]::Escape($Name)
  $line = "$Name=$Value"

  if ($raw -match "(?m)^$escaped=.*$") {
    $updated = [regex]::Replace($raw, "(?m)^$escaped=.*$", $line)
  }
  else {
    if ($raw.Length -gt 0 -and -not $raw.EndsWith("`n")) {
      $raw += "`r`n"
    }
    $updated = $raw + $line + "`r`n"
  }

  if ($DryRun) {
    Write-Host "[dry-run] Would set $Name in $FilePath"
    return
  }

  Set-Content -Path $FilePath -Value $updated -NoNewline
  Write-Host "Updated $Name in $FilePath"
}

function Get-ConvexAdminKey {
  Write-Host "Generating admin key via docker compose service '$ServiceName'..."

  $composeOutput = @("")
  try {
    $composeOutput = & docker compose --env-file $composeEnv -f $composeFile exec -T $ServiceName ./generate_admin_key.sh 2>$null
  }
  catch {
    $composeOutput = @()
  }

  $allOutput = ($composeOutput -join "`n")
  $match = [regex]::Match($allOutput, "convex-[^|\s]+\|[A-Za-z0-9]+")
  if ($match.Success) {
    return $match.Value
  }

  Write-Host "Compose exec did not return a key, trying docker exec fallback..."
  $containerId = (& docker ps --filter "name=$ServiceName" --format "{{.ID}}" | Select-Object -First 1)
  if (-not $containerId) {
    throw "Could not find a running container matching '$ServiceName'. Start local infra first (pnpm local:infra)."
  }

  $fallbackOutput = & docker exec $containerId ./generate_admin_key.sh
  $fallbackRaw = ($fallbackOutput -join "`n")
  $fallbackMatch = [regex]::Match($fallbackRaw, "convex-[^|\s]+\|[A-Za-z0-9]+")
  if (-not $fallbackMatch.Success) {
    throw "Failed to parse CONVEX_SELF_HOSTED_ADMIN_KEY from container output."
  }

  return $fallbackMatch.Value
}

$key = Get-ConvexAdminKey

Write-Host ""
Write-Host "New CONVEX_SELF_HOSTED_ADMIN_KEY:"
Write-Host $key
Write-Host ""

$targets = @(
  @{ Path = (Join-Path $repoRoot "convex-backend/.env"); Vars = @("CONVEX_SELF_HOSTED_ADMIN_KEY") },
  @{ Path = (Join-Path $repoRoot "docker/.env"); Vars = @("CONVEX_SELF_HOSTED_ADMIN_KEY", "CONVEX_SYNC_ADMIN_KEY") },
  @{ Path = (Join-Path $repoRoot "retro-tool-api/.env"); Vars = @("CONVEX_SYNC_ADMIN_KEY") }
)

foreach ($target in $targets) {
  foreach ($varName in $target.Vars) {
    Set-EnvVar -FilePath $target.Path -Name $varName -Value $key
  }
}

if ($DryRun) {
  Write-Host ""
  Write-Host "Dry run complete. No files were changed."
}
else {
  Write-Host ""
  Write-Host "Done. Restart API and Convex tooling to pick up the refreshed key."
}
