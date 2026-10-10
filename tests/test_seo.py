import unittest
import threading
import urllib.request
import xml.etree.ElementTree as ET
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from html.parser import HTMLParser
from tools.build_pages import ROOT, OUTPUT, build


class HeadParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta = {}
        self.links = {}
        self.title = ""
        self.in_title = False
        self.language = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "html":
            self.language = attrs.get("lang")
        elif tag == "title":
            self.in_title = True
        elif tag == "meta":
            self.meta[attrs.get("name", attrs.get("property"))] = attrs.get("content")
        elif tag == "link":
            self.links[attrs.get("rel")] = attrs.get("href")

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


class SeoHtmlTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        build()

    def test_home_metadata_without_descriptive_paragraphs(self):
        self.assertEqual((ROOT / "index.html").read_bytes(), (OUTPUT / "index.html").read_bytes())
        html = (OUTPUT / "index.html").read_text()
        parser = HeadParser()
        parser.feed(html)
        self.assertEqual(parser.language, "es")
        self.assertEqual(parser.title, "Himnario Adventista del Séptimo Día | 613 Himnos")
        self.assertEqual(parser.meta["description"], "Himnario Adventista del Séptimo Día con 613 himnos. Consulta las letras, escucha audios cantados e instrumentales y utiliza el modo karaoke.")
        self.assertEqual(parser.links["canonical"], "https://himnario-adventista.pages.dev/")
        self.assertIn("width=device-width", parser.meta["viewport"])
        self.assertEqual(parser.meta["og:type"], "website")
        self.assertEqual(parser.meta["og:locale"], "es_ES")
        self.assertEqual(parser.meta["og:title"], parser.title)
        self.assertEqual(parser.meta["og:description"], parser.meta["description"])
        self.assertEqual(parser.meta["og:url"], parser.links["canonical"])
        self.assertNotIn('noindex', html.lower())
        self.assertIn('<h1 class="app-title">Himnario Adventista</h1>', html)
        self.assertNotIn('home-description', html)
        self.assertNotIn('Consulta online los 613 himnos', html)
        self.assertNotIn('Selecciona Letra para recorrer las estrofas', html)
        self.assertNotIn('name="keywords"', html)
        self.assertNotIn('.mp3', html)

    def test_sitemap_xml_and_crawler_access(self):
        tree = ET.parse(OUTPUT / "sitemap.xml")
        namespace = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
        self.assertEqual(tree.getroot().tag, namespace + 'urlset')
        self.assertEqual([loc.text for loc in tree.findall(f'{namespace}url/{namespace}loc')], ['https://himnario-adventista.pages.dev/'])
        robots = (OUTPUT / "robots.txt").read_text()
        self.assertIn('User-agent: *\nAllow: /', robots)
        self.assertIn('Sitemap: https://himnario-adventista.pages.dev/sitemap.xml', robots)
        self.assertNotIn('Disallow:', robots)

    def test_published_files_over_local_http(self):
        handler = partial(SimpleHTTPRequestHandler, directory=str(OUTPUT))
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            base = f'http://127.0.0.1:{server.server_port}'
            for path in ('index.html', 'robots.txt', 'sitemap.xml'):
                with self.subTest(path=path), urllib.request.urlopen(f'{base}/{path}', timeout=5) as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.geturl(), f'{base}/{path}')
                    self.assertEqual(response.read(), (OUTPUT / path).read_bytes())
                    self.assertNotIn('noindex', response.headers.get('X-Robots-Tag', '').lower())
                    if path == 'sitemap.xml':
                        self.assertIn(response.headers.get_content_type(), ('application/xml', 'text/xml'))
        finally:
            server.shutdown()
            server.server_close()
            worker.join()


if __name__ == "__main__":
    unittest.main()
