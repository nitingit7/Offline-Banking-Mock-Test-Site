"""Open this copy of Practice Desk at the same local address on every visit."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen
import webbrowser

ROOT = Path(__file__).resolve().parent / "docs"
ADDRESS = ("127.0.0.1", 8766)
URL = "http://127.0.0.1:8766/"

class PracticeHandler(SimpleHTTPRequestHandler):
    def list_directory(self, path):
        self.send_error(404)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, *args):
        pass

def open_desk():
    if not (ROOT / "index.html").is_file():
        raise SystemExit("Extract the whole ZIP first. Keep the docs folder next to this launcher.")
    try:
        server = ThreadingHTTPServer(ADDRESS, partial(PracticeHandler, directory=str(ROOT)))
    except OSError:
        try:
            with urlopen(URL + "desk-id.txt", timeout=2) as response:
                if response.read(80).strip() == b"Practice Desk - banking exams":
                    webbrowser.open(URL)
                    return
        except (OSError, URLError):
            pass
        raise SystemExit("Port 8766 is in use. Close the program using it, then reopen Practice Desk.")
    print("Practice Desk is ready at " + URL)
    print("Keep this window open while practising. Press Ctrl+C to stop the local site.")
    webbrowser.open(URL)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == "__main__":
    open_desk()

