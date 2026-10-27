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

## 2026-10-27 14:13 (hora Colombia)

- Se reprogramó el "Proyecto de Pruebas" con un cronograma robusto (~1000 filas:
  20 capítulos × 5 subcapítulos × 9 actividades), con fechas de línea base
  repartidas entre pasado, presente y futuro (para poder probar filtros,
  PrePAC, etc.), y se limpiaron los datos de prueba antiguos ligados al
  cronograma anterior.
- Se agregó "Crear PrePAC": programa de un clic todas las actividades cuya
  línea base (inicio-fin) incluye el día de hoy, con el % de avance esperado
  según el plan original como cantidad (unidad "%"); el contratista queda
  pendiente de asignar.
- Se agregó un resumen automático al abrir cualquier proyecto, con dos
  pestañas: "Plan de contratación y compras" (actividades de ese capítulo,
  detectado por nombre, cuyo inicio en línea base cae dentro de un plazo
  configurable: 1/2/3/6 semanas o todas) y "Restricciones" (con el mismo
  filtro de plazo).
- Se agregó un borrador local en el navegador (localStorage) de la
  programación en curso: si se cierra la pestaña o falla el internet antes
  de "Finalizar reunión", se recupera automáticamente al volver a abrir el
  proyecto; se borra en cuanto el acta queda guardada de verdad en Firestore.
- Se agregó el registro fotográfico de avance para el proyecto PARKVIEW (y
  disponible para cualquier proyecto): botón para subir una foto desde el
  detalle de cada tarea, que se comprime en el navegador y se envía a una
  nueva GitHub Action (`subir-foto-sharepoint.yml`), la cual la sube al
  OneDrive de la cuenta de correo de la organización (vía Microsoft Graph,
  mismas credenciales que el envío de actas por correo) y registra el link
  más una miniatura en Firestore. Pestaña "Fotos" en el detalle de cada
  tarea y ventana general "Fotos" del proyecto, filtrable por capítulo.
  Requiere el secret `FIREBASE_SERVICE_ACCOUNT_JSON` en GitHub (ya
  configurado) y la regla de Firestore para `registroFotografico` (ya
  agregada).
- Se corrigió el error 422 al subir fotos (el límite de 64KB de
  `repository_dispatch` de GitHub): la imagen se redimensiona y comprime
  en el navegador antes de enviarla.
- Se agregó miniatura visible dentro de la app para cada foto subida (la
  Action la descarga vía Microsoft Graph y la guarda en base64 en
  Firestore, para que no dependa de sesión abierta en OneDrive ni caduque).
- Se agregó una ventana "📷 Fotos" con todas las fotos del proyecto,
  filtrable por capítulo.
- Se agregó la subida de **videos** de avance: a diferencia de las fotos,
  el video se sube directo del navegador a OneDrive (no pasa por GitHub,
  por el límite de 64KB) usando una sesión de subida de Microsoft Graph
  que crea una nueva GitHub Action (`crear-sesion-video.yml`); el
  navegador sube el archivo en pedazos mostrando una barra de progreso, y
  al terminar registra el resultado directo en Firestore. Requiere la
  regla de Firestore para `sesionesSubidaVideo` y el permiso de `create`
  en `registroFotografico` (ya agregadas).

## 2026-10-27 14:59 (hora Colombia)

- Se hizo la app responsive para celular, en tres fases:
  1. Base: se quitó el `zoom:0.8` del body en pantallas chicas (mal
     soportado en móviles), se colapsaron a una columna los formularios de
     grilla fija, las pestañas de los modales ahora se deslizan en vez de
     desbordarse, y se agrandaron botones pequeños para tocar con el dedo.
  2. La vista principal de programación (la tabla) se convierte en una
     lista de tarjetas (una por actividad) en celular, reusando toda la
     lógica existente de filtrado/render por CSS (sin duplicar código).
  3. El editor de "programar" dejó de depender solo de Enter/Esc del
     teclado físico (se agregaron botones "Guardar"/"Cancelar" visibles) y
     en celular se convierte en un panel que sube desde abajo, como una
     app nativa.
