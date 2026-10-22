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
