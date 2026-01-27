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



title Overlay Simracing One - Electron
:: On se place dans le dossier du script
cd /d "%~dp0"

echo =====================================================
echo         SIMRACING ONE OVERLAY - VERSION 3.2
echo =====================================================

REM Définition du chemin vers le Python local
set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"

REM Vérification si le venv existe
if not exist "%PYTHON_EXE%" (
    echo [ERREUR] Environnement virtuel introuvable. 
    echo Veuillez lancer install.bat d'abord.
    pause
    exit /b 1
)

REM Nettoyage des anciens processus Python
echo Nettoyage des anciens processus...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM pythonw.exe >nul 2>&1

REM Lancement serveur vocal Flask (via le venv)
echo Lancement du serveur vocal (Flask + pygame)...
start "Serveur Vocal" /B "%PYTHON_EXE%" voice.py

REM Lancement API FastAPI (via le venv)
echo Lancement de l'API FastAPI (port 8000)...
:: Utilisation de uvicorn standard pour éviter les erreurs de WebSockets
start "API FastAPI" /B "%PYTHON_EXE%" -m uvicorn main:app --host 127.0.0.1 --port 8000 --log-level error

REM Attente 5 secondes pour initialisation
echo Initialisation en cours (5s)...
timeout /t 5 /nobreak >nul

REM Lancement Electron
echo Lancement de l'interface Electron...
:: On utilise call pour npx pour que le script continue après
call npx electron .

echo.
echo --- Overlay Electron demarre ---
echo NE FERMEZ PAS CETTE FENETRE
pause