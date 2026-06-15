# Добавить TG переменные в Vercel (браузер — только Chrome)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'chrome-only.ps1')

$root = Join-Path $PSScriptRoot '..'
$nodeDir = Join-Path $root '.tools\node'
$env:Path = "$nodeDir;" + $env:Path
Set-Location (Join-Path $PSScriptRoot '..')

if (-not (Test-Path '.env')) { Write-Error '.env not found'; exit 1 }
Get-Content '.env' | ForEach-Object {
    if ($_ -match '^\s*(TG_BOT_TOKEN|TG_CHAT_ID)\s*=\s*(.+)\s*$') {
        $name = $matches[1]
        $val = $matches[2].Trim()
        Write-Host "Adding $name to Vercel..."
        $val | npx vercel@latest env add $name production preview development --force 2>&1
    }
}
Write-Host 'Done. Redeploy:'
Open-Chrome 'https://vercel.com/axperik666/elena/deployments'
