# 📅 Cómo guardar actas de programación

## ✨ Flujo automático (sin pedir nada)

1. **Abre la aplicación** (visualizador.html)
2. **Selecciona un proyecto y programa tareas**
3. **Presiona "Generar Acta"**
4. ✅ **Se guarda automáticamente en GitHub** (sin interrupciones)

## 🔧 Configuración inicial (una sola vez)

### Paso 1: Generar el token personal de acceso ✅ (Ya hecho)

1. Ve a: https://github.com/settings/tokens
2. Haz clic en **"Generate new token"** → **"Generate new token (classic)"**
3. Dale un nombre: `TOKEN_ACTAS`
4. En **Scopes**, selecciona **`repo`** (acceso completo al repositorio)
5. Copia el token (⚠️ No lo pierdas, no se mostrará de nuevo)

### Paso 2: Guardar en GitHub Secrets ✅ (Ya hecho)

1. Ve a: https://github.com/cpulgarinIngeurbe/2PorcentajeActividadesCumplidas/settings/secrets/actions
2. Haz clic en **"New repository secret"**
3. **Name:** `TOKEN_ACTAS` (exactamente así)
4. **Value:** Pega el token que copiaste
5. Click en **"Add secret"** ✅

### Paso 3: Listo

- El workflow se inyecta automáticamente
- No necesitas hacer nada más
- Cada que presiones "Generar Acta" se guarda automáticamente

## 📁 Dónde se guardan las actas

En el repositorio: **`ProgramacionesSemanales/`**

Nombre: `Programacion-YYYY-MM-DD-HH-MM-SS.json`

Ejemplo: `Programacion-2026-07-29-15-32-45.json`

## 📋 Contenido de cada acta

Cada archivo JSON contiene:
- ✅ Timestamp de creación
- ✅ Nombre del proyecto
- ✅ Total de tareas programadas
- ✅ Contratistas asignados
- ✅ Actividades con cantidades y unidades
- ✅ Fechas de inicio y cierre

## 🐛 Solución de problemas

**"Token de GitHub no configurado"**
→ Verifica que el secret `TOKEN_ACTAS` esté guardado en Settings → Secrets

**Error en la API de GitHub**
→ Asegúrate que el token tiene scope `repo`

**El workflow no genera el archivo**
→ Asegúrate que `TOKEN_ACTAS` está correctamente configurado
→ El workflow se ejecuta automáticamente al hacer push
