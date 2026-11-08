"""Sécurité : aucun texte saisi ou reçu de la banque ne peut exécuter de code (XSS),
et Kopi ne reçoit jamais d'informations d'identification."""
P = '<img src=x onerror="window.__x=(window.__x||[]).concat(TAG)">'
v = lambda t: P.replace('TAG', repr(t))
q = lambda t: "q'\"><img src=x onerror=\"window.__x=(window.__x||[]).concat('" + t + "')\">"
PIEGE = {"obd": 1, "ks2": 1, "pf": {"n": v('prenom')},
         "acc": [{"id": "a1", "name": v('compte'), "bank": q('banque'), "type": "Compte courant", "bal": 1200, "holder": v('titulaire'), "iban": ""},
                 {"id": "a2", "name": v('epargne'), "bank": "Banque", "type": "Épargne", "bal": 500, "prod": v('produit'), "cap": 1000}],
         "tx": [{"id": "t1", "date": "2026-10-20", "label": v('libelle'), "amount": -60, "cat": "Courses", "sub": v('sous'), "acc": "a1", "note": v('note')},
                {"id": "t2", "date": "2026-10-21", "label": q('libelle2'), "amount": -70, "cat": q('categorie'), "acc": "a1"},
                {"id": "t3", "date": "2026-09-21", "label": "Salaire " + v('salaire'), "amount": 2000, "cat": "Revenus", "acc": "a1"}],
         "cats": [{"id": "c1", "name": q('nomcat'), "color": 'red"><img src=x onerror="window.__x=(window.__x||[]).concat(\'couleur\')">'}],
         "fix": [{"id": "f1", "label": v('charge'), "amount": -30, "cat": "Logement", "day": 3, "acc": "a1", "start": "2026-01", "skip": []}],
         "goals": [{"id": "g1", "name": v('objectif'), "target": 1000, "saved": 100, "monthly": 10}],
         "duo": {"on": 1, "p": v('partenaire'), "mode": "egal"}}
ACTIONS = ["tab='home';render()", "go('acc','c')", "go('acc','e')", "go('duo')", "go('flux','ops')", "go('flux','ana')", "go('flux','rec')", "go('ia')", "go('set')",
           "openHist('a1')", "closeSheet();txOpen('t1')", "closeSheet();txOpen('t2')", "closeSheet();txEdit('t1')", "closeSheet();editAcc('a1')",
           "closeSheet();openSheet('duo')", "closeSheet();openSheet('kdp')", "closeSheet();openSheet('kntf')", "closeSheet();openSheet('prof')"]


def test_aucune_injection_de_code(make_app):
    app = make_app()
    app.js("S=Object.assign(DEF(),__arg);refreshCats();save();tab='home';render()", PIEGE); app.wait(300)
    touches = {}
    for a in ACTIONS:
        app.js('window.__x=[]')
        app.js(a); app.wait(250)
        x = app.js('return window.__x')
        if x: touches[a] = x
    assert not touches, touches


def test_kopi_ne_recoit_pas_d_identifiants(make_app):
    app = make_app()
    app.js("demoOn()")
    t = app.js("return kScrub('Virement de Jean Dupont FR7630004000031234567890143 carte 4970 1012 3456 7890 jean.dupont@mail.fr 06 12 34 56 78')")
    for s in ['FR7630004000031234567890143', '4970 1012 3456 7890', 'jean.dupont@mail.fr', '06 12 34 56 78']:
        assert s not in t, s
    d = app.js("return JSON.stringify(coachData())")
    assert '@' not in d and 'FR76' not in d
