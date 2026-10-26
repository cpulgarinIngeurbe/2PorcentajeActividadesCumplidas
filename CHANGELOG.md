# Registro de cambios - PAC Ingeurbe

> Nota: este log registra cambios de la aplicación (código), no datos operativos.
> Los datos operativos (actas, calificaciones, PAC, restricciones, auditoría) viven
> únicamente en Firestore, nunca en este repositorio.

## 2026-10-22 13:51 (hora Colombia)

- Se crea este registro de cambios.
- Se eliminaron los datos de prueba de actas/calificaciones/PAC en Firestore para
  pasar a producción con datos reales.
- Se creó el proyecto "Proyecto de Pruebas" (slug `pruebas`) en Firestore, exclusivo
  para pruebas sin afectar los proyectos productivos.
- Se creó la rama `desarrollo` para implementar nuevas funcionalidades sin afectar
  `main` (producción). Solo los push a `main` disparan el deploy a GitHub Pages.
- Se implementó el log de auditoría (`registrarAuditoria`): cada registro nuevo
  (actas, calificaciones, PAC, restricciones, config, cantidades PAC, actividades
  manuales) queda guardado en la colección `auditoria` de Firestore con usuario,
  fecha y hora. Disponible por ahora solo en la rama `desarrollo`.
- Se agregó `scripts/probar_rama_desarrollo.bat` para probar la rama `desarrollo`
  en local contra el Firestore real.
- Se creó un acceso directo en el escritorio con el logo de la aplicación.

## 2026-10-26 10:14 (hora Colombia)

- Se publicó a producción (`main`) todo el trabajo de la rama `desarrollo`:
  - Registro de auditoría (incluye inicio/cierre de sesión) y pantalla "Ver auditoría".
  - Edición de nombres de contratistas y equipo administrativo.
  - Observación opcional junto a "No Cumplió" en la calificación semanal.
  - Capítulo/subcapítulo visible al filtrar por nombre y en "Solo programadas"
    (tabla, Gantt y PDF del acta), con colores por nivel de WBS.
  - Edición de una tarea ya programada desde "Solo programadas".
  - Corrección: el agente de voz ya no borraba tareas programadas manualmente.
  - Corrección: el correo del acta no se estaba enviando (dependía de un bucket
    de Firebase Storage que nunca se creó); ahora se envía como HTML con toda
    la información del acta, sin adjunto PDF.
  - Limpieza de "trozos" huérfanos en Firestore al resubir una versión del cronograma.
  - Interruptor para activar/desactivar el agente de voz desde Parametrización.
  - Cambio del agente de voz al esquema "clásico" de ElevenLabs (voz → texto →
    LLM → voz), que permite elegir el modelo de lenguaje (antes solo dejaba
    elegir entre dos modelos de voz propios de ElevenLabs, sin control de costo).
- Se agregó la herramienta de voz `registrar_restriccion`, para registrar
  restricciones de obra por comando de voz.
- Se agregó la ventana "Restricciones" (botón en la barra superior) con todas
  las restricciones del proyecto abierto, filtrable por tipo y por responsable,
  ordenada por fecha de cumplimiento más próxima.
- Se agregó una pestaña "Restricciones" en el detalle de cada tarea.
- Se corrigió que las ventanas de administración (auditoría, restricciones,
  agente de voz, etc.) no tenían forma de cerrarse.
