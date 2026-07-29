"""Inyecta el token de GitHub y el nombre del repo como variables globales en
el index.html ya construido, justo antes de </head>.

Uso:
    python inject_token.py <index_html> <token> <repo>
"""
import sys
import json


def main():
    if len(sys.argv) != 4:
        print("Uso: python inject_token.py <index_html> <token> <repo>")
        sys.exit(1)

    html_path, token, repo = sys.argv[1], sys.argv[2], sys.argv[3]

    if not token:
        print("ERROR: token vacio (revisa el secret TOKEN_ACTAS)", file=sys.stderr)
        sys.exit(1)

    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()

    script = (
        "<script>window.GITHUB_TOKEN = " + json.dumps(token) +
        "; window.GITHUB_REPO = " + json.dumps(repo) +
        ";</script></head>"
    )

    if "</head>" not in html:
        print("ERROR: no se encontro </head> en el html", file=sys.stderr)
        sys.exit(1)

    html = html.replace("</head>", script, 1)

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)

    print("Token inyectado en", html_path)


if __name__ == "__main__":
    main()
