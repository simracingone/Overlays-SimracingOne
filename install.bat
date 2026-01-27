@echo off
setlocal EnableExtensions EnableDelayedExpansion
title SimracingOne - Installateur (Version Finale)
color 0B

REM =====================================================
REM 1. DEFINIR LE DOSSIER PROJET
REM =====================================================
cd /d "%~dp0"
set "PROJECT_DIR=%CD%"

echo =====================================================
echo    INSTALLATION SIMRACING ONE (CORRIGEE + WEBSOCKETS)
echo =====================================================
echo.

REM =====================================================
REM 2. DROITS ADMIN
REM =====================================================
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Lancer ce fichier en tant qu'administrateur.
    pause
    exit /b 1
)

REM =====================================================
REM 3. NODE.JS
REM =====================================================
echo [+] Verification de Node.js...
call npm -v >nul 2>&1
if %errorlevel% neq 0 (
    echo    Node.js absent, installation...
    set "NODE_MSI=node-v20.11.0-x64.msi"
    set "NODE_URL=https://nodejs.org/dist/v20.11.0/%NODE_MSI%"
    powershell -Command "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%TEMP%\%NODE_MSI%'"
    msiexec /i "%TEMP%\%NODE_MSI%" /qn /norestart
    set "PATH=%PATH%;C:\Program Files\nodejs\"
)
echo    [OK] Node.js operationnel.

REM =====================================================
REM 5. INSTALLATION node_modules
REM =====================================================
echo [+] Installation des dependances Electron...
call npm install --no-audit --no-fund

REM =====================================================
REM 6. ENVIRONNEMENT PYTHON (VENV LOCAL)
REM =====================================================
echo [+] Configuration de l'environnement Python local...

set "SYS_PYTHON="
for %%P in (python.exe py.exe) do (
    where %%P >nul 2>&1
    if !errorlevel! equ 0 (
        set "SYS_PYTHON=%%P"
        goto :CREATE_VENV
    )
)

echo [ERREUR] Python est introuvable sur votre systeme.
pause
exit /b 1

:CREATE_VENV
if not exist ".venv" (
    echo    Creation du dossier .venv...
    "%SYS_PYTHON%" -m venv .venv
)

set "PYTHON_EXE=%PROJECT_DIR%\.venv\Scripts\python.exe"

REM =====================================================
REM 7. DEPENDANCES PYTHON (INCLUANT WEBSOCKETS)
REM =====================================================
echo [+] Installation des dependances Python dans le venv...
"%PYTHON_EXE%" -m pip install --upgrade pip

echo    Installation de pyirsdk, uvicorn[standard] et modules web...
REM Ajout de uvicorn[standard], websockets et wsproto pour le flux de donnees iRacing
"%PYTHON_EXE%" -m pip install fastapi uvicorn[standard] websockets wsproto edge-tts pygame flask flask-cors pyirsdk

REM Verification finale de l'import
"%PYTHON_EXE%" -c "import irsdk, fastapi, uvicorn, websockets" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] L'installation des modules Python a echoue.
    pause
    exit /b 1
)

echo    [OK] Environnement Python, iRacing SDK et WebSockets valides.
echo.

REM =====================================================
REM 8. PARE-FEU
REM =====================================================
echo [+] Configuration du pare-feu...
netsh advfirewall firewall add rule name="SimracingOne" dir=in action=allow protocol=TCP localport=5000,8000,3000 profile=any >nul 2>&1
echo    [OK] Ports ouverts.

echo =====================================================
echo    INSTALLATION v3.2. TERMINEE AVEC SUCCES
echo =====================================================
pause