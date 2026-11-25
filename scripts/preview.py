"""Vista local con raíz explícita y sin caché. No publica en Internet."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse

class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(PreviewHandler, directory=str(root)))
    print(f'Raíz: {root}\nPanel: http://127.0.0.1:{args.port}/admin.html', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
