# Frontend Startup Script for Windows PowerShell
# Run this from the project root directory

Write-Host "Starting Hospitality Order Management System - Frontend" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "frontend/package.json")) {
    Write-Error "Please run this script from the project root directory"
    exit 1
}

# Navigate to frontend directory
Set-Location frontend

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    pnpm install
}

# Start the development server
Write-Host "Starting Next.js development server on http://localhost:3000" -ForegroundColor Green
Write-Host "" -ForegroundColor White
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor White

npx next dev