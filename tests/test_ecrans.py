"""Chaque écran et chaque fenêtre s'affiche sans erreur, en clair et en sombre."""
import pytest

ECRANS = ["tab='home';render()", "go('acc','c')", "go('acc','e')", "go('tbl')", "go('flux','ops')", "go('flux','ana')", "go('flux','rec')", "go('ia')", "go('set')"]
FENETRES = ['menu', 'opsm', 'kdp', 'prof', 'ksaves', 'kntf', 'kmfa']
CHECK = """const vis=e=>e&&getComputedStyle(e).display!=='none';
const txt=[document.getElementById('app'),document.getElementById('sheet')].filter(vis).map(e=>e.innerText).join('\\n');const r=[];
if(/Oups, cet écran/.test(txt))r.push('écran en erreur');
const bad=txt.match(/[^\\n]{0,30}\\b(undefined|NaN|\\[object Object\\]|Infinity)\\b[^\\n]{0,30}/g);if(bad)r.push(bad.slice(0,3).join(' | '));
if(document.documentElement.scrollWidth>392)r.push('déborde : '+document.documentElement.scrollWidth);return r"""


@pytest.mark.parametrize('dark', [False, True], ids=['clair', 'sombre'])
def test_tous_les_ecrans(make_app, dark):
    app = make_app(dark)
    app.js("demoOn();tab='home';render()"); app.wait(300)
    soucis = []
    for a in ECRANS:
        app.js(a); app.wait()
        soucis += [f'{a}: {x}' for x in app.js(CHECK)]
    for f in FENETRES:
        app.js(f"try{{closeSheet()}}catch(e){{}};openSheet('{f}')"); app.wait()
        soucis += [f'fenêtre {f}: {x}' for x in app.js(CHECK)]
    app.js('try{closeSheet()}catch(e){}')
    assert not app.errors, app.errors
    assert not soucis, soucis


def test_appli_vide_nouvel_utilisateur(make_app):
    app = make_app()
    app.js("S=DEF();S.obd=1;S.pf={n:'Sam'};save();tab='home';render()"); app.wait(300)
    for a in ECRANS:
        app.js(a); app.wait()
        assert not app.js(CHECK), a
    assert not app.errors, app.errors
