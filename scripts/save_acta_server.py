#!/usr/bin/env python3
"""
Servidor simple para guardar actas en GitHub automáticamente.
Uso: python save_acta_server.py
Escucha en http://localhost:5000 y acepta POST con JSON del acta.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
import subprocess
from datetime import datetime
from urllib.parse import urlparse

# Directorio donde se guardarán las actas
ACTAS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'actas')

class ActaHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Maneja POST para guardar acta."""
        if self.path != '/save-acta':
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'{"error": "No encontrado"}')
            return

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            acta_data = json.loads(body.decode('utf-8'))

            # Generar nombre del archivo con timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'acta_{timestamp}.json'
            filepath = os.path.join(ACTAS_DIR, filename)

            # Asegurar que el directorio existe
            os.makedirs(ACTAS_DIR, exist_ok=True)

            # Guardar el JSON
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(acta_data, f, ensure_ascii=False, indent=2)

            # Hacer commit y push automáticamente
            try:
                # Git add
                subprocess.run(['git', 'add', f'data/actas/{filename}'],
                             cwd=os.path.dirname(os.path.dirname(__file__)),
                             check=True, capture_output=True)

                # Git commit
                commit_msg = f"Guarda acta de programación: {acta_data.get('project', 'Sin nombre')} - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
                subprocess.run(['git', 'commit', '-m', commit_msg],
                             cwd=os.path.dirname(os.path.dirname(__file__)),
                             check=True, capture_output=True)

                # Git push
                subprocess.run(['git', 'push'],
                             cwd=os.path.dirname(os.path.dirname(__file__)),
                             check=True, capture_output=True)

                push_status = "✅ Guardado y sincronizado con GitHub"
            except subprocess.CalledProcessError as e:
                # El archivo se guardó localmente aunque el push falle
                push_status = f"⚠️ Guardado localmente pero git falló: {e.stderr.decode('utf-8', errors='ignore')[:100]}"
                print(f"Git error: {e.stderr.decode('utf-8', errors='ignore')}")

            # Respuesta exitosa
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            response = {
                'success': True,
                'filename': filename,
                'message': push_status,
                'path': f'data/actas/{filename}'
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"error": "JSON inválido"}')
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {'error': str(e)}
            self.wfile.write(json.dumps(response).encode('utf-8'))

    def do_OPTIONS(self):
        """Maneja CORS preflight."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        """Suprime logs innecesarios."""
        print(f"[{self.log_date_time_string()}] {format % args}")

if __name__ == '__main__':
    PORT = 5000
    server = HTTPServer(('localhost', PORT), ActaHandler)
    print(f"🚀 Servidor de actas escuchando en http://localhost:{PORT}")
    print(f"📁 Las actas se guardarán en: {ACTAS_DIR}")
    print("Presiona Ctrl+C para detener el servidor")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n✋ Servidor detenido")
