# Только Google Chrome — Edge не используем
$script:Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"

function Open-Chrome {
    param([Parameter(Mandatory)][string]$Url)
    if (-not (Test-Path $script:Chrome)) {
        Write-Error "Chrome not found: $script:Chrome"
        return
    }
    Start-Process -FilePath $script:Chrome -ArgumentList $Url
}

function Set-ChromeForCli {
    $env:BROWSER = $script:Chrome
    $env:VERCEL_BROWSER = $script:Chrome
}

Set-ChromeForCli
