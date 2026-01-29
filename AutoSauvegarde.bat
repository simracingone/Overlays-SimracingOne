@echo off
title Sauvegarde Overlay SimracingOne Overlaus iRacing
setlocal enabledelayedexpansion

:: Fix pour l'heure (évite l'espace vide le matin)
set hh=%time:~0,2%
if "%hh:~0,1%"==" " set hh=0%hh:~1,1%
set backupDir=BACKUPS\Backup_%date:~-4%-%date:~3,2%-%date:~0,2%_%hh%h%time:~3,2%

echo ==========================================
echo    LANCEMENT DE LA SAUVEGARDE
echo ==========================================
echo Destination : %backupDir%
echo.

:: Création du dossier de secours
mkdir "%backupDir%"

:: 1. COPIE DES FICHIERS À LA RACINE
echo [+] Copie des fichiers racine...
copy ".gitignore" "%backupDir%" >nul
copy "AutoSauvegarde.bat" "%backupDir%" >nul
copy "changelog.md" "%backupDir%" >nul
copy "data.py" "%backupDir%" >nul
copy "favicon.ico" "%backupDir%" >nul
copy "index.html" "%backupDir%" >nul
copy "install.bat" "%backupDir%" >nul
copy "main.js" "%backupDir%" >nul
copy "main.py" "%backupDir%" >nul
copy "notice securite.txt" "%backupDir%" >nul
copy "package.json" "%backupDir%" >nul
copy "preload.js" "%backupDir%" >nul
copy "release.md" "%backupDir%" >nul
copy "run Electron.bat" "%backupDir%" >nul
copy "run navigateur.bat" "%backupDir%" >nul
copy "voice.py" "%backupDir%" >nul
copy "%~nx0" "%backupDir%" >nul




:: 2. COPIE DES RÉPERTOIRES (L'élément manquant)
:: /E : copie les sous-dossiers, même vides
:: /I : crée le dossier s'il n'existe pas
:: /Y : écrase sans demander
echo [+] Copie des dossiers (js, css, iracing)...

if exist "js" xcopy "js" "%backupDir%\js" /E /I /Y >nul
if exist "css" xcopy "css" "%backupDir%\css" /E /I /Y >nul
if exist "iracing" xcopy "iracing" "%backupDir%\iracing" /E /I /Y >nul
if exist "assets" xcopy "assets" "%backupDir%\assets" /E /I /Y >nul

echo.
echo ==========================================
echo    SAUVEGARDE v3.2. TERMINEE AVEC SUCCES !
echo ==========================================
pause