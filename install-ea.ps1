# PowerShell Script: Install MikapediaReporter EA to MT5
# Usage: Right-click → Run with PowerShell

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     MIKAPEDIA TOMS - EA Auto Installer                    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if EA source file exists
$sourcePath = Join-Path $PSScriptRoot "backend\scripts\MikapediaReporter.mq5"

if (-not (Test-Path $sourcePath)) {
    Write-Host "❌ Error: MikapediaReporter.mq5 not found!" -ForegroundColor Red
    Write-Host "   Expected location: $sourcePath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Please make sure you run this script from project root folder." -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "✅ Source file found: $sourcePath" -ForegroundColor Green
Write-Host ""

# Step 2: Find MT5 Experts folders
$mt5Base = "$env:APPDATA\MetaQuotes\Terminal"
$expertsFolders = Get-ChildItem "$mt5Base\*\MQL5\Experts" -Directory -ErrorAction SilentlyContinue

if ($expertsFolders.Count -eq 0) {
    Write-Host "❌ Error: No MT5 installation found!" -ForegroundColor Red
    Write-Host "   Expected location: $mt5Base" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Please install MetaTrader 5 first." -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "✅ Found $($expertsFolders.Count) MT5 installation(s)" -ForegroundColor Green
Write-Host ""

# Step 3: Copy EA to all MT5 installations
$copiedCount = 0
foreach ($folder in $expertsFolders) {
    $destPath = Join-Path $folder.FullName "MikapediaReporter.mq5"
    
    try {
        Copy-Item $sourcePath -Destination $destPath -Force
        Write-Host "   → Copied to: $($folder.FullName)" -ForegroundColor Gray
        $copiedCount++
    }
    catch {
        Write-Host "   ⚠ Failed to copy to: $($folder.FullName)" -ForegroundColor Yellow
        Write-Host "     Error: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""

if ($copiedCount -eq 0) {
    Write-Host "❌ Failed to copy EA to any MT5 installation" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "✅ EA copied to $copiedCount MT5 installation(s)" -ForegroundColor Green
Write-Host ""

# Step 4: Instructions
Write-Host "──────────────────────────────────────────────────────────" -ForegroundColor Cyan
Write-Host "📋 NEXT STEPS:" -ForegroundColor Cyan
Write-Host "──────────────────────────────────────────────────────────" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open MetaTrader 5" -ForegroundColor White
Write-Host "2. Press F4 to open MetaEditor" -ForegroundColor White
Write-Host "3. Navigator → Experts → Double-click MikapediaReporter.mq5" -ForegroundColor White
Write-Host "4. Press F7 to compile" -ForegroundColor White
Write-Host "5. Close MetaEditor and restart MT5" -ForegroundColor White
Write-Host "6. Navigator → Expert Advisors → MikapediaReporter should appear" -ForegroundColor White
Write-Host ""
Write-Host "──────────────────────────────────────────────────────────" -ForegroundColor Cyan
Write-Host ""

Write-Host "✅ Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "For detailed setup instructions, see:" -ForegroundColor Yellow
Write-Host "   - EA-INSTALLATION-GUIDE.md" -ForegroundColor Yellow
Write-Host "   - FIX-SIMULATION-DATA.md" -ForegroundColor Yellow
Write-Host ""

pause
