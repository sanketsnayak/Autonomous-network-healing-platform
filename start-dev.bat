@echo off
REM Autonomous Network Healing Platform - Development Startup Script
REM This script starts both backend and frontend development servers

echo Starting Autonomous Network Healing Platform...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if we're in the correct directory
if not exist "Backend" (
    echo Error: Backend directory not found
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

if not exist "FrontEnd" (
    echo Error: FrontEnd directory not found
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

echo Checking backend dependencies...
cd Backend
if not exist "node_modules" (
    echo Installing backend dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo Error: Failed to install backend dependencies
        pause
        exit /b 1
    )
)

echo Checking if MongoDB is configured...
if not exist ".env" (
    echo Warning: .env file not found in Backend directory
    echo Please copy .env.example to .env and configure your settings
    pause
)

echo Starting backend server...
start "Backend Server" cmd /k "npm run dev"

cd ..\FrontEnd

echo Checking frontend dependencies...
if not exist "node_modules" (
    echo Installing frontend dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo Error: Failed to install frontend dependencies
        pause
        exit /b 1
    )
)

echo Starting frontend development server...
start "Frontend Server" cmd /k "npm run dev"

echo.
echo ===============================================
echo Autonomous Network Healing Platform Started!
echo ===============================================
echo.
echo Backend API: http://localhost:5000/api
echo Frontend UI: http://localhost:5173
echo Health Check: http://localhost:5000/api/health
echo.
echo Both servers are starting in separate windows.
echo Close those windows or press Ctrl+C to stop the servers.
echo.
echo If this is your first time running the platform:
echo 1. Make sure MongoDB is running and configured in Backend/.env
echo 2. Run 'npm run setup' in the Backend directory to create sample data
echo 3. Access the frontend at http://localhost:5173
echo.
pause
