"""Convierte un .mpp a JSON (reutilizando extract.py) y lo publica en
Firestore, troceado y comprimido con gzip (mismo esquema que los modelos
BIM del visualizador: limite de 1 MB por documento en Firestore).

Se ejecuta desde el workflow "Procesar cronograma" cuando un administrador
sube un .mpp desde la app. Si algo falla, deja el estado "error" en
Firestore con el mensaje, para que la app lo muestre.

Uso:
    python procesar_cronograma.py <mpp_local> <slug> <nombre_proyecto> <subido_por>
"""
import sys
import os
import json
import gzip
import hashlib
import traceback
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

TAM_TROZO = 900 * 1024
COLECCION = "cronogramasGenerales"


def empaquetar(data):
    crudo = json.dumps(data, ensure_ascii=False).encode("utf-8")
    comprimido = gzip.compress(crudo)
    huella = hashlib.sha256(comprimido).hexdigest()
    trozos = [comprimido[i:i + TAM_TROZO] for i in range(0, len(comprimido), TAM_TROZO)]
    return trozos, huella, len(comprimido), len(crudo)


def publicar_error(db, slug, mensaje):
    db.collection(COLECCION).document(slug).set({
        "estado": "error",
        "mensaje": mensaje,
        "fecha": datetime.now(timezone.utc).isoformat(),
    }, merge=True)


def main():
    if len(sys.argv) != 5:
        print("Uso: python procesar_cronograma.py <mpp_local> <slug> <nombre_proyecto> <subido_por>")
        sys.exit(1)

    mpp_local, slug, nombre_proyecto, subido_por = sys.argv[1:5]

    import firebase_admin
    from firebase_admin import credentials, firestore

    cred = credentials.Certificate(os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"])
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    try:
        import jpype
        import mpxj  # noqa: F401  (registra el jar de MPXJ antes de iniciar la JVM)
        import jpype.imports
        from extract import extract_tasks

        jpype.startJVM(classpath=jpype.getClassPath())
        from org.mpxj.reader import UniversalProjectReader
        reader = UniversalProjectReader()

        tasks = extract_tasks(reader, mpp_local)
        jpype.shutdownJVM()

        if not tasks:
            raise ValueError("El archivo no contiene tareas reconocibles.")

        data = {
            "slug": slug, "nombreProyecto": nombre_proyecto, "tasks": tasks,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }
        trozos, huella, bytes_comp, bytes_orig = empaquetar(data)

        batch = db.batch()
        coleccion_trozos = db.collection(COLECCION).document(slug).collection("trozos")
        for i, trozo in enumerate(trozos):
            batch.set(coleccion_trozos.document(str(i)), {"data": trozo})
        batch.commit()

        db.collection(COLECCION).document(slug).set({
            "estado": "listo", "slug": slug, "nombreProyecto": nombre_proyecto,
            "totalTasks": len(tasks), "huella": huella, "bytes": bytes_comp,
            "bytesOriginales": bytes_orig, "numTrozos": len(trozos),
            "generatedAt": data["generatedAt"], "subidoPor": subido_por,
            "mensaje": "",
        })
        print(f"Cronograma de '{nombre_proyecto}' ({slug}) publicado: {len(tasks)} tareas, {len(trozos)} trozo(s).")
    except Exception as e:
        traceback.print_exc()
        publicar_error(db, slug, str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
