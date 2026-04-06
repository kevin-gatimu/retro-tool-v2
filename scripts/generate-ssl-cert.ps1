#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════════════
# Generate Self-Signed SSL Certificate for Application Gateway
# ═══════════════════════════════════════════════════════════════
#
# WARNING: This generates a SELF-SIGNED certificate for TESTING ONLY
# Your browser will show security warnings.
#
# For PRODUCTION, use a real certificate from:
# - Let's Encrypt (free, automated)
# - Azure Key Vault with a trusted CA certificate
# - Your organization's certificate authority
#
# Usage:
#   pwsh scripts/generate-ssl-cert.ps1
#
# Outputs:
#   - cert.pfx: Certificate file (don't commit!)
#   - cert.b64: Base64-encoded certificate for Bicep
#   - cert-password.txt: Certificate password (don't commit!)
#
# ═══════════════════════════════════════════════════════════════

param(
    [string]$OutputDir = "infra/ssl-certs",
    [string]$CertPassword = "ConvexSSL$(Get-Random -Minimum 1000 -Maximum 9999)!",
    [string]$OpenSslPath = ""
)

# Try to find OpenSSL
$opensslCmd = $null

if ($OpenSslPath) {
    # User provided explicit path
    if (Test-Path $OpenSslPath) {
        $opensslCmd = $OpenSslPath
    }
}
else {
    # Try to find in PATH first
    $opensslCmd = Get-Command openssl -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    
    # If not in PATH, check common Windows installation locations
    if (-not $opensslCmd) {
        $commonPaths = @(
            "C:\Program Files\OpenSSL-Win64\bin\openssl.exe",
            "C:\Program Files (x86)\OpenSSL-Win32\bin\openssl.exe",
            "C:\OpenSSL-Win64\bin\openssl.exe",
            "C:\OpenSSL-Win32\bin\openssl.exe",
            "$env:ProgramFiles\Git\usr\bin\openssl.exe",
            "$env:ChocolateyInstall\bin\openssl.exe"
        )
        
        foreach ($path in $commonPaths) {
            if (Test-Path $path) {
                $opensslCmd = $path
                Write-Host "Found OpenSSL at: $path" -ForegroundColor Green
                break
            }
        }
    }
}

if (-not $opensslCmd) {
    Write-Error "OpenSSL is not installed or not found in PATH."
    Write-Host ""
    Write-Host "Installation options:" -ForegroundColor Yellow
    Write-Host "  1. Windows (Chocolatey): choco install openssl" -ForegroundColor White
    Write-Host "  2. Windows (Scoop): scoop install openssl" -ForegroundColor White
    Write-Host "  3. Windows (Manual): https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor White
    Write-Host "  4. macOS: brew install openssl" -ForegroundColor White
    Write-Host "  5. Linux: sudo apt install openssl" -ForegroundColor White
    Write-Host ""
    Write-Host "If OpenSSL is installed but not in PATH, run:" -ForegroundColor Cyan
    Write-Host "  pwsh scripts/generate-ssl-cert.ps1 -OpenSslPath 'C:\Path\To\openssl.exe'" -ForegroundColor White
    Write-Host ""
    Write-Host "Checking common locations..." -ForegroundColor Yellow
    $commonPaths | ForEach-Object {
        $exists = Test-Path $_
        $status = if ($exists) { "✓ FOUND" } else { "✗ Not found" }
        $color = if ($exists) { "Green" } else { "Gray" }
        Write-Host "  $status : $_" -ForegroundColor $color
    }
    exit 1
}

# Create output directory
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Generating Self-Signed SSL Certificate" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Using OpenSSL: $opensslCmd" -ForegroundColor Green
Write-Host ""

# Generate private key and certificate
Write-Host "1. Generating private key and certificate..." -ForegroundColor Yellow
$certPath = Join-Path $OutputDir "cert.pem"
$keyPath = Join-Path $OutputDir "key.pem"
$pfxPath = Join-Path $OutputDir "cert.pfx"
$b64Path = Join-Path $OutputDir "cert.b64"
$passwordPath = Join-Path $OutputDir "cert-password.txt"

& $opensslCmd req -x509 -newkey rsa:4096 -keyout $keyPath -out $certPath -days 365 -nodes `
    -subj "/C=ZA/ST=Gauteng/L=Johannesburg/O=RetroTool/CN=*.azurecontainer.io"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to generate certificate"
    exit 1
}

# Convert to PFX format
Write-Host "2. Converting to PFX format..." -ForegroundColor Yellow
& $opensslCmd pkcs12 -export -out $pfxPath -inkey $keyPath -in $certPath -password "pass:$CertPassword"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to convert certificate to PFX"
    exit 1
}

# Encode to Base64
Write-Host "3. Encoding to Base64..." -ForegroundColor Yellow
$pfxBytes = [System.IO.File]::ReadAllBytes($pfxPath)
$pfxBase64 = [System.Convert]::ToBase64String($pfxBytes)
[System.IO.File]::WriteAllText($b64Path, $pfxBase64)

# Save password
Write-Host "4. Saving certificate password..." -ForegroundColor Yellow
[System.IO.File]::WriteAllText($passwordPath, $CertPassword)

# Clean up intermediate files
Remove-Item $certPath -Force
Remove-Item $keyPath -Force

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " ✓ Certificate Generated Successfully!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Files created:" -ForegroundColor Cyan
Write-Host "  • $pfxPath" -ForegroundColor White
Write-Host "  • $b64Path" -ForegroundColor White
Write-Host "  • $passwordPath" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Add certificate files to .gitignore (already done)" -ForegroundColor White
Write-Host "  2. Store the password in GitHub Secrets as:" -ForegroundColor White
Write-Host "     APP_GATEWAY_SSL_CERT_PASSWORD" -ForegroundColor Cyan
Write-Host "  3. Store the base64 cert in GitHub Secrets as:" -ForegroundColor White
Write-Host "     APP_GATEWAY_SSL_CERT_DATA" -ForegroundColor Cyan
Write-Host ""
Write-Host "WARNING: This is a self-signed certificate." -ForegroundColor Red
Write-Host "Browsers will show security warnings until you use a real certificate." -ForegroundColor Red
Write-Host ""
