# Добавить переменные из .env в Vercel. Браузер — только Chrome.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'chrome-only.ps1')

$root = Join-Path $PSScriptRoot '..'
$nodeDir = Join-Path $root '.tools\node'
$env:Path = "$nodeDir;" + $env:Path
Set-Location $root

$envFile = Join-Path $PWD '.env'
if (-not (Test-Path $envFile)) { Write-Error '.env not found'; exit 1 }

# Если CLI не залогинен — открываем device-login только в Chrome
$whoami = npx vercel@latest whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Vercel: нужен вход. Открою страницу авторизации в Google Chrome...'
    $loginJob = Start-Job {
        param($nodeDir)
        $env:Path = "$nodeDir;" + $env:Path
        npx vercel@latest login 2>&1
    } -ArgumentList $nodeDir
    Start-Sleep -Seconds 3
    $out = Receive-Job $loginJob
    $url = ($out | Select-String -Pattern 'https://vercel\.com/oauth/device\?user_code=[^\s]+' -AllMatches).Matches.Value
    if ($url) {
        Open-Chrome $url
        Write-Host "Подтвердите вход в Chrome, затем снова запустите этот скрипт."
    } else {
        Open-Chrome 'https://vercel.com/login'
        Write-Host 'Войдите в Vercel в Chrome, затем снова запустите этот скрипт.'
    }
    Stop-Job $loginJob -ErrorAction SilentlyContinue
    Remove-Job $loginJob -ErrorAction SilentlyContinue
    exit 1
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $parts = $_ -split '=', 2
    if ($parts.Count -lt 2) { return }
    $key = $parts[0].Trim()
    $val = $parts[1].Trim().Trim('"')
    if (-not $val) { return }
    Write-Host "Adding $key ..."
    $val | npx vercel@latest env add $key production preview development --force 2>&1
}

Write-Host 'Done. Redeploy в Chrome:'
Open-Chrome 'https://vercel.com/axperik666/elena/deployments'
