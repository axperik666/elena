# TG env уже в Vercel. CLI не используем (открывает Edge). Панель — только Chrome.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'chrome-only.ps1')
Open-Chrome 'https://vercel.com/axperik666/elena/settings/environment-variables'
Write-Host 'TG: TG_BOT_TOKEN, TG_CHAT_ID в панели Vercel (Chrome). Деплой: git push.'
