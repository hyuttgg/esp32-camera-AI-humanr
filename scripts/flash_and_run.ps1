[CmdletBinding()]
param (
    [string]$Port = "",
    [ValidateSet("build", "flash", "run", "diagnostic")]
    [string]$Mode = "run",
    [int]$BaudRate = 460800,
    [int]$Duration = 0
)

$ErrorActionPreference = "Stop"
$env:PYTHONIOENCODING = "utf-8"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$LogsDir = Join-Path $ProjectDir "logs"
if (!(Test-Path $LogsDir)) { New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null }

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$LogFile = Join-Path $LogsDir "firmware_${Mode}_${Timestamp}.log"

function Append-LogLines {
    param([object]$Lines)
    if (-not $Lines) { return }
    $strLines = @($Lines) | ForEach-Object { "$_" }
    for ($i = 0; $i -lt 5; $i++) {
        try {
            [System.IO.File]::AppendAllLines($LogFile, $strLines, [System.Text.Encoding]::UTF8)
            break
        } catch {
            Start-Sleep -Milliseconds 40
        }
    }
}

function Write-Log {
    param (
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timeStr = Get-Date -Format "HH:mm:ss"
    $color = "White"
    switch ($Level) {
        "INFO"    { $color = "Green" }
        "WARN"    { $color = "Yellow" }
        "ERROR"   { $color = "Red" }
        "STEP"    { $color = "Cyan" }
        "SUCCESS" { $color = "Magenta" }
    }
    $line = "[$timeStr] [$Level] $Message"
    Write-Host $line -ForegroundColor $color
    Append-LogLines @($line)
}

Write-Log "==========================================================" "STEP"
Write-Log "       ESP32-CAM AI VISION - AUTOMATION PIPELINE          " "STEP"
Write-Log "==========================================================" "STEP"
Write-Log "Project Root : $ProjectDir" "INFO"
Write-Log "Target Mode  : $Mode" "INFO"
Write-Log "Log Target   : $LogFile" "INFO"

# Step 1: Discover PlatformIO CLI
Write-Log "Step 1: Locating PlatformIO Core..." "STEP"
$PioCmd = $null
if (Get-Command pio -ErrorAction SilentlyContinue) {
    $PioCmd = "pio"
} elseif (Test-Path "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe") {
    $PioCmd = "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe"
} else {
    Write-Log "PlatformIO CLI not found in PATH or ~/.platformio! Please install PlatformIO." "ERROR"
    exit 1
}
$PioVersion = & $PioCmd --version 2>&1
Write-Log "PlatformIO Version: $PioVersion" "SUCCESS"

# Step 2: COM Port Discovery & Validation
if ($Mode -ne "build") {
    Write-Log "Step 2: Detecting Connected USB Serial Devices..." "STEP"
    
    $AllComPorts = [System.IO.Ports.SerialPort]::GetPortNames()
    if ($AllComPorts.Count -eq 0) {
        Write-Log "No COM ports detected on Windows! Check USB cable, ESP32-CAM-MB adapter, and CH340 drivers." "ERROR"
        exit 1
    }

    $PnpDevices = @()
    try {
        $PnpDevices = Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "\(COM\d+\)" }
        foreach ($dev in $PnpDevices) {
            Write-Log "Found Port: $($dev.Name)" "INFO"
        }
    } catch {
        Write-Log "WMI/CIM scan restricted, falling back to System.IO.Ports ($($AllComPorts -join ', '))" "WARN"
    }

    if ([string]::IsNullOrWhiteSpace($Port)) {
        $Match = $null
        if ($PnpDevices) {
            $Match = $PnpDevices | Where-Object { $_.Name -match "CH340|CP210|FTDI|USB-SERIAL|USB Serial" } | Select-Object -First 1
        }
        if ($Match -and ($Match.Name -match "\(COM(\d+)\)")) {
            $Port = "COM" + $Matches[1]
            Write-Log "Auto-selected target port: $Port ($($Match.Name))" "SUCCESS"
        } else {
            if ($AllComPorts.Count -eq 1) {
                $Port = $AllComPorts[0]
                Write-Log "Single COM port detected, selected: $Port" "SUCCESS"
            } else {
                Write-Log "Multiple COM ports present. Please specify port with -Port COMX" "ERROR"
                Write-Log "Available ports: $($AllComPorts -join ', ')" "WARN"
                exit 1
            }
        }
    } else {
        if ($AllComPorts -notcontains $Port) {
            Write-Log "Specified port '$Port' is not connected! Available: $($AllComPorts -join ', ')" "ERROR"
            exit 1
        }
        Write-Log "Using user-specified port: $Port" "INFO"
    }
}

# Step 3: Compilation
Write-Log "Step 3: Compiling Firmware..." "STEP"
Push-Location $ProjectDir
try {
    $BuildOutput = & $PioCmd run 2>&1
    $BuildSuccess = ($LASTEXITCODE -eq 0)
    
    Append-LogLines $BuildOutput
    foreach ($line in $BuildOutput) {
        if ($line -match "error:|fatal error:") {
            Write-Host "  $line" -ForegroundColor Red
        }
    }

    if (-not $BuildSuccess) {
        Write-Log "Build FAILED with exit code $LASTEXITCODE. See $LogFile for full trace." "ERROR"
        Pop-Location
        exit 1
    }
    Write-Log "Firmware Compilation PASSED successfully." "SUCCESS"
} catch {
    $errMessage = $_.Exception.Message
    Write-Log "Exception during compilation: $errMessage" "ERROR"
    Pop-Location
    exit 1
}

if ($Mode -eq "build") {
    Write-Log "Build mode finished. Exiting." "SUCCESS"
    Pop-Location
    exit 0
}

# Step 4: Firmware Flashing
Write-Log "Step 4: Uploading Firmware to $Port..." "STEP"
Write-Log "NOTE: If using an ESP32-CAM without auto-reset MB shield, ensure GPIO0 is tied to GND during flash!" "WARN"

# Automatically release COM port if locked by Arduino IDE serial-monitor or background python
$lockers = Get-Process serial-monitor, serial-discovery -ErrorAction SilentlyContinue
if ($lockers) {
    Write-Log "Detected background serial monitor process. Terminating to release $Port..." "WARN"
    $lockers | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 600
}

try {
    $UploadOutput = & $PioCmd run --target upload --upload-port $Port 2>&1
    $UploadSuccess = ($LASTEXITCODE -eq 0)

    Append-LogLines $UploadOutput
    foreach ($line in $UploadOutput) {
        if ($line -match "Connecting|Writing at|Leaving|Hard resetting") {
            Write-Host "  $line" -ForegroundColor Cyan
        }
    }

    if (-not $UploadSuccess) {
        Write-Log "Firmware Upload FAILED. Possible reasons:" "ERROR"
        Write-Log "1. COM port is locked by another terminal (close other Serial monitors)." "WARN"
        Write-Log "2. ESP32 not in bootloader mode (hold down IO0/BOOT button and tap RESET)." "WARN"
        Write-Log "3. Cable only supplies data lines without enough current (use high-gauge USB cable)." "WARN"
        Pop-Location
        exit 1
    }
    Write-Log "Firmware Flashed Successfully to $Port!" "SUCCESS"
    if ($Mode -eq "flash") {
        Write-Log "Flash mode complete. COM port $Port is now FREE for live stream visualizer!" "SUCCESS"
        Write-Log "Run 'python .\scripts\python\live_viewer.py --port $Port --baud $BaudRate' to open GUI stream." "INFO"
        Pop-Location
        exit 0
    }
} catch {
    $errMessage = $_.Exception.Message
    Write-Log "Exception during flash: $errMessage" "ERROR"
    Pop-Location
    exit 1
}

# Step 5: Hardware Reset & Serial Monitoring
Write-Log "Step 5: Triggering Hardware Reset and Starting Live Serial Stream..." "STEP"
Write-Log "If GPIO0 was tied to GND for manual flashing, UNPLUG GPIO0 FROM GND NOW to boot application!" "WARN"
Write-Log "Opening Monitor at $BaudRate baud (Press Ctrl+C to terminate)..." "INFO"

$PyMonitorPath = Join-Path $ScriptDir "python\live_monitor.py"
$PyExe = "$env:USERPROFILE\.platformio\penv\Scripts\python.exe"
if (-not (Test-Path $PyExe)) { $PyExe = "python.exe" }

if ($Duration -gt 0) {
    & $PyExe $PyMonitorPath --port $Port --baud $BaudRate --logfile $LogFile --duration $Duration
} else {
    & $PyExe $PyMonitorPath --port $Port --baud $BaudRate --logfile $LogFile
}

Pop-Location
Write-Log "Execution complete. Full session log saved to: $LogFile" "SUCCESS"
