@echo off
REM Script para iniciar el servidor de actas en Windows
REM Este servidor es necesario para guardar las actas en GitHub automáticamente

echo.
echo ====================================================
echo  Servidor de Actas - Programa de Obra
echo ====================================================
echo.

REM Verificar si Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no está instalado o no está en el PATH
    echo.
    echo Descarga Python desde: https://www.python.org/downloads/
    echo Asegúrate de marcar "Add Python to PATH" durante la instalación
    pause
    exit /b 1
)

echo [✓] Python encontrado
echo.
echo Iniciando servidor en http://localhost:5000
echo Presiona Ctrl+C para detener
echo.
echo ====================================================
echo.

python scripts/save_acta_server.py
