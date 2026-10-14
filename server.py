import os
import io
import json
from pathlib import Path
from tools.seo_pages import hymn_page, index_page
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "3000"))


class SPARequestHandler(SimpleHTTPRequestHandler):
    """Servidor estático con fallback SPA.

    Permite abrir URLs como /25 o /25?mode=karaoke recargando la página:
    si la ruta pedida no es un archivo existente y no tiene extensión,
    se sirve index.html para que el router del cliente resuelva la vista.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_head(self):
        self.range_remaining = None
        path = self.translate_path(self.path)
        # Sirve las páginas prerenderizadas cuando ROOT apunta a dist.
        clean_path = self.path.split("?", 1)[0].rstrip("/")
        if re.fullmatch(r"/(?:[1-9]\d*|himnos)", clean_path):
            relative = ("_hymns/" if clean_path != "/himnos" else "") + clean_path.lstrip("/") + ".html"
            generated = os.path.join(ROOT, relative)
            if os.path.isfile(generated):
                self.path = "/" + relative
                path = generated
            elif Path(ROOT, 'tools/seo_pages.py').is_file():
                # Desarrollo desde la raíz: el índice y las letras no deben
                # caer en la portada SPA ni depender de un dist anterior.
                catalog = json.loads(Path(ROOT, 'data/himnario-api.json').read_text(encoding='utf-8'))
                html = None
                if clean_path == '/himnos':
                    html = index_page(catalog)
                else:
                    hymn = next((h for h in catalog if str(h['number']) == clean_path[1:]), None)
                    if hymn:
                        template = Path(ROOT, 'index.html').read_text(encoding='utf-8')
                        html = hymn_page(template, hymn, Path(ROOT))
                if html is not None:
                    content = html.encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html; charset=utf-8')
                    self.send_header('Content-Length', str(len(content)))
                    self.end_headers()
                    return io.BytesIO(content)
        _, extension = os.path.splitext(path)

        if not os.path.exists(path) and not extension and not self.path.startswith("/data"):
            self.path = "/index.html"

        # Chromium necesita respuestas parciales para buscar dentro de un MP3.
        range_header = self.headers.get("Range")
        if range_header and os.path.isfile(path):
            match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
            size = os.path.getsize(path)
            if match and any(match.groups()):
                first, last = match.groups()
                start = int(first) if first else max(0, size - int(last))
                end = min(int(last), size - 1) if first and last else size - 1
                if start > end or start >= size:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return None
                stream = open(path, "rb")
                stream.seek(start)
                self.range_remaining = end - start + 1
                self.send_response(206)
                self.send_header("Content-Type", self.guess_type(path))
                self.send_header("Content-Length", str(self.range_remaining))
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                self.end_headers()
                return stream
        return super().send_head()

    def copyfile(self, source, outputfile):
        if self.range_remaining is None:
            return super().copyfile(source, outputfile)
        remaining = self.range_remaining
        while remaining > 0:
            chunk = source.read(min(64 * 1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)


    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()


def main():
    try:
        server = ThreadingHTTPServer(("", PORT), SPARequestHandler)
    except OSError as error:
        print(f"No se pudo abrir el puerto {PORT}: {error}")
        print(f"Puede estar en uso. Prueba otro puerto: PORT=3001 python3 server.py")
        raise SystemExit(1)

    print(f"Himnario Adventista -> http://localhost:{PORT}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
