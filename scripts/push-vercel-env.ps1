# НЕ использовать vercel CLI — на Windows открывает Edge вместо Chrome.
# Переменные окружения: lib/fb-config.js (сервер) или Vercel → Settings в Chrome.
# Деплой: git push origin main
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'chrome-only.ps1')
Write-Host 'vercel CLI отключён (открывал Edge).'
Write-Host 'FB: lib/fb-config.js | Деплой: git push | Панель:'
Open-Chrome 'https://vercel.com/axperik666/elena/settings/environment-variables'
