<#
.SYNOPSIS
    Realtime OpenCV Visualizer Launcher for ESP32-CAM AI Vision
.EXAMPLE
    .\scripts\run_viewer.ps1 -Port COM6
#>
param (
    [string]$Port = "COM6",
    [string]$Url = "",
    [string]$Model = "auto",
    [int]$Baud = 2000000,
    [int]$Scale = 1
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ViewerScript = Join-Path $ScriptDir "python\live_viewer.py"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "    LAUNCHING ESP32-CAM REALTIME AI VISION VIEWER        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
if ($Url) {
    Write-Host "Stream URL : $Url" -ForegroundColor Green
} else {
    Write-Host "Port       : $Port" -ForegroundColor Green
    Write-Host "Baud       : $Baud" -ForegroundColor Green
}
Write-Host "Model      : $Model" -ForegroundColor Green
Write-Host "Hotkeys    : [1] 30 FPS QVGA | [2] 16 FPS HVGA | [F] Flash | [Y] YOLO | [C] Contrast | [S] Save | [Q] Exit" -ForegroundColor Yellow

# Free COM port if locked by a background monitor/viewer process
Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 400

if ($Url) {
    python $ViewerScript --url $Url --scale $Scale --model $Model
} else {
    python $ViewerScript --port $Port --baud $Baud --scale $Scale --model $Model
}
