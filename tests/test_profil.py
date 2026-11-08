"""Le bilan de Kopi : dès qu'il y a des opérations, profil, moyennes et axes d'amélioration chiffrés."""


def test_bilan_kopi(make_app):
    app = make_app()
    r = app.js("""demoOn();S.tx.push(...Array.from({length:30},(_,i)=>({id:'z'+i,date:dAdd(today(),-(i*2+1)),label:i%3?'Uber Eats':'Starbucks',amount:i%3?-28:-4.5,cat:'Restaurants',acc:'dp'})));save();
      const X=kProfile();go('ia');const c=document.querySelector('.kpc');
      return {empty:!!X.empty,inc:Math.round(X.inc),prof:X.P.t,axes:X.A.map(a=>a.k),card:!!c,deliv:X.A.some(a=>a.k==='deliv')}""")
    assert not r['empty'] and r['inc'] == 2620 and r['card'] and r['deliv'] and r['prof']


def test_bilan_vide_et_ouverture_auto(make_app):
    app = make_app()
    assert app.js("S=DEF();S.obd=1;save();return kProfile().empty")
    app.js("window.__ksp=0;demoOn();S.kpf=null;tab='home';render()"); app.wait(1700)
    assert app.js("return sheet==='kprof' && !!S.kpf.seen")
