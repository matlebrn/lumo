"""Outils communs aux tests de Lumo : on charge l'appli publiée (public/index.html) dans Chromium,
sans connexion ni réseau, avec des services factices à la place de Supabase."""
import os, threading, functools, http.server, socketserver, pytest
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'public')
FAKE = "window.KB={call:async()=>({})};window.KSA={email:()=>'test@exemple.fr',newRecovery:async()=>0,logout:()=>0,forget:()=>0};"
START = """()=>{document.getElementById('ksplash')?.remove();document.documentElement.classList.remove('kgated');document.body.classList.remove('kgated');
for(const id of ['kapp','kapp2']){const a=document.getElementById(id);const s=document.createElement('script');s.textContent=a.textContent;document.body.appendChild(s)}}"""


@pytest.fixture(scope='session')
def server():
    """Sert le dossier public/ en local, comme Vercel."""
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    H = functools.partial(Q, directory=PUB)
    httpd = socketserver.TCPServer(('127.0.0.1', 0), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f'http://127.0.0.1:{httpd.server_address[1]}'
    httpd.shutdown()


@pytest.fixture(scope='session')
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


class App:
    def __init__(self, page, errors):
        self.page, self.errors = page, errors

    def js(self, code, arg=None):
        """Exécute du code dans l'appli ; `code` est un corps de fonction."""
        return self.page.evaluate('async(__arg)=>{' + code + '}', arg)

    def wait(self, ms=150):
        self.page.wait_for_timeout(ms)


@pytest.fixture
def make_app(browser, server):
    """Ouvre l'appli déverrouillée, sans compte réel. make_app(dark=True) pour le thème sombre."""
    ctxs = []

    def _make(dark=False):
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, color_scheme='dark' if dark else 'light', service_workers='block')
        ctxs.append(ctx)
        ctx.add_init_script(FAKE)
        ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith(server) else r.abort())
        page = ctx.new_page(); errors = []
        page.on('pageerror', lambda e: errors.append(str(e)[:300]))
        page.goto(server + '/index.html'); page.wait_for_timeout(300)
        page.evaluate(START); page.wait_for_timeout(700)
        return App(page, errors)

    yield _make
    for c in ctxs: c.close()
