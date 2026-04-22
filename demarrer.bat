@echo off
title Fiche Light PFT
cd /d "%~dp0"

echo.
echo  ====================================
echo   Fiche Light PFT - Demarrage...
echo  ====================================
echo.

:: Ajouter Node.js au PATH
set PATH=%PATH%;C:\Program Files\nodejs;%APPDATA%\npm

:: Verifier Node.js
where node >nul 2>&1
if errorlevel 1 (
  echo  ERREUR : Node.js introuvable.
  echo  Installez Node.js depuis https://nodejs.org
  pause
  exit /b 1
)

echo  Node.js detecte :
node --version

:: Liberer le port 3003
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3003 "') do (
  taskkill /F /PID %%a >nul 2>&1
)

:: Installer les dependances si node_modules absent
if not exist "node_modules" (
  echo  Installation des dependances...
  npm install
  if errorlevel 1 (
    echo  ERREUR lors de npm install
    pause
    exit /b 1
  )
)

:: Lancer le serveur dans une nouvelle fenetre
echo  Demarrage du serveur...
start "Fiche Light PFT - Serveur" cmd /c "node server.js & pause"

:: Attendre que le serveur soit pret
timeout /T 4 /NOBREAK >nul

:: Ouvrir le navigateur
start "" "http://localhost:3003"

echo.
echo  Serveur demarre ! Gardez la fenetre "Serveur" ouverte.
echo.
pause
