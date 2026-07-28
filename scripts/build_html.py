"""Inyecta el JSON de tareas en el template HTML y genera el sitio final.

Uso:
    python build_html.py <template_html> <tasks_json> <salida_html>
"""
import sys


def main():
    if len(sys.argv) != 4:
        print("Uso: python build_html.py <template_html> <tasks_json> <salida_html>")
        sys.exit(1)

    template_path, tasks_json_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]

    with open(template_path, "r", encoding="utf-8") as f:
        template = f.read()

    with open(tasks_json_path, "r", encoding="utf-8") as f:
        tasks_json = f.read()

    html = template.replace("__TASKS_JSON__", tasks_json)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"Generado {out_path}")


if __name__ == "__main__":
    main()
