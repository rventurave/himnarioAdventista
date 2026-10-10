import unittest
from html.parser import HTMLParser
from tools.build_pages import ROOT


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
    def test_home_metadata_without_descriptive_paragraphs(self):
        html = (ROOT / "index.html").read_text()
        parser = HeadParser()
        parser.feed(html)
        self.assertEqual(parser.language, "es")
        self.assertIn("Himnario Adventista del Séptimo Día", parser.title)
        self.assertIn("613", parser.title)
        self.assertIn("karaoke", parser.meta["description"])
        self.assertIn("width=device-width", parser.meta["viewport"])
        self.assertEqual(parser.meta["og:type"], "website")
        self.assertEqual(parser.meta["og:locale"], "es_ES")
        self.assertTrue(parser.meta["og:title"])
        self.assertTrue(parser.meta["og:description"])
        self.assertIn('<h1 class="app-title">Himnario Adventista</h1>', html)
        self.assertNotIn('home-description', html)
        self.assertNotIn('Consulta online los 613 himnos', html)
        self.assertNotIn('Selecciona Letra para recorrer las estrofas', html)
        self.assertNotIn('name="keywords"', html)
        self.assertNotIn('.mp3', html)


if __name__ == "__main__":
    unittest.main()
