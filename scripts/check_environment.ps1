# Environment Pre-flight Check for ESP32-CAM Development
$env:PYTHONIOENCODING = "utf-8"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     ESP32-CAM AI VISION - ENVIRONMENT PRE-FLIGHT CHECK   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Python
Write-Host "[1/4] Checking Python Runtime..." -ForegroundColor Yellow
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pyVer = & python --version 2>&1
    Write-Host "  Found: $pyVer" -ForegroundColor Green
} else {
    Write-Host "  WARNING: python not found in PATH." -ForegroundColor Red
}

# 2. Check PlatformIO
Write-Host "[2/4] Checking PlatformIO CLI..." -ForegroundColor Yellow
$PioCmd = $null
if (Get-Command pio -ErrorAction SilentlyContinue) {
    $PioCmd = "pio"
} elseif (Test-Path "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe") {
    $PioCmd = "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe"
}

if ($PioCmd) {
    $pioVer = & $PioCmd --version 2>&1
    Write-Host "  Found: $pioVer" -ForegroundColor Green
} else {
    Write-Host "  ERROR: PlatformIO Core is not installed!" -ForegroundColor Red
}

# 3. Check COM Ports
Write-Host "[3/4] Enumerating Serial Ports..." -ForegroundColor Yellow
$comPorts = [System.IO.Ports.SerialPort]::GetPortNames()
if ($comPorts.Count -eq 0) {
    Write-Host "  WARNING: No COM ports found! Check USB cable and CH340 driver." -ForegroundColor Red
} else {
    $pnpDevs = Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match "\(COM\d+\)" }
    foreach ($p in $pnpDevs) {
        Write-Host "  Port Detected: $($p.Name)" -ForegroundColor Green
    }
}

# 4. Hardware Probe via esptool
Write-Host "[4/4] Probing ESP32 Hardware via esptool..." -ForegroundColor Yellow
$esptoolPy = "$env:USERPROFILE\.platformio\packages\tool-esptoolpy\esptool.py"
$pyPenv = "$env:USERPROFILE\.platformio\penv\Scripts\python.exe"

if ((Test-Path $esptoolPy) -and (Test-Path $pyPenv) -and ($comPorts.Count -gt 0)) {
    $targetPort = $comPorts[0]
    Write-Host "  Probing $targetPort..." -ForegroundColor Yellow
    try {
        $probe = & $pyPenv $esptoolPy --port $targetPort flash_id 2>&1
        $chipLine = $probe | Where-Object { $_ -match "Chip is" }
        $flashLine = $probe | Where-Object { $_ -match "Detected flash size" }
        $macLine = $probe | Where-Object { $_ -match "MAC:" }

        if ($chipLine) { Write-Host "  $chipLine" -ForegroundColor Green }
        if ($flashLine) { Write-Host "  $flashLine" -ForegroundColor Green }
        if ($macLine) { Write-Host "  $macLine" -ForegroundColor Green }
    } catch {
        $errMsg = $_.Exception.Message
        Write-Host "  Communication failed: $errMsg" -ForegroundColor Red
    }
} else {
    Write-Host "  Skipping active probe: tool-esptoolpy not located or no COM ports available." -ForegroundColor Yellow
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Environment Check Complete." -ForegroundColor Cyan
