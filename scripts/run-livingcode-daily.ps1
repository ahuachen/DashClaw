param(
    [string]$RepoPath = "C:\Projects\DashClaw",
    [string]$PythonCommand = "python",
    [string]$LogDir = "C:\Projects\DashClaw\.organism\logs"
)

$ErrorActionPreference = "Stop"

function Write-RunLog {
    param([string]$Message)

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $entry = "[$timestamp] $Message"
    Write-Host $entry
    Add-Content -Path $script:LogPath -Value $entry
}

function Invoke-LivingcodeStep {
    param([string]$Step)

    Write-RunLog "START $Step"
    & $PythonCommand -m livingcode $Step 2>&1 | Tee-Object -FilePath $script:LogPath -Append
    if ($LASTEXITCODE -ne 0) {
        throw "livingcode $Step failed with exit code $LASTEXITCODE"
    }
    Write-RunLog "DONE $Step"
}

if (-not (Test-Path $RepoPath)) {
    throw "Repo path not found: $RepoPath"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$logStamp = Get-Date -Format "yyyy-MM-dd"
$script:LogPath = Join-Path $LogDir ("livingcode-daily-" + $logStamp + ".log")

Push-Location $RepoPath
try {
    Write-RunLog "BEGIN livingcode daily run"
    Write-RunLog "RepoPath=$RepoPath"

    Invoke-LivingcodeStep -Step "sense"
    Invoke-LivingcodeStep -Step "plan"
    Invoke-LivingcodeStep -Step "review"

    Write-RunLog "COMPLETE livingcode daily run"
}
catch {
    Write-RunLog "FAILED livingcode daily run: $($_.Exception.Message)"
    throw
}
finally {
    Pop-Location
}
