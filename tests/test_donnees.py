"""Données : chaque compte reste séparé sur un même appareil, et la fusion entre deux appareils ne perd rien."""


def test_copie_locale_separee_par_compte(make_app):
    app = make_app()
    r = app.js("""demoOn();PKEY='kp-compteA';await autoBackup(1);const a=await idbGet();
      PKEY='kp-compteB';const b=await idbGet();return [!!a, b]""")
    assert r == [True, None]


def test_notifications_propres_au_compte(make_app):
    app = make_app()
    r = app.js("""demoOn();S.ntf=Object.assign(S.ntf||{},{on:1,seen:{x:1}});save();const a=JSON.stringify(S.ntf);
      const keep=PKEY;PKEY='kp-autre';S=DEF();S.obd=1;save();const b=S.ntf?JSON.stringify(S.ntf):'';PKEY=keep;return [a.includes('"x"'),b.includes('"x"')]""")
    assert r == [True, False]


def test_fusion_deux_appareils(make_app):
    """Ici on supprime t2 et on ajoute t3 ; sur l'autre appareil on ajoute t4. Résultat : t1, t3, t4."""
    app = make_app()
    ids = app.js("""const t=(id,a)=>({id,date:'2026-10-0'+id.slice(1),label:'op '+id,amount:a,cat:'Courses',acc:'a1'});
      const base={tx:[t('t1',-10),t('t2',-20)]};const B={};KMK.forEach(k=>{B[k]={};(base[k]||[]).forEach(x=>B[k][x.id]=kHs(x))});
      const L={tx:[t('t1',-10),t('t3',-30)]},R={tx:[t('t1',-10),t('t2',-20),t('t4',-40)]};
      const m=kMerge(L,R,B,true);return m.o.tx.map(x=>x.id).sort()""")
    assert ids == ['t1', 't3', 't4']
