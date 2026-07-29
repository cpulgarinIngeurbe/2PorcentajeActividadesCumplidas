# 📅 Cómo guardar actas de programación

## Flujo simple

1. **Abre la aplicación** (visualizador.html)
2. **Selecciona un proyecto y programa tareas**
3. **Presiona "Generar Acta"**
4. **En la primera vez**: Se pedirá un token de GitHub (solo UNA VEZ)
5. **Se guarda automáticamente** en `ProgramacionesSemanales/` del repositorio

## Obtener el token de GitHub

Si no tienes uno:

1. Ve a: https://github.com/settings/tokens
2. Haz clic en **"Generate new token"** → **"Generate new token (classic)"**
3. Dale un nombre: `Actas de Programación`
4. Selecciona el scope **`repo`**
5. Copia el token y pégalo en el prompt
6. ✅ Se guardará automáticamente en tu navegador

## Después de la primera vez

- El token se guarda en localStorage de tu navegador
- Ya NO se pedirá el token de nuevo
- Solo presionas el botón y se guarda

## Dónde se guardan las actas

En el repositorio, en: **`ProgramacionesSemanales/`**

Con formato: `Programacion-2026-07-29-15-32-45.json`

## ¿Olvidaste el token?

Abre la consola del navegador y ejecuta:

```javascript
localStorage.removeItem('github_token');
```

La próxima vez que presiones el botón, pedirá el token nuevamente.

## Requisitos

- Token de GitHub con permisos de repositorio (`repo`)
- Conexión a internet (para comunicarse con GitHub API)
