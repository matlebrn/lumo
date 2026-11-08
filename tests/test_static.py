"""Vérifications sans navigateur : syntaxe des scripts publiés et en-têtes de sécurité."""
import json, os, subprocess, shutil, pytest
from conftest import ROOT, PUB


@pytest.mark.parametrize('f', ['boot.js', 'sw.js'])
def test_scripts_valides(f):
    if not shutil.which('node'): pytest.skip('node absent')
    subprocess.run(['node', '--check', os.path.join(PUB, f)], check=True)


def test_entetes_de_securite():
    cfg = json.load(open(os.path.join(ROOT, 'vercel.json')))
    H = {h['key']: h['value'] for r in cfg['headers'] for h in r['headers']}
    csp = H['Content-Security-Policy']
    for d in ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'none'", 'upgrade-insecure-requests']:
        assert d in csp, d
    assert 'Strict-Transport-Security' in H and 'X-Content-Type-Options' in H


def test_appli_publiee_a_jour():
    """La page publiée contient bien les deux parties de l’appli."""
    h = open(os.path.join(PUB, 'index.html')).read()
    assert h.count('id="kapp"') == 1 and h.count('id="kapp2"') == 1
    assert 'kopek-dw' in open(os.path.join(PUB, 'sw.js')).read() or 'const V =' in open(os.path.join(PUB, 'sw.js')).read()


def test_aucune_cle_secrete_dans_le_code_publie():
    for f in ['index.html', 'boot.js']:
        t = open(os.path.join(PUB, f)).read()
        assert 'service_role' not in t and 'sk-ant-' not in t and 'sb_secret_' not in t, f


def test_aucun_lien_avec_une_autre_appli():
    """Lumo a son propre serveur : aucune adresse, clé ou nom d'une autre appli dans ce qui est publié."""
    for f in ['index.html', 'boot.js', 'sw.js', 'manifest.webmanifest', 'conditions.html', 'confidentialite.html']:
        t = open(os.path.join(PUB, f)).read().lower()
        assert 'kopek' not in t and 'yrpytugfiibaqaxrfoiw' not in t, f
    assert 'yyxudhwlduznoteuddmp' in open(os.path.join(PUB, 'boot.js')).read()
    assert 'yrpytugfiibaqaxrfoiw' not in open(os.path.join(ROOT, 'vercel.json')).read()
