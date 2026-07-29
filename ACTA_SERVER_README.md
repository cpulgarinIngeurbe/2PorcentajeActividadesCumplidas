# Servidor Automático de Actas

## ¿Qué es esto?

Este servidor permite guardar automáticamente las actas de programación en el repositorio de GitHub sin necesidad de ingresar un token manualmente cada vez.

## Requisitos

- Python 3.6 o superior instalado
- Git configurado con acceso al repositorio
- El repositorio debe estar clonado localmente

## ¿Cómo funciona?

1. **El servidor** corre en tu máquina en `http://localhost:5000`
2. **Cuando presionas "Generar Acta"** en la aplicación web, se envían los datos al servidor
3. **El servidor** guarda el JSON en `data/actas/` y automáticamente hace `git commit` y `git push` a GitHub

No se solicita token ni contraseña porque Git ya está autenticado en tu máquina.

## Instalación

### Windows

1. Abre Command Prompt o PowerShell
2. Navega a la carpeta del proyecto:
   ```
   cd "C:\Users\cpulgarin\OneDrive - INGEURBE\1. Proyectos\0.1. Categorias\0.1.1. Automatización de procesos\A6.1. PAC 2"
   ```
3. Ejecuta el script:
   ```
   start_acta_server.bat
   ```

### Mac/Linux

```bash
python3 scripts/save_acta_server.py
```

## Uso

1. **Inicia el servidor** (ver instrucciones arriba)
2. **Abre la aplicación web** (índice HTML)
3. **Selecciona un proyecto y programa tareas** como lo haces normalmente
4. **Presiona el botón "Generar Acta"**
   - Se genera el PDF
   - Se guarda el JSON automáticamente en GitHub
   - ✅ Listo

## Troubleshooting

### Error: "No se pudo conectar al servidor de actas"

- **Solución**: Asegúrate de que el servidor está corriendo (deberías ver `🚀 Servidor de actas escuchando en http://localhost:5000`)

### Error: Git falló

- **Causa**: Posiblemente no tengas cambios por confirmar o hay un conflicto
- **Solución**: Ejecuta estos comandos en la terminal:
  ```
  git status
  git pull
  ```

### Error: "Python no encontrado"

- **Solución**: Descarga Python desde https://www.python.org/downloads/
- Al instalar, **marca** "Add Python to PATH"

## Archivos generados

Las actas se guardan en `data/actas/` con formato: `acta_YYYYMMDD_HHMMSS.json`

Ejemplo:
```
data/actas/acta_20260729_151234.json
```

## Detener el servidor

Presiona `Ctrl+C` en la ventana del servidor.

---

¿Preguntas? Revisa la estructura de los JSONs generados en `data/actas/`
