# Run Next.js on the host while API/DB run in Docker (port 8010).
#   .\scripts\dev-web-host.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$envFile = "apps\web\.env.local"
$example = "apps\web\.env.local.example"
if (-not (Test-Path $envFile)) {
    Copy-Item $example $envFile
    Write-Host "Created $envFile from example" -ForegroundColor Yellow
}

Set-Location apps\web
if (-not (Test-Path node_modules)) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Cyan
    npm ci
}

Write-Host "Starting Next.js at http://localhost:3050/operations" -ForegroundColor Green
Write-Host "API proxy -> http://localhost:8010" -ForegroundColor Cyan
npm run dev
