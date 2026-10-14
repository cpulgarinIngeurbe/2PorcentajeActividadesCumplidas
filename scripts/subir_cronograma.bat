@echo off
setlocal

rem Convierte un .mpp a JSON (con MPXJ) y lo publica en Firestore, sin pasar
rem por GitHub (evita el limite de tamano de archivo de su API).
rem
rem Antes de usarlo la primera vez, ajusta estas dos rutas si cambian:
set JAVA_HOME=%LOCALAPPDATA%\pac-jdk17
set FIREBASE_SERVICE_ACCOUNT_JSON=%USERPROFILE%\Downloads\pac-ingeurbe-firebase-adminsdk-fbsvc-c77da174fa.json
set PATH=%JAVA_HOME%\bin;%PATH%

echo ============================================
echo   Subir cronograma general a PAC Ingeurbe
echo ============================================
echo.

if not exist "%JAVA_HOME%\bin\java.exe" (
  echo ERROR: no se encontro Java en %JAVA_HOME%
  pause
  exit /b 1
)
if not exist "%FIREBASE_SERVICE_ACCOUNT_JSON%" (
  echo ERROR: no se encontro la credencial de Firebase en %FIREBASE_SERVICE_ACCOUNT_JSON%
  echo Ajusta la linea FIREBASE_SERVICE_ACCOUNT_JSON de este archivo .bat si la moviste.
  pause
  exit /b 1
)

echo Elige el archivo .mpp en la ventana que se va a abrir...
for /f "usebackq delims=" %%F in (`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Title = 'Elige el cronograma (.mpp)'; $d.Filter = 'MS Project (*.mpp)|*.mpp|Todos los archivos (*.*)|*.*'; if ($d.ShowDialog() -eq 'OK') { Write-Output $d.FileName }"`) do set MPP_PATH=%%F

if "%MPP_PATH%"=="" (
  echo No se eligio ningun archivo. Cancelado.
  pause
  exit /b 1
)
echo Archivo elegido: %MPP_PATH%
echo.

set /p SLUG="Slug del proyecto (ej. proyectoalbura, igual al que ya usa la app): "
set /p NOMBRE="Nombre visible del proyecto (ej. ProyectoAlbura): "
set /p SUBIDO_POR="Tu correo: "

echo.
echo Procesando, puede tardar varios minutos en cronogramas grandes...
echo.

python "%~dp0procesar_cronograma.py" "%MPP_PATH%" "%SLUG%" "%NOMBRE%" "%SUBIDO_POR%"

echo.
pause
