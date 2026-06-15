# Facebook Pixel env в Vercel. Ссылки — только Google Chrome.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'chrome-only.ps1')

$root = Join-Path $PSScriptRoot '..'
$nodeDir = Join-Path $root '.tools\node'
$env:Path = "$nodeDir;" + $env:Path
Set-Location $root

if (-not (Test-Path '.env')) { Write-Error '.env not found'; exit 1 }

Get-Content '.env' | ForEach-Object {
    if ($_ -match '^\s*(FB_PIXEL_ID|FB_ACCESS_TOKEN)\s*=\s*(.+)\s*$') {
        $name = $matches[1]
        $val = $matches[2].Trim()
        Write-Host "Adding $name to Vercel..."
        $val | npx vercel@latest env add $name production preview development --force 2>&1
    }
}

Write-Host 'Готово. Redeploy:'
Open-Chrome 'https://vercel.com/axperik666/elena/deployments'
