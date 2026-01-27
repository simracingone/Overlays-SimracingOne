@echo off

:: ===============================
:: Vérification des droits Admin
:: ===============================
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo =====================================================
    echo   LANCEMENT EN MODE ADMINISTRATEUR REQUIS
    echo =====================================================
    echo.
    echo Ce script doit etre lance avec les droits administrateur.
    echo.
    echo Pour le faire :
    echo  1. Clic droit sur le fichier .bat
    echo  2. Selectionnez "Executer en tant qu'administrateur"
    echo.
    echo Le script va maintenant se fermer.
    echo.
    pause
    exit /b 1
)

setlocal EnableExtensions
title SimRacing One Overlay v3.2 - Navigateur
color 0B

:: On se place dans le dossier du script
cd /d "%~dp0"

echo =====================================================
echo         SIMRACING ONE OVERLAY - VERSION 3.2
echo =====================================================

REM --- NETTOYAGE ---
echo [1/3] Nettoyage des processus...
taskkill /f /im python.exe /t >nul 2>&1
echo [OK]

REM --- LANCEMENT DES SERVICES ---
echo [2/3] Lancement des services en arriere-plan...

:: Lancement du serveur vocal (Silencieux)
start /b "" ".venv\Scripts\python.exe" voice.py >nul 2>&1

:: Lancement de l'API (Affichage minimal des logs)
start /b "" ".venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000 --no-access-log

REM --- ATTENTE ET OUVERTURE ---
echo [3/3] Initialisation du HUD...
timeout /t 4 /nobreak >nul

echo [OK] Lancement du navigateur.
start "" "http://127.0.0.1:8000"

echo.
echo -----------------------------------------------------
echo  CONSIGNES V3.2 :
echo  - F12 : Mode Edition
echo  - F9  : Menu Visibilite (pendant F12)
echo  - F10 : Reset Layout
echo -----------------------------------------------------
echo.
echo Ne fermez pas cette fenetre si vous voulez garder l'overlay actif.