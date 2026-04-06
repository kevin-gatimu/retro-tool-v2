#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════════════
# Grant Contributor Role to GitHub Actions Service Principal
# ═══════════════════════════════════════════════════════════════
#
# This script grants the necessary permissions for GitHub Actions
# to deploy Azure infrastructure via Bicep templates.
#
# Usage:
#   pwsh scripts/grant-sp-permissions.ps1
#
# ═══════════════════════════════════════════════════════════════

param(
    [string]$ObjectId = "a8561f45-9ce6-4fd6-ab8f-29380717e7d9"
)

Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Granting Azure Permissions to Service Principal" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if logged in
Write-Host "1. Checking Azure login status..." -ForegroundColor Yellow
$account = az account show 2>$null
if (-not $account) {
    Write-Host "   Not logged in to Azure. Initiating login..." -ForegroundColor Red
    az login
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to login to Azure"
        exit 1
    }
}
else {
    $accountInfo = $account | ConvertFrom-Json
    Write-Host "   ✓ Logged in as: $($accountInfo.user.name)" -ForegroundColor Green
    Write-Host "   ✓ Subscription: $($accountInfo.name)" -ForegroundColor Green
}

# Get subscription ID
Write-Host ""
Write-Host "2. Getting subscription details..." -ForegroundColor Yellow
$subscriptionId = az account show --query id -o tsv
$subscriptionName = az account show --query name -o tsv
Write-Host "   ✓ Subscription ID: $subscriptionId" -ForegroundColor Green
Write-Host "   ✓ Subscription Name: $subscriptionName" -ForegroundColor Green

# Get service principal details
Write-Host ""
Write-Host "3. Getting service principal details..." -ForegroundColor Yellow
try {
    $spJson = az ad sp show --id $ObjectId --query "{DisplayName:displayName, AppId:appId, ObjectId:id}" -o json 2>&1
    if ($LASTEXITCODE -eq 0) {
        $sp = $spJson | ConvertFrom-Json
        Write-Host "   ✓ Display Name: $($sp.DisplayName)" -ForegroundColor Green
        Write-Host "   ✓ App ID:       $($sp.AppId)" -ForegroundColor Green
        Write-Host "   ✓ Object ID:    $($sp.ObjectId)" -ForegroundColor Green
    }
    else {
        Write-Error "Failed to get service principal details. Object ID may be incorrect."
        Write-Host ""
        Write-Host "To find your service principal:" -ForegroundColor Yellow
        Write-Host "  az ad sp list --filter ""startswith(displayName,'GitHub')"" --query ""[].{DisplayName:displayName, AppId:appId, ObjectId:id}"" -o table" -ForegroundColor White
        exit 1
    }
}
catch {
    Write-Error "Error getting service principal: $_"
    exit 1
}

# Check existing role assignments
Write-Host ""
Write-Host "4. Checking existing role assignments..." -ForegroundColor Yellow
$existingRoles = az role assignment list --assignee $ObjectId --scope "/subscriptions/$subscriptionId" --query "[].{Role:roleDefinitionName, Scope:scope}" -o json | ConvertFrom-Json

if ($existingRoles.Count -gt 0) {
    Write-Host "   Existing roles:" -ForegroundColor Cyan
    foreach ($role in $existingRoles) {
        Write-Host "     • $($role.Role)" -ForegroundColor White
    }
}
else {
    Write-Host "   ⚠ No existing role assignments found" -ForegroundColor Yellow
}

# Grant Contributor role
Write-Host ""
Write-Host "5. Granting Contributor role..." -ForegroundColor Yellow
Write-Host "   This allows deployment, what-if previews, and resource management" -ForegroundColor Gray

$contributor = az role assignment create `
    --assignee-object-id $ObjectId `
    --assignee-principal-type "ServicePrincipal" `
    --role "Contributor" `
    --scope "/subscriptions/$subscriptionId" `
    2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Contributor role granted successfully!" -ForegroundColor Green
}
else {
    if ($contributor -match "already exists") {
        Write-Host "   ℹ Contributor role already assigned" -ForegroundColor Cyan
    }
    else {
        Write-Error "Failed to grant Contributor role: $contributor"
        exit 1
    }
}

# Grant User Access Administrator role (for role assignments in Bicep)
Write-Host ""
Write-Host "6. Granting User Access Administrator role..." -ForegroundColor Yellow
Write-Host "   This allows Bicep templates to create role assignments" -ForegroundColor Gray

$userAccess = az role assignment create `
    --assignee-object-id $ObjectId `
    --assignee-principal-type "ServicePrincipal" `
    --role "User Access Administrator" `
    --scope "/subscriptions/$subscriptionId" `
    2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ User Access Administrator role granted successfully!" -ForegroundColor Green
}
else {
    if ($userAccess -match "already exists") {
        Write-Host "   ℹ User Access Administrator role already assigned" -ForegroundColor Cyan
    }
    else {
        Write-Error "Failed to grant User Access Administrator role: $userAccess"
        exit 1
    }
}

# Verify permissions
Write-Host ""
Write-Host "7. Verifying permissions..." -ForegroundColor Yellow
Start-Sleep -Seconds 2  # Give Azure time to propagate

$updatedRoles = az role assignment list --assignee $ObjectId --scope "/subscriptions/$subscriptionId" --query "[].{Role:roleDefinitionName}" -o json | ConvertFrom-Json

$hasContributor = $updatedRoles | Where-Object { $_.Role -eq "Contributor" }
$hasUserAccess = $updatedRoles | Where-Object { $_.Role -eq "User Access Administrator" }

if ($hasContributor) {
    Write-Host "   ✓ Contributor role verified!" -ForegroundColor Green
}
else {
    Write-Host "   ⚠ Contributor role not found (may take a few minutes to propagate)" -ForegroundColor Yellow
}

if ($hasUserAccess) {
    Write-Host "   ✓ User Access Administrator role verified!" -ForegroundColor Green
}
else {
    Write-Host "   ⚠ User Access Administrator role not found (may take a few minutes to propagate)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " ✓ Permissions Granted Successfully!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Wait 2-3 minutes for permissions to propagate" -ForegroundColor White
Write-Host "  2. Retry your GitHub Actions workflow" -ForegroundColor White
Write-Host "  3. The deployment should now succeed!" -ForegroundColor White
Write-Host ""
Write-Host "Granted permissions:" -ForegroundColor Yellow
Write-Host "  • Contributor: Create/update/delete Azure resources" -ForegroundColor White
Write-Host "  • User Access Administrator: Manage role assignments" -ForegroundColor White
Write-Host "  • Run deployment what-if previews" -ForegroundColor White
Write-Host "  • Manage resource groups" -ForegroundColor White
Write-Host "  • Full Bicep deployment capabilities" -ForegroundColor White
Write-Host ""
