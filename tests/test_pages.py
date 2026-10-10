import json
import unittest
from pathlib import Path
from tools.build_pages import ROOT, OUTPUT, build


class PagesBuildTests(unittest.TestCase):
    def test_static_output_preserves_data_and_excludes_audio(self):
        build()
        catalog = json.loads((OUTPUT / "data/himnario-api.json").read_text())
        self.assertEqual(len(catalog), 613)
        for source in [ROOT / "data/himnario-api.json", *(ROOT / "data/letras").rglob("*"), *(ROOT / "data/sync").rglob("*")]:
            if source.is_file():
                self.assertEqual(source.read_bytes(), (OUTPUT / source.relative_to(ROOT)).read_bytes())
        self.assertFalse((OUTPUT / "data/audios").exists())
        self.assertFalse(any(p.suffix.lower() in (".mp3", ".wav", ".ogg") for p in OUTPUT.rglob("*")))
        self.assertFalse((OUTPUT / "server.py").exists())
        self.assertTrue((OUTPUT / "404.html").exists())
        self.assertEqual((ROOT / "robots.txt").read_bytes(), (OUTPUT / "robots.txt").read_bytes())
        for verification in ("google559bc240c1dea629.html", "google3fcf1a30d77a5e34.html"):
            with self.subTest(verification=verification):
                self.assertTrue((OUTPUT / verification).is_file())
                self.assertEqual((ROOT / verification).read_bytes(), (OUTPUT / verification).read_bytes())
        rules = (OUTPUT / "_redirects").read_text().splitlines()
        self.assertEqual(len(rules), 613)
        self.assertIn('/1 /index.html 200', rules)
        self.assertIn('/613 /index.html 200', rules)
        self.assertNotIn('/* /index.html 200', rules)
        self.assertNotIn('./src/', (OUTPUT / 'index.html').read_text())


if __name__ == '__main__':
    unittest.main()
