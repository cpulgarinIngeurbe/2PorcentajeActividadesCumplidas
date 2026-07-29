"""Ensambla el sitio final para GitHub Pages: copia el template (shell) como
index.html y coloca junto a el los JSON de datos (uno por proyecto mas
manifest.json) generados por extract.py.

Uso:
    python build_html.py <template_html> <directorio_datos_json> <directorio_salida>
"""
import sys
import os
import shutil


def main():
    if len(sys.argv) != 4:
        print("Uso: python build_html.py <template_html> <directorio_datos_json> <directorio_salida>")
        sys.exit(1)

    template_path, data_dir, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]

    os.makedirs(out_dir, exist_ok=True)
    shutil.copyfile(template_path, os.path.join(out_dir, "index.html"))

    out_data_dir = os.path.join(out_dir, "data")
    if os.path.exists(out_data_dir):
        shutil.rmtree(out_data_dir)
    shutil.copytree(data_dir, out_data_dir)

    print(f"Sitio generado en {out_dir}")


if __name__ == "__main__":
    main()
