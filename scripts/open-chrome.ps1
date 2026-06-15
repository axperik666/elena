# Всегда открывать ссылки в Google Chrome (не Edge)
$Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $Chrome)) {
    Write-Error "Chrome not found: $Chrome"
    exit 1
}
$url = $args -join ' '
if (-not $url) {
    Write-Host "Usage: open-chrome.ps1 <url>"
    exit 1
}
Start-Process -FilePath $Chrome -ArgumentList $url
