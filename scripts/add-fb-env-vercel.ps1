# Деплой на Vercel — только git push (НЕ vercel CLI — он открывает Edge!)
# Открыть панель Vercel в Google Chrome:
$Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
Start-Process -FilePath $Chrome -ArgumentList "https://vercel.com/axperik666/elena/deployments"
Write-Host "Деплой: git push origin main — Vercel подхватит сам."
Write-Host "Панель открыта в Google Chrome."
