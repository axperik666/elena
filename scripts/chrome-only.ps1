# Только Google Chrome — Edge не используем никогда
$script:Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$script:ChromeBrowserCmd = Join-Path $PSScriptRoot 'chrome-browser.cmd'

function Open-Chrome {
    param([Parameter(Mandatory)][string]$Url)
    if (-not (Test-Path $script:Chrome)) {
        Write-Error "Chrome not found: $script:Chrome"
        return
    }
    Start-Process -FilePath $script:Chrome -ArgumentList $Url
}

function Set-ChromeForCli {
    # CLI на Windows игнорирует путь к chrome.exe — нужна .cmd-обёртка
    $env:BROWSER = $script:ChromeBrowserCmd
    $env:VERCEL_BROWSER = $script:ChromeBrowserCmd
}

Set-ChromeForCli
