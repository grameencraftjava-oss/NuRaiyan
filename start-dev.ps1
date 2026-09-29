# Nuraiyan Quick Launcher for Windows PowerShell
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      Nuraiyan - আধুনিক সোশ্যাল নেটওয়ার্ক প্ল্যাটফর্ম      " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "1. Docker দিয়ে PostgreSQL ও Redis চালু করা" -ForegroundColor Green
Write-Host "2. ব্যাকএন্ড চালু করা (Port 5000)" -ForegroundColor Green
Write-Host "3. ফ্রন্টএন্ড চালু করা (Port 3000)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

$env:PATH = "C:\Program Files\nodejs;" + $env:PATH

# Start backend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PATH = 'C:\Program Files\nodejs;' + `$env:PATH; cd '$PSScriptRoot\backend'; npm run dev"

# Start frontend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PATH = 'C:\Program Files\nodejs;' + `$env:PATH; cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host "🚀 ব্যাকএন্ড এবং ফ্রন্টএন্ড দুটি পৃথক টার্মিনালে চালু হচ্ছে..." -ForegroundColor Green
Write-Host "ফ্রন্টএন্ড দেখতে ব্রাউজারে যান: http://localhost:3000" -ForegroundColor Yellow
