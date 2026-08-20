# Extensión ACC Sync (Ingeurbe)

Extensión de Chrome que muestra un botón circular flotante cuando estás en
el submódulo **Schedule** de **ACC Build**, por ejemplo:

```
https://acc.autodesk.com/build/schedule/projects/ce619a54-c780-411b-afc9-3545f20c38c4
```

## Estado actual (paso 1)

El botón solo aparece/desaparece según la página en la que estés. Todavía
**no hace nada** al hacer clic — eso se conecta en el siguiente paso
(sincronizar la programación de ACC con el repositorio de GitHub).

## Cómo instalarla (modo desarrollador)

1. Abre `chrome://extensions` en Chrome.
2. Activa "Modo de desarrollador" (interruptor arriba a la derecha).
3. Haz clic en "Cargar descomprimida" ("Load unpacked").
4. Selecciona esta carpeta (`ExtensionACC`).
5. Entra a un proyecto de ACC Build, ve a Schedule, y el botón circular con
   el logo de Ingeurbe debería aparecer abajo a la derecha.

Cada vez que se modifique el código de la extensión, hay que volver a
`chrome://extensions` y darle a "Actualizar" (o recargar la extensión) para
que Chrome tome los cambios.
