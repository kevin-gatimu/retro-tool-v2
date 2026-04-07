#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════════════
# Setup Caddy Certificate Persistence (Step 8.0)
# ═══════════════════════════════════════════════════════════════
#
# Creates an Azure Storage Account + File Share for persisting
# Caddy TLS certificates across ACI restarts, then prints the
# four GitHub Environment entries you need to set before running
# the Deploy Infrastructure workflow.
#
# Usage:
#   pwsh scripts/setup-caddy-cert-storage.ps1 `
#     -ResourceGroup retro-tool-api-rg `
#     -Location southafricanorth `
#     -StorageAccountName retrotoolcaddycerts `
#     -ShareName caddy-certs `
#     -Environment production `
#     -SubscriptionId <your-subscription-id>
#
# Parameters:
#   -ResourceGroup        Azure resource group (default: retro-tool-api-rg)
#   -Location             Azure region (default: southafricanorth)
#   -StorageAccountName   Storage account name — must be globally unique,
#                         3-24 lowercase alphanumeric chars (default: retrotoolcaddycerts)
#   -ShareName            File share name (default: caddy-certs)
#   -Environment          GitHub environment label for output (default: production)
#   -SubscriptionId       Optional Azure subscription ID to force use
#   -DryRun               Preview what would be created without making changes
# ═══════════════════════════════════════════════════════════════

param(
    [string]$ResourceGroup = "retro-tool-api-rg",
    [string]$Location = "southafricanorth",
    [string]$StorageAccountName = "retrotoolcaddycerts",
    [string]$ShareName = "caddy-certs",
    [string]$Environment = "production",
    [string]$SubscriptionId = "",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Caddy Certificate Persistence Setup (Step 8.0)" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host " DRY RUN — no changes will be made" -ForegroundColor Yellow
}
Write-Host ""

# ── 1. Check Azure login ──────────────────────────────────────
Write-Host "1. Checking Azure login..." -ForegroundColor Yellow
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "   Not logged in — initiating login..." -ForegroundColor Red
    az login
    $account = az account show | ConvertFrom-Json
}
$subscriptionId = if (-not [string]::IsNullOrWhiteSpace($SubscriptionId)) { $SubscriptionId } else { $account.id }

# Validate requested/current subscription is accessible; if not, fall back to first enabled subscription.
az account set --subscription $subscriptionId 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ! Subscription '$subscriptionId' is not accessible in current tenant/context." -ForegroundColor Yellow
    $enabledSubs = az account list --query "[?state=='Enabled']" -o json 2>$null | ConvertFrom-Json
    if (-not $enabledSubs -or $enabledSubs.Count -eq 0) {
        Write-Host "   ✗ No enabled subscriptions available. Run 'az login --tenant <tenant-id>' and retry." -ForegroundColor Red
        exit 1
    }

    $fallbackSub = $enabledSubs | Select-Object -First 1
    $subscriptionId = $fallbackSub.id
    az account set --subscription $subscriptionId | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ✗ Failed to set fallback subscription '$subscriptionId'." -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✓ Fallback subscription selected: $($fallbackSub.name) ($subscriptionId)" -ForegroundColor Green
}

$account = az account show | ConvertFrom-Json
Write-Host "   ✓ Logged in as: $($account.user.name)" -ForegroundColor Green
Write-Host "   ✓ Subscription: $($account.name) ($subscriptionId)" -ForegroundColor Green

# az storage commands require the subscription to be set as active
az account set --subscription $subscriptionId | Out-Null
Write-Host "   ✓ Active subscription set" -ForegroundColor Green

# ── 2. Verify resource group exists ──────────────────────────
Write-Host ""
Write-Host "2. Checking resource group '$ResourceGroup'..." -ForegroundColor Yellow
$rg = az group show --name $ResourceGroup 2>$null | ConvertFrom-Json
if (-not $rg) {
    Write-Host "   ✗ Resource group '$ResourceGroup' not found." -ForegroundColor Red
    Write-Host "   Create it first: az group create --name $ResourceGroup --location $Location" -ForegroundColor White
    exit 1
}
Write-Host "   ✓ Resource group exists in $($rg.location)" -ForegroundColor Green

# ── 3. Create storage account ─────────────────────────────────
Write-Host ""
Write-Host "3. Creating storage account '$StorageAccountName'..." -ForegroundColor Yellow

$existingSa = az storage account show --name $StorageAccountName --resource-group $ResourceGroup --subscription $subscriptionId 2>$null | ConvertFrom-Json
if ($existingSa) {
    Write-Host "   ℹ Storage account already exists — skipping creation" -ForegroundColor Cyan
} elseif ($DryRun) {
    Write-Host "   [DRY RUN] Would create storage account '$StorageAccountName' in '$ResourceGroup'" -ForegroundColor Yellow
} else {
    $saResult = az storage account create `
        --name $StorageAccountName `
        --resource-group $ResourceGroup `
        --location $Location `
        --sku Standard_LRS `
        --kind StorageV2 `
        --allow-blob-public-access false `
        --subscription $subscriptionId 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ✗ Failed to create storage account:" -ForegroundColor Red
        Write-Host "   $saResult" -ForegroundColor Red
        Write-Host ""
        Write-Host "   Common causes:" -ForegroundColor Yellow
        Write-Host "     • Name '$StorageAccountName' is already taken globally — try a different name with -StorageAccountName" -ForegroundColor White
        Write-Host "     • Visual Studio subscriptions may restrict some resource types in certain regions" -ForegroundColor White
        Write-Host "     • Try: az storage account check-name --name $StorageAccountName" -ForegroundColor White
        exit 1
    }
    Write-Host "   ✓ Storage account created" -ForegroundColor Green
}

# ── 4. Create file share ──────────────────────────────────────
Write-Host ""
Write-Host "4. Creating file share '$ShareName'..." -ForegroundColor Yellow

if ($DryRun) {
    Write-Host "   [DRY RUN] Would create file share '$ShareName' in storage account '$StorageAccountName'" -ForegroundColor Yellow
} else {
    $shareResult = az storage share create `
        --name $ShareName `
        --account-name $StorageAccountName `
        --subscription $subscriptionId 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ✗ Failed to create file share:" -ForegroundColor Red
        Write-Host "   $shareResult" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✓ File share created" -ForegroundColor Green
}

# ── 5. Get storage account key ────────────────────────────────
Write-Host ""
Write-Host "5. Retrieving storage account key..." -ForegroundColor Yellow

if ($DryRun) {
    $storageKey = "<would-be-retrieved-key>"
    Write-Host "   [DRY RUN] Would retrieve key for '$StorageAccountName'" -ForegroundColor Yellow
} else {
    $storageKey = az storage account keys list `
        --resource-group $ResourceGroup `
        --account-name $StorageAccountName `
        --subscription $subscriptionId `
        --query "[0].value" -o tsv 2>&1
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($storageKey)) {
        Write-Host "   ✗ Failed to retrieve storage key:" -ForegroundColor Red
        Write-Host "   $storageKey" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✓ Key retrieved" -ForegroundColor Green
}

# ── 6. Print GitHub Environment entries ──────────────────────
Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " GitHub Environment: '$Environment'" -ForegroundColor Green
Write-Host " Set these BEFORE running Deploy Infrastructure:" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host " VARIABLES" -ForegroundColor Cyan
Write-Host "  CADDY_PERSIST_CERTIFICATES    = true" -ForegroundColor White
Write-Host "  CADDY_CERT_STORAGE_ACCOUNT_NAME = $StorageAccountName" -ForegroundColor White
Write-Host "  CADDY_CERT_STORAGE_SHARE_NAME   = $ShareName" -ForegroundColor White
Write-Host ""
Write-Host " SECRETS" -ForegroundColor Cyan
Write-Host "  CADDY_CERT_STORAGE_ACCOUNT_KEY  = $storageKey" -ForegroundColor White
Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: Set the above in GitHub then run Step 8.1 (Deploy Infrastructure)." -ForegroundColor Cyan
Write-Host ""
Write-Host "Why this matters:" -ForegroundColor Yellow
Write-Host "  Without persistence, every ACI restart causes Caddy to request a new" -ForegroundColor Gray
Write-Host "  TLS certificate from Let's Encrypt. Frequent restarts can hit rate limits." -ForegroundColor Gray
Write-Host ""
