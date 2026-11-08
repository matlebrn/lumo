/* ================= Lumo : appli perso de gestion d'argent =================
   Couche Lumo posée sur le moteur de l'ancienne appli :
   - 100 % perso : pas de compte commun, pas de partenaire, pas de formule Duo
   - 5 onglets : Accueil, Tableau, Objectifs, Comptes, Lumi
   - Objectifs : combien mettre par mois, ou en combien de temps
   - Tableau façon Excel : saisie à la main, opérations de la banque, classement automatique
   - Alerte quand Lumo hésite sur la catégorie d'une opération */
(function () {
  /* ---------- 1. toujours en mode perso, toujours en thème sombre ---------- */
  const solo = () => { try { S.kmode = 'solo'; S.duo = S.duo || {}; S.duo.on = 0; } catch (e) { } };
  solo();
  const dark = () => { try { document.documentElement.setAttribute('data-theme', 'dark'); document.documentElement.classList.add('lumo'); } catch (e) { } };
  dark();
  try { localStorage.removeItem('kp-icon'); } catch (e) { }

  /* ---------- 2. les onglets ---------- */
  const I = {
    home: '<path d="M3.5 11.2 12 4l8.5 7.2V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
    tbl: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M3.5 14.8h17M9.5 9.5V20"/>',
    obj: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.2"/>',
    acc: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10.5h18M15.5 15h2.5"/>',
    ia: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/>'
  };
  TABS.splice(0, TABS.length, ['home', 'Accueil', I.home], ['tbl', 'Tableau', I.tbl], ['obj', 'Objectifs', I.obj], ['acc', 'Comptes', I.acc], ['ia', 'Lumi', I.ia]);

  /* ---------- 3. ce qui laisse Lumo hésiter ---------- */
  const doubt = () => {
    let q = []; try { q = triQ().map(x => x.t); } catch (e) { }
    const lim = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
    S.tx.forEach(t => { if (t.amount > 0 && !t.m && !t.x && t.date >= lim && (t.cat === 'Autre' || !CATS[t.cat]) && !q.includes(t)) q.push(t); });
    return q;
  };
  window.lumoDoubt = doubt;
  const isDoubt = t => !t.m && !t.x && (t.cat === 'Autre' || !CATS[t.cat]);
  window.lumoSort = () => {
    const q = doubt(); if (!q.length) return toast('Tout est classé');
    let n = 0; try { n = triQ().length; } catch (e) { }
    if (n) { try { triOpen(); return; } catch (e) { } }
    tab = 'tbl'; render(); setTimeout(() => { const r = document.querySelector('.lr.lmq select'); if (r) { r.scrollIntoView({ block: 'center' }); r.focus(); } }, 80);
  };

  /* ---------- 4. le Tableau, façon Excel ---------- */
  const mShift = (k, n) => { const d = new Date(k + '-15'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7); };
  const fmtD = d => new Date(d + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '');
  const num = s => { const v = parseFloat(String(s).replace(/\s|€/g, '').replace(',', '.').replace('−', '-')); return isFinite(v) ? v : NaN; };
  const fmtA = a => (a > 0 ? '+' : a < 0 ? '−' : '') + Math.abs(a).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const accDef = () => { const c = S.acc.find(z => z.type === 'Compte courant') || S.acc[0]; return c ? c.id : ''; };
  const catSel = (t, on) => `<select class="lc${isDoubt(t) ? ' lmq' : ''}" style="--c:${CATS[t.cat] || 'var(--mu)'}" onchange="${on}" aria-label="Catégorie">${isDoubt(t) ? '<option value="" selected>À classer</option>' : ''}${CK.map(c => `<option${c === t.cat && !isDoubt(t) ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>`;
  let NEW = { d: '', l: '', c: '', a: '' };

  function rowsOf(k) {
    let L = []; try { L = inM(k); } catch (e) { L = S.tx.filter(t => t.date.slice(0, 7) === k); }
    return L.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));
  }
  function vTbl() {
    const k = M, L = rowsOf(k), inc = L.filter(t => t.amount > 0 && !t.x).reduce((n, t) => n + t.amount, 0), out = L.filter(t => t.amount < 0 && !t.x).reduce((n, t) => n - t.amount, 0), q = doubt();
    const today0 = today().slice(0, 7) === k ? today() : k + '-01';
    const row = t => {
      const bank = !!(t.eb || t.eid), ed = !bank;
      return `<div class="lr${isDoubt(t) ? ' lmq' : ''}${t.x ? ' xx' : ''}" data-id="${esc(t.id)}">
<div class="ld">${ed ? `<input type="date" value="${esc(t.date)}" onchange="lumoEd('${t.id}','date',this.value)" aria-label="Date">` : ''}<span>${fmtD(t.date)}</span></div>
<div class="ll">${ed ? `<input value="${esc(t.label)}" maxlength="60" onchange="lumoEd('${t.id}','label',this.value)" aria-label="Libellé">` : `<span title="${esc(t.label)}">${esc(t.label)}</span>`}${bank ? '<i class="lb2">banque</i>' : ''}</div>
<div class="lk">${catSel(t, `lumoEd('${t.id}','cat',this.value)`)}</div>
<div class="la ${t.amount > 0 ? 'p' : ''}">${ed ? `<input inputmode="decimal" value="${fmtA(t.amount)}" onchange="lumoEd('${t.id}','amount',this.value)" aria-label="Montant">` : `<span>${fmtA(t.amount)}</span>`}</div>
${ed ? `<button class="lx" aria-label="Supprimer la ligne" onclick="lumoDel('${t.id}')">×</button>` : '<span class="lx"></span>'}</div>`;
    };
    const nw = `<div class="lr lmnew">
<div class="ld"><input type="date" id="lnd" value="${esc(NEW.d || today0)}" onchange="NEWd(this.value)" aria-label="Date"><span id="lndl">${fmtD(NEW.d || today0)}</span></div>
<div class="ll"><input id="lnl" placeholder="Nouvelle ligne…" maxlength="60" value="${esc(NEW.l)}" oninput="lumoN('l',this.value)" onkeydown="if(event.key==='Enter')document.getElementById('lna').focus()" aria-label="Libellé"></div>
<div class="lk"><select class="lc" id="lnc" onchange="lumoN('c',this.value)" aria-label="Catégorie"><option value="">Auto</option>${CK.map(c => `<option${c === NEW.c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
<div class="la"><input id="lna" inputmode="decimal" placeholder="−0,00" value="${esc(NEW.a)}" oninput="lumoN('a',this.value)" onkeydown="if(event.key==='Enter')lumoAdd()" aria-label="Montant"></div>
<button class="lx ok" aria-label="Ajouter la ligne" onclick="lumoAdd()">✓</button></div>`;
    return pageHead('Tableau', `<button class="hb" aria-label="Nouvelle ligne" onclick="document.getElementById('lnl').focus()">${PLUS}</button>` + avBtn()) +
      `<div class="lmn"><button aria-label="Mois précédent" onclick="M=lumoM(-1);render()">‹</button><b>${mLabel(k)}</b><button aria-label="Mois suivant" onclick="M=lumoM(1);render()">›</button></div>
<div class="lsum"><div><span>Entrées</span><b class="p">${eur(inc)}</b></div><div><span>Sorties</span><b>${eur(out)}</b></div><div><span>Solde</span><b class="${inc - out >= 0 ? 'p' : 'n'}">${eur(inc - out)}</b></div></div>
${q.length ? `<button class="lalert" onclick="lumoSort()"><i></i><span><b>Lumo hésite sur ${q.length} opération${q.length > 1 ? 's' : ''}</b><span>Touche pour les classer toi-même</span></span><em>Classer</em></button>` : ''}
<div class="lgrid"><div class="lr lh"><div>Date</div><div>Libellé</div><div>Catégorie</div><div class="la">Montant</div><span class="lx"></span></div>${nw}${L.map(row).join('') || '<div class="lempty">Aucune ligne ce mois-ci. Écris ta première dépense juste au-dessus.</div>'}</div>
<p class="lfoot">Tape un montant avec + pour une rentrée d’argent. Les opérations de ta banque arrivent toutes seules et sont classées automatiquement.</p>`;
  }
  window.lumoM = n => mShift(M, n);
  window.lumoN = (f, v) => { NEW[f] = v; };
  window.NEWd = v => { NEW.d = v; const s = document.getElementById('lndl'); if (s) s.textContent = fmtD(v); };
  window.lumoAdd = () => {
    const l = (NEW.l || '').trim(); let a = num(NEW.a);
    if (!l) { toast('Écris un libellé'); document.getElementById('lnl')?.focus(); return; }
    if (!isFinite(a) || !a) { toast('Écris un montant'); document.getElementById('lna')?.focus(); return; }
    const plus = /^\s*\+/.test(NEW.a); let c = NEW.c;
    if (!plus && a > 0) a = -a;
    if (!c) { try { c = ebGuess(l, a); } catch (e) { c = a > 0 ? 'Revenus' : 'Autre'; } }
    if (c === 'Revenus' && a < 0 && !/^\s*-|−/.test(NEW.a)) a = -a;
    S.tx.push({ id: uid(), date: NEW.d || (today().slice(0, 7) === M ? today() : M + '-01'), label: l, amount: Math.round(a * 100) / 100, cat: c, acc: accDef(), m: NEW.c ? 1 : 0, man: 1 });
    NEW = { d: NEW.d, l: '', c: '', a: '' }; save(); render();
    toast(c === 'Autre' ? 'Ligne ajoutée · choisis sa catégorie' : `Ligne ajoutée · ${c}`);
    setTimeout(() => document.getElementById('lnl')?.focus(), 50);
  };
  window.lumoEd = (id, f, v) => {
    const t = S.tx.find(z => z.id === id); if (!t) return;
    if (f === 'cat') { if (!v) return; try { setCat(id, v); } catch (e) { t.cat = v; t.m = 1; save(); render(); } return; }
    if (f === 'amount') { const a = num(v); if (!isFinite(a)) { toast('Montant illisible'); render(); return; } t.amount = Math.round(a * 100) / 100; }
    else if (f === 'label') { if (!String(v).trim()) { render(); return; } t.label = String(v).trim().slice(0, 60); }
    else if (f === 'date') { if (!/^\d{4}-\d\d-\d\d$/.test(v)) return; t.date = v; }
    save(); render();
  };
  window.lumoDel = id => {
    const i = S.tx.findIndex(z => z.id === id); if (i < 0) return; const [t] = S.tx.splice(i, 1); save(); render();
    try { toastU ? toastU('Ligne supprimée', () => { S.tx.push(t); save(); render(); }) : toast('Ligne supprimée'); } catch (e) { toast('Ligne supprimée'); }
  };


  /* ---------- 4 bis. Objectifs : combien mettre, et en combien de temps ---------- */
  const mNow = () => today().slice(0, 7);
  const mDiff = (a, b) => { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };
  const mName = k => new Date(k + '-15').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const gS = g => { try { return Math.max(0, +gSaved(g) || 0); } catch (e) { return Math.max(0, +g.saved || 0); } };
  /* le calcul : avec une date → combien par mois ; avec un montant par mois → en combien de temps */
  function gPlan(g) {
    const rest = Math.max(0, (+g.target || 0) - gS(g));
    if (!rest) return { done: 1, rest };
    if (g.by && /^\d{4}-\d\d$/.test(g.by)) {
      const n = mDiff(mNow(), g.by);
      if (n <= 0) return { late: 1, rest, by: g.by };
      return { per: Math.ceil(rest / n / 5) * 5, n, by: g.by, rest };
    }
    if (+g.monthly > 0) { const n = Math.ceil(rest / +g.monthly); return { per: +g.monthly, n, by: mShift(mNow(), n), rest, fromM: 1 }; }
    return { none: 1, rest };
  }
  window.lumoPlan = gPlan;
  /* ce que tu arrives à mettre de côté en moyenne (3 derniers mois complets) */
  function capa() {
    let tot = 0, k = 0;
    for (let i = 1; i <= 3; i++) {
      const m = mShift(mNow(), -i), L = S.tx.filter(t => t.date.slice(0, 7) === m && !t.x);
      if (!L.length) continue; tot += L.reduce((n, t) => n + t.amount, 0); k++;
    }
    return k ? Math.round(tot / k / 10) * 10 : null;
  }
  let GN = { mode: 'by' };
  function gCard(g) {
    const p = gPlan(g), sv = gS(g), pc = Math.min(100, Math.round(sv / Math.max(1, +g.target) * 100));
    const line = p.done ? '<b class="ok">Objectif atteint</b>' :
      p.late ? `La date est passée. <b>Il reste ${eur(p.rest)}</b> : choisis une nouvelle date.` :
      p.none ? 'Choisis une date ou un montant par mois pour voir ton plan.' :
      p.fromM ? `À <b>${eur(p.per)} par mois</b>, atteint en <b>${p.n} mois</b> · ${mName(p.by)}` :
      `Mets <b>${eur(p.per)} par mois</b> pendant ${p.n} mois · jusqu’en ${mName(p.by)}`;
    return `<details class="card lgo"><summary><div class="lgo-h"><b>${esc(g.name)}</b><span>${eur(sv)} <i>/ ${eur(+g.target)}</i></span></div>
<div class="lgo-b"><i style="width:${pc}%"></i></div><p class="lgo-p">${line}</p></summary>
<div class="lgo-e"><label>Déjà de côté<input inputmode="decimal" value="${Math.round(+g.saved || 0)}" onchange="lumoG('${g.id}','saved',this.value)"></label>
<label>Montant visé<input inputmode="decimal" value="${Math.round(+g.target)}" onchange="lumoG('${g.id}','target',this.value)"></label>
<label>Pour quand<input type="month" value="${esc(g.by || '')}" onchange="lumoG('${g.id}','by',this.value)"></label>
<label>Ou par mois<input inputmode="decimal" placeholder="—" value="${g.by ? '' : (+g.monthly || '')}" onchange="lumoG('${g.id}','monthly',this.value)"></label>
<button class="bt o" onclick="lumoGDel('${g.id}')">Supprimer l’objectif</button></div></details>`;
  }
  function gPreview() {
    const g = { target: num(GN.t), saved: num(GN.s) || 0, by: GN.mode === 'by' ? GN.by : '', monthly: GN.mode === 'm' ? num(GN.m) : 0 };
    if (!(g.target > 0)) return 'Écris le montant visé.';
    const p = gPlan(g);
    if (p.done) return 'Tu as déjà tout ce qu’il faut.';
    if (p.late) return 'Choisis une date à venir.';
    if (p.none) return GN.mode === 'by' ? 'Choisis pour quand.' : 'Écris combien tu peux mettre par mois.';
    return p.fromM ? `→ Atteint en <b>${p.n} mois</b>, en ${mName(p.by)}` : `→ Mets <b>${eur(p.per)} par mois</b> pendant ${p.n} mois`;
  }
  function vObj() {
    const G = (S.goals || []).filter(g => !g.shared), need = G.map(gPlan).filter(p => p.per && !p.done).reduce((n, p) => n + p.per, 0), c = capa();
    const ep = S.acc.filter(x => x.type !== 'Compte courant').reduce((n, x) => n + (+val(x) || 0), 0);
    return pageHead('Objectifs', avBtn()) +
      `<div class="lsum lsum2"><div><span>Épargne</span><b>${eur(ep)}</b></div><div><span>À mettre / mois</span><b class="g">${eur(need)}</b></div><div><span>Ton rythme</span><b class="${c == null ? '' : c >= need ? 'p' : 'n'}">${c == null ? '—' : eur(c)}</b></div></div>
${c != null && need > c && need > 0 ? `<p class="lnote">Tes objectifs demandent ${eur(need - c)} de plus par mois que ce que tu mets de côté en moyenne. Allonge une date, ou baisse un montant.</p>` : ''}
${G.map(gCard).join('')}
<div class="card lgn"><div class="lgn-t">Nouvel objectif</div>
<input id="gnn" placeholder="Ex. Voiture, voyage, apport…" maxlength="40" value="${esc(GN.n || '')}" oninput="lumoGN('n',this.value)">
<div class="lgn-r"><input id="gnt" inputmode="decimal" placeholder="Montant visé €" value="${esc(GN.t || '')}" oninput="lumoGN('t',this.value)"><input id="gns" inputmode="decimal" placeholder="Déjà de côté €" value="${esc(GN.s || '')}" oninput="lumoGN('s',this.value)"></div>
<div class="seg lgn-s"><button class="${GN.mode === 'by' ? 'on' : ''}" onclick="lumoGN('mode','by',1)">J’ai une date</button><button class="${GN.mode === 'm' ? 'on' : ''}" onclick="lumoGN('mode','m',1)">Je mets X par mois</button></div>
${GN.mode === 'by' ? `<input id="gnb" type="month" min="${mShift(mNow(), 1)}" value="${esc(GN.by || '')}" onchange="lumoGN('by',this.value)">` : `<input id="gnm" inputmode="decimal" placeholder="Par mois €" value="${esc(GN.m || '')}" oninput="lumoGN('m',this.value)">`}
<p class="lgn-p" id="gnp">${gPreview()}</p><button class="bt" onclick="lumoGAdd()">Créer l’objectif</button></div>`;
  }
  window.lumoGN = (f, v, re) => { GN[f] = v; if (re) { render(); return; } const p = document.getElementById('gnp'); if (p) p.innerHTML = gPreview(); };
  window.lumoGAdd = () => {
    const n = String(GN.n || '').trim(), t = num(GN.t);
    if (!n) { toast('Donne un nom à ton objectif'); document.getElementById('gnn')?.focus(); return; }
    if (!(t > 0)) { toast('Écris le montant visé'); document.getElementById('gnt')?.focus(); return; }
    const g = { id: uid(), name: n.slice(0, 40), target: Math.round(t), saved: Math.max(0, Math.round(num(GN.s) || 0)), monthly: GN.mode === 'm' ? Math.max(0, num(GN.m) || 0) : 0, by: GN.mode === 'by' ? (GN.by || '') : '', acc: '' };
    S.goals = S.goals || []; S.goals.push(g); GN = { mode: GN.mode }; save(); render();
    const p = gPlan(g); toast(p.per ? (p.fromM ? `Objectif créé · atteint en ${p.n} mois` : `Objectif créé · ${eur(p.per)} par mois`) : 'Objectif créé');
  };
  window.lumoG = (id, f, v) => {
    const g = (S.goals || []).find(z => z.id === id); if (!g) return;
    if (f === 'by') { g.by = v || ''; if (v) g.monthly = 0; }
    else { const x = num(v); if (f === 'monthly') { g.monthly = isFinite(x) && x > 0 ? x : 0; if (g.monthly) g.by = ''; } else if (isFinite(x) && x >= 0) g[f] = Math.round(x); }
    save(); render(); setTimeout(() => { const d = [...document.querySelectorAll('.lgo')].find(e => e.innerHTML.includes(`lumoG('${id}'`)); if (d) d.open = true; }, 0);
  };
  window.lumoGDel = id => { const i = (S.goals || []).findIndex(z => z.id === id); if (i < 0) return; const [g] = S.goals.splice(i, 1); save(); render(); toast(`« ${g.name} » supprimé`); };

  /* ---------- 5. l'écran Tableau dans le rendu de l'appli ---------- */
  {
    const _r = render;
    render = function () {
      solo(); dark();
      if (tab === 'flux') { tab = 'tbl'; }
      if (tab === 'duo') { tab = 'obj'; }
      _r.apply(this, arguments);
      try {
        if (!locked && (tab === 'tbl' || tab === 'obj')) { const a = document.getElementById('app'); if (a) a.innerHTML = tab === 'tbl' ? vTbl() : vObj(); }
      } catch (e) { console.error(e); }
      try { lumoBadge(); } catch (e) { }
      try { lumoAlert(); } catch (e) { }
    };
  }

  /* ---------- 6. alerte quand Lumo hésite ---------- */
  function lumoBadge() {
    const n = doubt().length, b = document.querySelector('#nav button[aria-label="Tableau"]'); if (!b) return;
    let i = b.querySelector('.lbd'); if (!n) { i && i.remove(); return; }
    if (!i) { i = document.createElement('i'); i.className = 'lbd'; b.appendChild(i); } i.textContent = n > 9 ? '9+' : n;
  }
  function lumoAlert() {
    S.lumoA = S.lumoA && typeof S.lumoA === 'object' ? S.lumoA : {};
    const fresh = doubt().filter(t => !S.lumoA[t.id]); if (!fresh.length) return;
    fresh.forEach(t => S.lumoA[t.id] = 1);
    const n = fresh.length, msg = n > 1 ? `${n} nouvelles opérations à classer` : `« ${String(fresh[0].label).slice(0, 28)} » : Lumo hésite`;
    setTimeout(() => { try { toast(msg + ' · va dans Tableau'); } catch (e) { } }, 900);
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) navigator.serviceWorker.getRegistration().then(r => r && r.showNotification('Lumo', { body: msg, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'lumo-tri' }));
    } catch (e) { }
    try { save(); } catch (e) { }
  }

  /* ---------- démo : deux opérations sur lesquelles Lumo hésite ---------- */
  { const _d = demoOn; demoOn = function () { const r = _d.apply(this, arguments); try { const t = today(), y = new Date(Date.now() - 864e5).toISOString().slice(0, 10), a = (S.acc.find(z => z.type === 'Compte courant') || {}).id || ''; S.tx.push({ id: uid(), eb: 'demo1', date: t, label: 'PAYPAL *XK29 EUROPE', amount: -14.9, cat: 'Autre', acc: a, ai: 2 }, { id: uid(), eb: 'demo2', date: y, label: 'VIR SEPA M. DURAND', amount: 60, cat: 'Autre', acc: a, ai: 2 }); save(); render(); } catch (e) { } return r; }; }

  /* ---------- 7. accueil : le questionnaire saute le choix Solo/Duo ---------- */
  { const _o = renderOb; renderOb = function () { try { if (OBS === 2) { S.kmode = 'solo'; OBS = 3; } } catch (e) { } return _o.apply(this, arguments); }; }
  try { render(); } catch (e) { }
})();
