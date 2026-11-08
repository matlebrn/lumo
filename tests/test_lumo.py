"""Lumo : appli 100 % perso, onglet Tableau façon Excel, alerte quand une opération est à classer."""


def test_cinq_onglets_sans_couple(make_app):
    app = make_app(dark=True)
    app.js("demoOn();tab='home';render()"); app.wait(300)
    labels = app.js("return [...document.querySelectorAll('#nav button')].map(b=>b.getAttribute('aria-label'))")
    assert labels == ['Accueil', 'Tableau', 'Objectifs', 'Comptes', 'Lumi']
    txt = app.js("return document.body.innerText")
    for mot in ['Kopek', 'Kopi', 'À deux', 'Alex', 'Duo']:
        assert mot not in txt, mot
    assert app.js("return isJ({joint:1})") is False
    assert not app.errors, app.errors


def test_saisie_dans_le_tableau(make_app):
    app = make_app()
    app.js("S=DEF();S.obd=1;S.pf={n:'Sam'};save();tab='tbl';render()"); app.wait(200)
    app.page.fill('#lnl', 'Boulangerie Paul'); app.page.fill('#lna', '4,20'); app.page.press('#lna', 'Enter'); app.wait(200)
    t = app.js("return S.tx.find(x=>x.label==='Boulangerie Paul')")
    assert t and t['amount'] == -4.2 and t['man'] == 1
    app.page.fill('#lnl', 'Remboursement'); app.page.fill('#lna', '+30'); app.page.press('#lna', 'Enter'); app.wait(200)
    assert app.js("return S.tx.find(x=>x.label==='Remboursement').amount") == 30
    rows = app.js("return document.querySelectorAll('.lgrid .lr:not(.lh):not(.lmnew)').length")
    assert rows == 2
    assert not app.errors, app.errors


def test_alerte_quand_lumo_hesite(make_app):
    app = make_app()
    app.js("S=DEF();S.obd=1;S.pf={n:'Sam'};S.tx.push({id:'x1',eb:'b1',date:today(),label:'PAYPAL *ZZ',amount:-9.9,cat:'Autre',acc:''});save();tab='tbl';render()"); app.wait(300)
    assert app.js("return lumoDoubt().length") == 1
    assert app.js("return document.querySelector('.lalert')!==null")
    assert app.js("return document.querySelector('#nav .lbd').textContent") == '1'
    app.js("lumoEd('x1','cat','Shopping')"); app.wait(200)
    assert app.js("return lumoDoubt().length") == 0
    assert app.js("return document.querySelector('.lalert')") is None
    assert not app.errors, app.errors


def test_objectifs_combien_et_quand(make_app):
    app = make_app()
    app.js("S=DEF();S.obd=1;S.pf={n:'Sam'};save();go('obj')"); app.wait(200)
    m = app.js("const d=new Date();d.setDate(15);d.setMonth(d.getMonth()+10);return d.toISOString().slice(0,7)")
    p = app.js(f"return lumoPlan({{target:3000,saved:1000,by:'{m}'}})")
    assert p['n'] == 10 and p['per'] == 200
    p = app.js("return lumoPlan({target:3000,saved:1000,monthly:150})")
    assert p['n'] == 14 and p['fromM']
    app.js("lumoGN('n','Voyage');lumoGN('t','1200');lumoGN('mode','m',1);lumoGN('m','100');lumoGAdd()"); app.wait(200)
    assert app.js("return S.goals.some(g=>g.name==='Voyage'&&g.monthly===100)")
    assert '12 mois' in app.js("return document.getElementById('app').innerText")
    assert not app.errors, app.errors
