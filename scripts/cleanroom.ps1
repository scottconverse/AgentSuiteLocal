# AgentSuiteLocal — cleanroom distributable test
#
# Copies dist/AgentSuiteLocal/ to a fresh temp folder and runs the EXE
# with a clean environment (no PYTHONPATH, no system Python/Node in PATH).
#
# Asserts:
#   - / serves HTML
#   - /api/runtime/verify   all_ok == true (all 6 bundle checks pass)
#   - /api/settings         returns model_tier
#   - /api/ollama/status    responds (running may be false — that's OK)
#   - /api/pipelines        returns a pipelines list
#   - /api/runs             returns a runs list
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\cleanroom.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\cleanroom.ps1 -KeepOnFailure
#
# Prerequisite: dist/AgentSuiteLocal/ built via 'make dist'

param(
    [switch]$KeepOnFailure   # keep temp dir on failure for inspection
)

$ErrorActionPreference = 'Stop'

$ROOT  = Split-Path $PSScriptRoot -Parent
$DIST  = Join-Path $ROOT "dist\AgentSuiteLocal"
$LOG   = Join-Path $env:USERPROFILE ".agentsuitelocal\launcher.log"

Write-Host ""
Write-Host "=== AgentSuiteLocal cleanroom test ==="
Write-Host ""

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------

if (-not (Test-Path $DIST)) {
    Write-Error "dist\AgentSuiteLocal not found. Run 'make dist' first."
    exit 1
}

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

$CLEANROOM = Join-Path $env:TEMP "agentsuitelocal-cleanroom-$(Get-Random)"
New-Item -ItemType Directory -Path $CLEANROOM | Out-Null
Write-Host "Cleanroom dir  : $CLEANROOM"

$proc  = $null
$PASS  = $true
$failed = [System.Collections.Generic.List[string]]::new()

try {
    # -----------------------------------------------------------------------
    # Copy dist into cleanroom
    # -----------------------------------------------------------------------
    Write-Host "Copying dist   : $DIST -> $CLEANROOM"
    Copy-Item -Path $DIST -Destination $CLEANROOM -Recurse -Force
    $exePath = Join-Path $CLEANROOM "AgentSuiteLocal\AgentSuiteLocal.exe"

    if (-not (Test-Path $exePath)) {
        throw "EXE not found at: $exePath"
    }
    $exeSize = [math]::Round((Get-Item $exePath).Length / 1MB, 1)
    Write-Host "EXE            : $exePath ($exeSizeMB MB)"

    # -----------------------------------------------------------------------
    # Build clean environment (strip Python, Node, conda from PATH)
    # -----------------------------------------------------------------------
    $pinfo = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo.FileName        = $exePath
    $pinfo.UseShellExecute = $false
    $pinfo.WorkingDirectory = Split-Path $exePath -Parent

    foreach ($pair in [System.Environment]::GetEnvironmentVariables('Process').GetEnumerator()) {
        if ($pair.Key -eq 'PATH') {
            $cleanPath = ($pair.Value -split ';' | Where-Object {
                $_ -notmatch 'Python'    -and
                $_ -notmatch '[Nn]ode'   -and
                $_ -notmatch '[Nn]pm'    -and
                $_ -notmatch '[Cc]onda'  -and
                $_ -notmatch '[Aa]naconda'
            }) -join ';'
            $pinfo.EnvironmentVariables['PATH'] = $cleanPath
        } elseif ($pair.Key -notin @('PYTHONPATH','PYTHONHOME','PYTHONSTARTUP','VIRTUAL_ENV')) {
            $pinfo.EnvironmentVariables[$pair.Key] = $pair.Value
        }
    }
    $pinfo.EnvironmentVariables['PYTHONPATH'] = ''
    $pinfo.EnvironmentVariables['PYTHONHOME'] = ''

    # -----------------------------------------------------------------------
    # Start EXE
    # -----------------------------------------------------------------------
    Remove-Item -Force $LOG -ErrorAction SilentlyContinue

    Write-Host "Starting EXE..."
    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $pinfo
    $proc.Start() | Out-Null

    # -----------------------------------------------------------------------
    # Wait for launcher.log to record the port (up to 25s)
    # -----------------------------------------------------------------------
    Write-Host "Waiting for server startup..."
    $deadline = (Get-Date).AddSeconds(25)
    $port     = $null

    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 400
        if (Test-Path $LOG) {
            $content = Get-Content $LOG -Raw
            if ($content -match 'using port (\d+)') {
                $port = [int]$Matches[1]
                break
            }
            if ($content -match 'CRASHED') {
                throw "EXE crashed at startup.`nLog:`n$content"
            }
        }
    }

    if (-not $port) {
        $logContent = if (Test-Path $LOG) { Get-Content $LOG -Raw } else { '(no log)' }
        throw "Server did not log a port within 25s.`nLog:`n$logContent"
    }

    # Wait for TCP to accept
    $deadline = (Get-Date).AddSeconds(8)
    while ((Get-Date) -lt $deadline) {
        try {
            $tcp = [System.Net.Sockets.TcpClient]::new('127.0.0.1', $port)
            $tcp.Close()
            break
        } catch { Start-Sleep -Milliseconds 200 }
    }

    $baseUrl = "http://127.0.0.1:$port"
    Write-Host "Server ready   : $baseUrl"
    Write-Host ""

    # -----------------------------------------------------------------------
    # Checks
    # -----------------------------------------------------------------------

    function Assert($name, $url, [scriptblock]$ok, [string]$expectJson = '') {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
            if ($expectJson) {
                $body = $r.Content | ConvertFrom-Json
                $result = & $ok $body
            } else {
                $result = & $ok $r
            }
            $status = if ($result) { 'PASS' } else { 'FAIL' }
            $marker = if ($result) { [char]0x2713 } else { [char]0x2717 }
            Write-Host "  [$marker] $name"
            if (-not $result) { $failed.Add($name) }
        } catch {
            Write-Host "  [x] $name  -- $_"
            $failed.Add($name)
        }
    }

    Write-Host "Checks:"
    Assert "GET / serves HTML"              "$baseUrl/"                  { param($r) $r.Content -match '<!DOCTYPE html' }
    Assert "/api/runtime/verify all_ok"     "$baseUrl/api/runtime/verify" { param($b) $b.all_ok -eq $true } -expectJson 1
    Assert "/api/runtime/verify agentsuite" "$baseUrl/api/runtime/verify" {
        param($b) ($b.checks | Where-Object { $_.name -like '*agentsuite*' }).ok -eq $true
    } -expectJson 1
    Assert "/api/settings model_tier"       "$baseUrl/api/settings"       { param($b) $null -ne $b.model_tier } -expectJson 1
    Assert "/api/ollama/status responds"    "$baseUrl/api/ollama/status"  { param($b) $null -ne $b.running    } -expectJson 1
    Assert "/api/pipelines returns list"    "$baseUrl/api/pipelines"      { param($b) $null -ne $b.pipelines  } -expectJson 1
    Assert "/api/runs returns list"         "$baseUrl/api/runs"           { param($b) $null -ne $b.runs       } -expectJson 1

    Write-Host ""
    if ($failed.Count -eq 0) {
        Write-Host "Result: PASS - all checks green." -ForegroundColor Green
    } else {
        Write-Host "Result: FAIL - $($failed.Count) check(s) failed: $($failed -join ', ')" -ForegroundColor Red
        $PASS = $false
    }

} catch {
    Write-Host ""
    Write-Host "Cleanroom test ERROR: $_" -ForegroundColor Red
    $PASS = $false
} finally {
    Write-Host ""

    # Kill process
    if ($proc -and -not $proc.HasExited) {
        $proc.Kill()
        $proc.WaitForExit(3000) | Out-Null
    }
    Stop-Process -Name "AgentSuiteLocal" -Force -ErrorAction SilentlyContinue

    # Cleanup
    if ($PASS -or -not $KeepOnFailure) {
        Remove-Item -Recurse -Force $CLEANROOM -ErrorAction SilentlyContinue
        Write-Host "Cleanroom dir removed."
    } else {
        Write-Host "Kept for inspection: $CLEANROOM"
    }
    Write-Host ""
}

exit $(if ($PASS) { 0 } else { 1 })
