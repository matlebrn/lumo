#!/usr/bin/env python3
"""Construit Lumo (public/) à partir de la base de l'ancien Kopek (lumo/base/) + la couche Lumo (lumo/*).
Usage : python3 lumo/patch.py   — relançable à volonté, repart toujours de la base."""
import os, re, json, shutil, hashlib
B = os.path.dirname(os.path.abspath(__file__)); R = os.path.dirname(B); P = os.path.join(R, 'public')
rd = lambda f: open(os.path.join(B, f), encoding='utf-8').read()

def rep(h, a, b, n=None, name=''):
    c = h.count(a)
    if c == 0 or (n is not None and c != n): raise SystemExit(f'motif introuvable ({c}) : {name or a[:80]}')
    return h.replace(a, b)

TXT = [  # textes visibles : couple → perso
    ('L’argent à deux, enfin simple. Vos comptes perso et commun, qui paie quoi, et un coach qui vous dit quoi faire.', 'Ton argent, en pleine lumière. Tes comptes, un tableau simple à remplir, et Lumi pour t’aider à décider.'),
    ('"À deux, en toute équité","Qui verse quoi sur le compte commun, la part juste de chacun."', '"Classé tout seul","Chaque opération rangée automatiquement. En cas de doute, c’est toi qui choisis."'),
    ('L’argent à deux, enfin simple', 'Ton argent, en pleine lumière'),
    ('Qui paie quoi, sans calcul', 'Un tableau simple, comme sur Excel'),
    ('Kopek Solo', 'Lumo'), ('Kopek Duo', 'Lumo'),
    ('Kopek', 'Lumo'), ('Kopi', 'Lumi'),
]

def index():
    h = rd('base/index.html')
    # en-tête
    h = rep(h, '<html lang="fr">', '<html lang="fr" class="lumo" data-theme="dark">', 1)
    h = rep(h, '<meta name="theme-color" content="#005CFD">', '<meta name="theme-color" content="#09090A">', 1)
    h = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="Lumo, ton argent en pleine lumière.">', h, count=1)
    h = rep(h, '<link rel="stylesheet" href="/fonts/fonts.css">', '<link rel="preload" href="/fonts/geist-400.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/instrument-serif-400.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/fonts/fonts.css">', 1)
    # 100 % perso : jamais de compte commun ni de partenaire
    h = rep(h, 'const isJ=e=>!!e&&(', 'const isJ=e=>!1&&(', 1, 'isJ')
    h = rep(h, 'const duoOn=()=>!(!S.duo||!S.duo.on)', 'const duoOn=()=>!1', 1, 'duoOn')
    h = rep(h, 'const kMode=()=>"solo"===S.kmode||"duo"===S.kmode?S.kmode:duoOn()?"duo":"solo"', 'const kMode=()=>"solo"', 1, 'kMode')
    h = rep(h, 'TABS[2][1]=e?"Objectifs":"À deux",TABS[2][2]=e?KICO.solo:KICO.duo', '0', 1, 'onglet Objectifs')
    h = rep(h, '<button class="bt o" style="margin-top:10px" onclick="S.obJ=1;OBS=1;renderOb()">J’ai un code d’invitation</button>', '', None, 'code invitation')
    for a, b in TXT: h = h.replace(a, b)
    # démo : un seul titulaire, plus de partenaire
    h = rep(h, '{id:"dj",name:"Compte joint",bank:"Banque Démo",type:"Compte courant",holder:(s&&s.n||"Moi")+" & Alex",joint:1,bal:610,', '{id:"dj",name:"Compte dépenses",bank:"Néobanque Démo",type:"Compte courant",holder:(s&&s.n||"Moi"),joint:0,bal:610,', 1, 'démo compte joint')
    h = h.replace('"Virement Alex"', '"Prime de nuit"').replace('label:"Virement Alex"', 'label:"Prime de nuit"')
    h = rep(h, 'S.duo={on:1,p:"Alex",pk:"Alex",mode:"prorata",rm:2150,rp:1800}', 'S.duo={on:0}', 1, 'démo duo')
    h = h.replace('comp:"couple"', 'comp:"seul"')
    # animation d'ouverture
    h = re.sub(r'<div id="ksplash"[\s\S]*?</script></div>\n?', '', h, count=1)
    h = rep(h, '<body>', '<body>\n' + rd('splash.html').strip() + '\n', 1)
    # couche Lumo : styles en dernier, code à la fin de l'appli
    mk = '<script type="text/plain" id="kapp2">'; i = h.index(mk) + len(mk); z = h.index('</script>', i)
    h = h[:z] + '\n' + rd('lumo.js') + '\n' + h[z:]
    k = h.rindex('</body>') if '</body>' in h else len(h)
    h = h[:k] + '<style id="lumocss">\n' + rd('lumo.css') + '\n</style>\n' + h[k:]
    return h

def boot():
    h = rd('base/boot.js')
    h = h.replace('#005CFD', '#D9B56C')
    # données de Lumo rangées à part (préfixe lumo/) : elles ne se mélangent jamais à celles de Kopek
    h = rep(h, '{kind:"vault",slot:t.slice(a.length)}', '{kind:"vault",slot:"lumo/"+t.slice(a.length)}', 1, 'emplacement lumo')
    for a, b in TXT: h = h.replace(a, b)
    return h

def legal(f):
    h = rd('base/' + f)
    for a, b in TXT: h = h.replace(a, b)
    return h.replace('#005CFD', '#D9B56C')

def main():
    out = {'index.html': index(), 'boot.js': boot(), 'conditions.html': legal('conditions.html'), 'confidentialite.html': legal('confidentialite.html')}
    for f, s in out.items(): open(os.path.join(P, f), 'w', encoding='utf-8').write(s)
    # polices
    fd = os.path.join(P, 'fonts')
    for f in os.listdir(fd):
        if f.startswith('plus-jakarta'): os.remove(os.path.join(fd, f))
    css = ''
    for fam, w, st, fn in [('Lumo Serif', 400, 'normal', 'instrument-serif-400'), ('Lumo Serif', 400, 'italic', 'instrument-serif-400-italic'), ('Lumo Sans', 400, 'normal', 'geist-400'), ('Lumo Sans', 500, 'normal', 'geist-500'), ('Lumo Sans', 600, 'normal', 'geist-600'), ('Lumo Sans', 700, 'normal', 'geist-700')]:
        shutil.copy(os.path.join(B, 'fonts', fn + '.woff2'), os.path.join(fd, fn + '.woff2'))
        css += "@font-face{font-family:'%s';font-style:%s;font-weight:%d;font-display:swap;src:url(/fonts/%s.woff2) format('woff2')}\n" % (fam, st, w, fn)
    open(os.path.join(fd, 'fonts.css'), 'w').write(css)
    # icônes (une seule couleur : plus de variantes verte / noire)
    idir = os.path.join(P, 'icons')
    for f in os.listdir(idir): os.remove(os.path.join(idir, f))
    for n in (180, 192, 512):
        for v in ('', '-vert', '-noir'): shutil.copy(os.path.join(B, f'icon-{n}.png'), os.path.join(idir, f'icon{v}-{n}.png'))
    man = {"name": "Lumo", "short_name": "Lumo", "description": "Ton argent, en pleine lumière.", "lang": "fr", "start_url": "/", "scope": "/", "display": "standalone", "orientation": "portrait", "background_color": "#09090A", "theme_color": "#09090A",
           "icons": [{"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png"}, {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
    for v in ('', '-vert', '-noir'): json.dump(man, open(os.path.join(P, f'manifest{v}.webmanifest'), 'w'), ensure_ascii=False)
    ver = hashlib.sha1(''.join(out.values()).encode()).hexdigest()[:10]
    sw = rd('base/sw.js').replace("Kopek", "Lumo")
    sw = re.sub(r"const V = '[^']*'", f"const V = 'lumo-{ver}'", sw, count=1)
    open(os.path.join(P, 'sw.js'), 'w').write(sw)
    left = sum(s.count('Kopek') + s.count('Kopi') for s in out.values())
    print('ok', ver, '· mentions Kopek/Kopi restantes :', left)

main()
