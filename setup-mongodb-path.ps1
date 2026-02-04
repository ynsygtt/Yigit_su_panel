#!/usr/bin/env powershell
# MongoDB PATH Setup Script
# Must run as Administrator!

param([switch]$Force)

Write-Host "`n=================================" -ForegroundColor Cyan
Write-Host "  MongoDB PATH Setup Script" -ForegroundColor Cyan
Write-Host "=================================`n" -ForegroundColor Cyan

# Check if MongoDB is installed
$mongoPath = (Get-Command mongod -ErrorAction SilentlyContinue).Source

if (-not $mongoPath) {
    Write-Host "ERROR: MongoDB not found!" -ForegroundColor Red
    Write-Host "Please install MongoDB first: https://www.mongodb.com/try/download/community`n" -ForegroundColor Yellow
    exit 1
}

# Get bin folder path
$mongoBinPath = Split-Path -Parent $mongoPath

Write-Host "MongoDB Path Found: $mongoBinPath`n" -ForegroundColor Green

# Get current PATH
$userPath = [Environment]::GetEnvironmentVariable('PATH', 'User')

# Check if already in PATH
if ($userPath -like "*$mongoBinPath*") {
    Write-Host "SUCCESS: MongoDB is already in PATH!`n" -ForegroundColor Green
    Write-Host "Test command: mongod --version`n" -ForegroundColor Cyan
    exit 0
}

# Check for admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin -and -not $Force) {
    Write-Host "WARNING: This script requires Administrator privileges!`n" -ForegroundColor Yellow
    Write-Host "Please open PowerShell as Administrator and run again:`n" -ForegroundColor Yellow
    Write-Host "  powershell -Command `"Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process; & '$PSCommandPath'`"`n" -ForegroundColor Cyan
    exit 1
}

# Add to PATH
try {
    $newPath = "$userPath;$mongoBinPath"
    [Environment]::SetEnvironmentVariable('PATH', $newPath, 'User')
    Write-Host "SUCCESS: MongoDB added to PATH!`n" -ForegroundColor Green
    Write-Host "IMPORTANT: Please open a new PowerShell window for changes to take effect`n" -ForegroundColor Yellow
    Write-Host "Test command:`n" -ForegroundColor Cyan
    Write-Host "  mongod --version`n" -ForegroundColor White
} catch {
    Write-Host "ERROR: $_`n" -ForegroundColor Red
    exit 1
}

