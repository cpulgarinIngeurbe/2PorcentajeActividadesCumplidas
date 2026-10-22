@echo off
setlocal
title PAC Ingeurbe - Probar rama desarrollo
cd /d "%~dp0\.."

echo ============================================
echo  Probando la rama DESARROLLO en este PC
echo ============================================
echo.

git fetch origin --quiet
rem -uno: ignora archivos sueltos sin seguimiento (fotos, Excel, .mpp, etc.
rem que viven solo en este PC); solo interesa si hay cambios en archivos
rem que SI estan versionados, que son los que un cambio de rama si afecta.
git status --porcelain -uno > "%TEMP%\pac_git_status.txt"
for %%A in ("%TEMP%\pac_git_status.txt") do set TAMANO=%%~zA
if not "%TAMANO%"=="0" (
  echo [!] Hay cambios sin guardar en tu copia local. Guardalos o descartalos
  echo     antes de cambiar de rama, para no perderlos.
  echo.
  pause
  exit /b 1
)

git checkout desarrollo
git pull origin desarrollo

echo.
echo Iniciando servidor local en el puerto 8910...
start "PAC Ingeurbe (desarrollo)" http://localhost:8910/visualizador.html
cd template
python -m http.server 8910
