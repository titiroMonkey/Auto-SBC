function Wait-AutoSbcReady {
    param($Process)
    $deadline = [DateTime]::UtcNow.AddSeconds(90)
    while ([DateTime]::UtcNow -lt $deadline) {
        if ($Process.HasExited) { throw 'The updated backend exited before becoming ready.' }
        try {
            $response = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/openapi.json' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            $schema = $response.Content | ConvertFrom-Json
            if ($null -ne $schema.paths) { return }
        } catch {
            if ($Process.HasExited) { throw 'The updated backend could not start.' }
        }
        Start-Sleep -Milliseconds 500
    }
    throw 'The updated backend did not become ready within 90 seconds.'
}

function Show-AutoSbcUpdateError {
    param($Text)
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($Text, 'AutoSBC update', 'OK', 'Error') | Out-Null
}

function Invoke-AutoSbcUpdate {
    param($Update)
    $ErrorActionPreference = 'Stop'
    $originalMoved = $false
    $replacement = $null
    try {
        Set-Content -LiteralPath (Join-Path $Update.directory 'helper-ready') -Value 'ready'
        $original = Get-Process -Id $Update.pid -ErrorAction SilentlyContinue
        if ($original -and -not $original.WaitForExit(120000)) {
            throw 'AutoSBC is still running. The update was not installed.'
        }
        $digest = (Get-FileHash -LiteralPath $Update.download -Algorithm SHA256).Hash
        if ($digest -ne $Update.sha256) { throw 'The downloaded update failed checksum verification.' }
        $deadline = [DateTime]::UtcNow.AddSeconds(30)
        while (-not $originalMoved) {
            try {
                Move-Item -LiteralPath $Update.target -Destination $Update.backup
                $originalMoved = $true
            } catch {
                if ([DateTime]::UtcNow -ge $deadline) { throw }
                Start-Sleep -Milliseconds 500
            }
        }
        Move-Item -LiteralPath $Update.download -Destination $Update.target
        $env:PYINSTALLER_RESET_ENVIRONMENT = '1'
        $env:AUTOSBC_SKIP_UPDATE_ONCE = '1'
        $replacement = Start-Process -FilePath $Update.target -WorkingDirectory $Update.cwd -PassThru
        Wait-AutoSbcReady -Process $replacement
    } catch {
        $failure = $_.Exception.Message
        try {
            if ($originalMoved) {
                if ($replacement -and -not $replacement.HasExited) {
                    & "$env:SystemRoot\System32\taskkill.exe" /PID $replacement.Id /T /F | Out-Null
                    if (-not $replacement.WaitForExit(10000)) { throw 'Could not stop the failed update.' }
                }
                if (Test-Path -LiteralPath $Update.target) { Remove-Item -LiteralPath $Update.target -Force }
                Move-Item -LiteralPath $Update.backup -Destination $Update.target
            }
            if (-not (Get-Process -Id $Update.pid -ErrorAction SilentlyContinue)) {
                $env:PYINSTALLER_RESET_ENVIRONMENT = '1'
                $env:AUTOSBC_SKIP_UPDATE_ONCE = '1'
                Start-Process -FilePath $Update.target -WorkingDirectory $Update.cwd | Out-Null
            }
        } catch {
            $failure += "`nRecovery failed: $($_.Exception.Message)`nBackup location: $($Update.backup)"
        }
        $failure | Set-Content -LiteralPath (Join-Path $Update.directory 'update-error.txt')
        Show-AutoSbcUpdateError -Text "The update could not be installed.`n`n$failure"
        return
    }
    try {
        Set-Location -LiteralPath $Update.cwd
        [Environment]::CurrentDirectory = $Update.cwd
        Remove-Item -LiteralPath $Update.directory -Recurse -Force
    } catch {
        Write-Warning 'Update installed; temporary update files could not be removed.'
    }
}