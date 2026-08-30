# Backend Startup Script for Windows PowerShell
# Run this from the project root directory

Write-Host "Starting Hospitality Order Management System - Backend" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "backend/manage.py")) {
    Write-Error "Please run this script from the project root directory"
    exit 1
}

# Navigate to backend directory
Set-Location backend

# Check if virtual environment exists
if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1"

# Install/upgrade dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
pip install --upgrade pip
pip install -r requirements.txt

# Run migrations
Write-Host "Running database migrations..." -ForegroundColor Yellow
python manage.py migrate --noinput

# Start the server
Write-Host "Starting Django server on http://localhost:8000" -ForegroundColor Green
Write-Host "GraphQL endpoint: http://localhost:8000/graphql/" -ForegroundColor Cyan
Write-Host "WebSocket endpoint: ws://localhost:8000/ws/operations/" -ForegroundColor Cyan
Write-Host "" -ForegroundColor White
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor White

python manage.py runserver 8000