import importlib.util
from pathlib import Path
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from urllib.parse import quote

spec = importlib.util.spec_from_file_location('hymn_server', Path(__file__).resolve().parents[1] / 'server.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RangeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        class QuietHandler(module.SPARequestHandler):
            def log_message(self, *args):
                pass
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.file = next((Path(module.ROOT) / 'data/letras').glob('*.txt'))
        cls.path = '/' + quote(str(cls.file.relative_to(module.ROOT)))
        cls.content = cls.file.read_bytes()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, value):
        connection = HTTPConnection('127.0.0.1', self.server.server_port)
        connection.request('GET', self.path, headers={'Range': value})
        response = connection.getresponse()
        status, headers, data = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return status, headers, data

    def test_closed_range(self):
        status, headers, data = self.request('bytes=2-9')
        self.assertEqual(status, 206)
        self.assertEqual(data, self.content[2:10])
        self.assertEqual(headers['Content-Range'], f'bytes 2-9/{len(self.content)}')

    def test_open_range(self):
        status, _, data = self.request('bytes=20-')
        self.assertEqual(status, 206)
        self.assertEqual(data, self.content[20:])

    def test_suffix_range(self):
        status, _, data = self.request('bytes=-10')
        self.assertEqual(status, 206)
        self.assertEqual(data, self.content[-10:])

    def test_invalid_range(self):
        status, headers, data = self.request(f'bytes={len(self.content)}-')
        self.assertEqual(status, 416)
        self.assertEqual(headers['Content-Range'], f'bytes */{len(self.content)}')
        self.assertEqual(data, b'')


if __name__ == '__main__':
    unittest.main()
