# Chrome Process Cleanup Script for Datrix WhatsApp Bot
# Run this when the bot gets stuck at "Initializing WhatsApp client"

Write-Host "🧹 Cleaning up Chrome processes..." -ForegroundColor Yellow

# Kill all Chrome processes (including Chromium used by Puppeteer)
$processes = @("chrome", "chromium")
foreach ($proc in $processes) {
    $running = Get-Process -Name $proc -ErrorAction SilentlyContinue
    if ($running) {
        Write-Host "  Stopping $proc processes..." -ForegroundColor Cyan
        Stop-Process -Name $proc -Force -ErrorAction SilentlyContinue
    }
}

# Wait a moment for processes to fully terminate
Start-Sleep -Seconds 2

# Check if any remain
$remaining = Get-Process -Name "chrome", "chromium" -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "⚠️  Some Chrome processes still running. Trying again..." -ForegroundColor Red
    Stop-Process -InputObject $remaining -Force -ErrorAction SilentlyContinue
}

Write-Host "✅ Chrome processes cleaned up" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "  1. If you want to KEEP your login session (no QR code):" -ForegroundColor White
Write-Host "     npm start" -ForegroundColor Green
Write-Host ""
Write-Host "  2. If you want to FORCE new login (will need QR code):" -ForegroundColor White
Write-Host "     Remove-Item -Path '.wwebjs_auth' -Recurse -Force" -ForegroundColor Yellow
Write-Host "     npm start" -ForegroundColor Green
Write-Host ""
