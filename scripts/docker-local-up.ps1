# Full Carpet stack in Docker (Windows PowerShell)
#   .\scripts\docker-local-up.ps1
#   .\scripts\docker-local-up.ps1 -SkipDnsCheck
#   .\scripts\docker-local-up.ps1 -UseMirrorEnv

param(
    [switch]$SkipDnsCheck,
    [switch]$UseMirrorEnv
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$composeFiles = "-f", "docker-compose.yml", "-f", "docker-compose.dockerdb.yml"

function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$ComposeArgs)
    & docker compose @composeFiles @ComposeArgs
    if ($LASTEXITCODE -ne 0) {
        $cmd = "docker compose $($composeFiles -join ' ') $($ComposeArgs -join ' ')"
        throw "Command failed (exit $LASTEXITCODE): $cmd"
    }
}

function Test-DnsName {
    param([string]$Name)
    try {
        $null = Resolve-DnsName $Name -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

if ($UseMirrorEnv) {
    Copy-Item .env.docker.mirror.example .env -Force
    Write-Host "Using .env from .env.docker.mirror.example (Arvan images)" -ForegroundColor Yellow
}
elseif (-not (Test-Path .env)) {
    if (Test-DnsName "registry-1.docker.io") {
        Copy-Item .env.docker.example .env
    }
    else {
        Copy-Item .env.docker.mirror.example .env
        Write-Host "Docker Hub DNS failed -> created .env from .env.docker.mirror.example" -ForegroundColor Yellow
    }
}

if (-not $SkipDnsCheck) {
    Write-Host "Checking registry DNS..." -ForegroundColor Cyan
    $hubOk = Test-DnsName "registry-1.docker.io"
    $mirrorOk = (Test-DnsName "docker.arvancloud.ir") -or (Test-DnsName "hub.hamdocker.ir")

    if (-not $hubOk -and -not $mirrorOk) {
        Write-Host ""
        Write-Host "ERROR: Cannot resolve Docker Hub or known mirrors." -ForegroundColor Red
        Write-Host "1) Docker Desktop -> Settings -> Docker Engine" -ForegroundColor Yellow
        Write-Host "   Paste content from: docker\daemon.windows.example.json" -ForegroundColor Yellow
        Write-Host "2) Apply & Restart Docker Desktop" -ForegroundColor Yellow
        Write-Host "3) copy .env.docker.mirror.example .env" -ForegroundColor Yellow
        Write-Host "4) .\scripts\docker-local-up.ps1 -SkipDnsCheck" -ForegroundColor Yellow
        Write-Host "See: docs/docker-windows-network.md" -ForegroundColor Yellow
        exit 1
    }

    if (-not $hubOk) {
        Write-Host "Docker Hub DNS failed; mirror path is OK. Using mirror .env if needed." -ForegroundColor Yellow
        if (-not (Select-String -Path .env -Pattern "arvancloud|hamdocker" -Quiet)) {
            Copy-Item .env.docker.mirror.example .env -Force
            Write-Host "Updated .env from .env.docker.mirror.example" -ForegroundColor Yellow
        }
    }
}

Write-Host "Building images (first time may take several minutes)..." -ForegroundColor Cyan
$env:DOCKER_DEFAULT_PLATFORM = "linux/amd64"
Invoke-Compose build

Write-Host "Running database migrations..." -ForegroundColor Cyan
Invoke-Compose run --rm migrate

Write-Host "Starting all services..." -ForegroundColor Cyan
Invoke-Compose up -d

Write-Host ""
Write-Host "Ready (backend stack):" -ForegroundColor Green
Write-Host '  API:    http://localhost:8010/health'
Write-Host '  Docs:   http://localhost:8010/docs'
Write-Host ''
Write-Host 'Starting frontend (Next.js)...' -ForegroundColor Cyan
try {
    Invoke-Compose --profile frontend up -d web
    Write-Host '  Web:    http://localhost:3050/operations' -ForegroundColor Green
}
catch {
    Write-Host ''
    Write-Host 'WARNING: Docker web failed to start.' -ForegroundColor Yellow
    Write-Host 'Hybrid fallback (API in Docker, web on host):' -ForegroundColor Yellow
    Write-Host '  copy apps\web\.env.local.example apps\web\.env.local' -ForegroundColor Yellow
    Write-Host '  .\scripts\dev-web-host.ps1' -ForegroundColor Yellow
    Write-Host ''
}
Write-Host ''
Write-Host 'Status: docker compose -f docker-compose.yml -f docker-compose.dockerdb.yml ps'
