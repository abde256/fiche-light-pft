@echo off
title Fiche Light PFT
echo.
echo  ====================================
echo   Fiche Light PFT - Demarrage...
echo  ====================================
echo.

cd /d "%~dp0"

:: Ajouter Node.js au PATH (au cas ou)
set PATH=%PATH%;C:\Program Files\nodejs

:: Verifier que node est disponible
where node >nul 2>&1
if errorlevel 1 (
  echo  ERREUR : Node.js n'est pas installe ou introuvable.
  echo  Telechargez-le sur https://nodejs.org
  pause
  exit /b 1
)

:: Liberer le port 3003 si deja utilise
echo  Liberation du port 3003...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3003 "') do (
  taskkill /F /PID %%a >nul 2>&1
)

:: Installer les dependances
echo  Verification des dependances...
npm install
echo.

:: Ouvrir le navigateur et lancer le serveur
echo  Ouverture du navigateur...
start "" "http://localhost:3003"
echo  Serveur en cours de demarrage sur http://localhost:3003
echo  (Fermez cette fenetre pour arreter le serveur)
echo.
node server.js

echo.
echo  ====================================
echo   Serveur arrete.
echo  ====================================
pause
