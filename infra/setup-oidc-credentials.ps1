<#
.SYNOPSIS
    Creates Azure AD federated identity credentials for GitHub Actions OIDC.

.DESCRIPTION
    Automates the creation of federated identity credentials on an App Registration
    so GitHub Actions can authenticate to Azure via OIDC (no client secrets needed).

    By default creates credentials for all environments: production, staging, develop.
    Use -Environment to target a specific one.

.PARAMETER AppName
    Display name of the App Registration (used to look up the Object ID).
    Default: "retro-tool"

.PARAMETER RepoFullName
    GitHub repository in "owner/repo" format.
    Default: "kevin-gatimu/retro-tool-v2"

.PARAMETER Environment
    Target a specific environment. Valid values: production, staging, develop, all.
    Default: "all"

.PARAMETER Force
    Recreate credentials even if they already exist (deletes and re-creates).

.PARAMETER Delete
    Delete federated credentials instead of creating them. Combine with -Environment to target specific ones.

.PARAMETER List
    List existing federated credentials and exit. No changes are made.

.EXAMPLE
    .\setup-oidc-credentials.ps1
    .\setup-oidc-credentials.ps1 -Environment staging
    .\setup-oidc-credentials.ps1 -Environment production -Force
    .\setup-oidc-credentials.ps1 -Delete -Environment develop
    .\setup-oidc-credentials.ps1 -Delete
    .\setup-oidc-credentials.ps1 -List
    .\setup-oidc-credentials.ps1 -AppName "my-app" -RepoFullName "org/repo"
#>

param(
    [string]$AppName = "retro-tool",
    [string]$RepoFullName = "kevin-gatimu/retro-tool-v2",
    [ValidateSet("all", "production", "staging", "develop")]
    [string]$Environment = "all",
    [switch]$Force,
    [switch]$Delete,
    [switch]$List
)

$ErrorActionPreference = "Stop"

$allEnvironments = @(
    @{ Name = "production"; Description = "GitHub Actions OIDC for production environment" }
    @{ Name = "staging";    Description = "GitHub Actions OIDC for staging environment" }
    @{ Name = "develop";    Description = "GitHub Actions OIDC for develop environment" }
)

$environments = if ($Environment -eq "all") {
    $allEnvironments
} else {
    $allEnvironments | Where-Object { $_.Name -eq $Environment }
}

Write-Host "`nTarget: $($environments | ForEach-Object { $_.Name } | Join-String -Separator ', ')" -ForegroundColor Magenta

Write-Host "`nLooking up App Registration '$AppName'..." -ForegroundColor Cyan
$app = az ad app list --display-name $AppName --query "[0].{id:id, appId:appId, displayName:displayName}" -o json | ConvertFrom-Json

if (-not $app) {
    Write-Error "No App Registration found with display name '$AppName'. Create one first in Entra ID."
    exit 1
}

$objectId = $app.id
Write-Host "Found: $($app.displayName) (Object ID: $objectId, Client ID: $($app.appId))" -ForegroundColor Green

if ($List) {
    Write-Host "`nExisting federated credentials:" -ForegroundColor Cyan
    az ad app federated-credential list --id $objectId --query "[].{Name:name, Subject:subject, Issuer:issuer, Description:description}" -o table
    exit 0
}

Write-Host "`nFetching existing federated credentials..." -ForegroundColor Cyan
$existing = az ad app federated-credential list --id $objectId -o json | ConvertFrom-Json
$existingNames = $existing | ForEach-Object { $_.name }

foreach ($env in $environments) {
    $credName = "github-$($env.Name)"
    $subject = "repo:${RepoFullName}:environment:$($env.Name)"

    if ($Delete) {
        if ($credName -in $existingNames) {
            Write-Host "  [DELETE] Removing '$credName'" -ForegroundColor Red
            az ad app federated-credential delete --id $objectId --federated-credential-id $credName --output none
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  [OK] Deleted '$credName'" -ForegroundColor Green
            } else {
                Write-Host "  [FAIL] Could not delete '$credName'" -ForegroundColor Red
            }
        } else {
            Write-Host "  [SKIP] '$credName' does not exist" -ForegroundColor Yellow
        }
        continue
    }

    if ($credName -in $existingNames) {
        if ($Force) {
            Write-Host "  [DELETE] Removing existing '$credName' (--Force)" -ForegroundColor Yellow
            az ad app federated-credential delete --id $objectId --federated-credential-id $credName --output none
        } else {
            Write-Host "  [SKIP] '$credName' already exists (use -Force to recreate)" -ForegroundColor Yellow
            continue
        }
    }

    Write-Host "  [CREATE] $credName (subject: $subject)" -ForegroundColor White

    $params = @{
        name        = $credName
        issuer      = "https://token.actions.githubusercontent.com"
        subject     = $subject
        audiences   = @("api://AzureADTokenExchange")
        description = $env.Description
    } | ConvertTo-Json

    $tempFile = [System.IO.Path]::GetTempFileName()
    $params | Out-File -FilePath $tempFile -Encoding utf8

    az ad app federated-credential create --id $objectId --parameters "@$tempFile" --output none

    Remove-Item $tempFile -ErrorAction SilentlyContinue

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Created '$credName'" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Could not create '$credName'" -ForegroundColor Red
    }
}

Write-Host "`nVerifying all credentials:" -ForegroundColor Cyan
az ad app federated-credential list --id $objectId --query "[].{name:name, subject:subject}" -o table

Write-Host "`nDone. Add these secrets to each GitHub environment:" -ForegroundColor Cyan
Write-Host "  AZURE_CLIENT_ID       = $($app.appId)"
Write-Host "  AZURE_TENANT_ID       = (your tenant ID)"
Write-Host "  AZURE_SUBSCRIPTION_ID = (your subscription ID)`n"
