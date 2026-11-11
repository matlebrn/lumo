/* Lumo · moteur de prévision. Du calcul pur : ni écran, ni réseau.
   Tout est compté mois par mois sur 10 ans, en euros d'aujourd'hui et avant impôts. */
(function (root) {
  'use strict';
  const H = 120; // horizon : 120 mois

  const n = (v) => { const x = typeof v === 'string' ? parseFloat(v.replace(/\s/g, '').replace(',', '.')) : +v; return isFinite(x) ? x : 0; };
  const ym = (d) => d.getFullYear() * 12 + d.getMonth();
  const lireYM = (s) => { if (!s || !/^\d{4}-\d{2}/.test(s)) return null; return +s.slice(0, 4) * 12 + (+s.slice(5, 7) - 1); };
  const ecrireYM = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

  /* ---------- crédit ---------- */
  function mensualite(capital, taux, mois) {
    if (capital <= 0 || mois <= 0) return 0;
    const r = taux / 1200;
    return r ? (capital * r) / (1 - Math.pow(1 + r, -mois)) : capital / mois;
  }
  function restantDu(capital, taux, mois, k) { // capital encore dû après k mensualités
    if (capital <= 0 || k >= mois) return 0;
    if (k <= 0) return capital;
    const r = taux / 1200;
    if (!r) return capital * (1 - k / mois);
    const m = mensualite(capital, taux, mois);
    return capital * Math.pow(1 + r, k) - (m * (Math.pow(1 + r, k) - 1)) / r;
  }

  /* ---------- revenus et dépenses réguliers ---------- */
  const PERIODE = { mois: 1, trimestre: 3, an: 12 };
  function fluxDuMois(f, i, t0) { // montant signé du flux pour le mois absolu i
    const d = lireYM(f.debut), fin = lireYM(f.fin);
    if (d != null && i < d) return 0;
    if (fin != null && i > fin) return 0;
    const per = PERIODE[f.frequence] || 1;
    if (per > 1) { const ref = f.mois ? f.mois - 1 : 0; if ((((i % 12) - ref) % per + per) % per !== 0) return 0; }
    const v = n(f.montant) * Math.pow(1 + n(f.evolution) / 100, Math.floor((i - t0) / 12));
    return f.sens === 'revenu' ? v : -v;
  }
  const parMois = (f) => n(f.montant) / (PERIODE[f.frequence] || 1);

  // changement de vie : revenus et dépenses en plus (ou en moins, selon le sens choisi)
  const parMoisChangement = (x) => n(x.revenu) * (x.revenuSens === 'moins' ? -1 : 1) - n(x.depense) * (x.depenseSens === 'moins' ? -1 : 1);

  /* ---------- effet d'un projet sur le compte, mois par mois ----------
     k0 = mois de départ (1 = le mois prochain). Ce qui tombe avant aujourd'hui est déjà dans le solde. */
  function effets(p, k0) {
    const d = new Array(H + 1).fill(0), x = p.params || {};
    const pose = (k, v) => { if (k >= 1 && k <= H) d[k] += v; };
    const duree = Math.round(n(x.dureeAns) * 12);
    if (p.type === 'achat') {
      if (x.financement === 'credit') {
        const cap = Math.max(0, n(x.montant) - n(x.apport)), m = mensualite(cap, n(x.taux), duree);
        pose(k0, -Math.min(n(x.apport), n(x.montant)));
        for (let j = 1; j <= duree; j++) pose(k0 + j, -m);
      } else pose(k0, -n(x.montant));
    } else if (p.type === 'investissement') {
      const total = n(x.prix) + n(x.frais);
      let m = 0;
      if (x.financement === 'credit') {
        const cap = Math.max(0, total - n(x.apport)); m = mensualite(cap, n(x.taux), duree);
        pose(k0, -Math.min(n(x.apport), total));
      } else pose(k0, -total);
      for (let k = Math.max(1, k0 + 1); k <= H; k++) d[k] += n(x.revenu) - n(x.charges) - (k - k0 <= duree ? m : 0);
    } else if (p.type === 'changement') {
      const fin = lireYM(x.fin), t0 = p._t0 || 0;
      pose(k0, -n(x.depart));
      for (let k = Math.max(1, k0); k <= H; k++) { if (fin != null && t0 + k > fin) break; d[k] += parMoisChangement(x); }
    } else if (p.type === 'credit') {
      const m = mensualite(n(x.capital), n(x.taux), duree);
      if (x.verse) pose(k0, n(x.capital));
      for (let j = 0; j < duree; j++) pose(k0 + j, -m);
    }
    return d;
  }

  /* ---------- chiffres propres à chaque type de projet ---------- */
  function chiffres(p) {
    const x = p.params || {}, duree = Math.round(n(x.dureeAns) * 12), c = {};
    if (p.type === 'achat' && x.financement === 'credit') {
      const cap = Math.max(0, n(x.montant) - n(x.apport));
      c.mensualite = mensualite(cap, n(x.taux), duree); c.coutCredit = c.mensualite * duree - cap; c.duree = duree;
    }
    if (p.type === 'credit') {
      c.mensualite = mensualite(n(x.capital), n(x.taux), duree); c.coutCredit = c.mensualite * duree - n(x.capital); c.duree = duree;
    }
    if (p.type === 'changement') c.parMois = parMoisChangement(x);
    if (p.type === 'investissement') {
      const prix = n(x.prix), total = prix + n(x.frais), credit = x.financement === 'credit';
      const cap = credit ? Math.max(0, total - n(x.apport)) : 0;
      const mise = credit ? Math.min(n(x.apport), total) : total; // ce qui sort de ta poche au départ
      const m = credit ? mensualite(cap, n(x.taux), duree) : 0;
      c.mensualite = m; c.duree = duree; c.mise = mise;
      c.cashflow = n(x.revenu) - n(x.charges) - m;
      c.rendementBrut = total ? (n(x.revenu) * 12) / total * 100 : 0;
      c.rendementNet = total ? ((n(x.revenu) - n(x.charges)) * 12) / total * 100 : 0;
      // gain = ce que vaut le bien − ce qu'il reste à rembourser + tout ce qu'il a rapporté − ce que tu as mis
      const gain = (k) => {
        let cf = 0; for (let j = 1; j <= k; j++) cf += n(x.revenu) - n(x.charges) - (j <= duree ? m : 0);
        return prix * Math.pow(1 + n(x.valorisation) / 100, k / 12) - restantDu(cap, n(x.taux), duree, k) + cf - mise;
      };
      c.gain10 = gain(H); c.gain5 = gain(60);
      c.pointMort = null;
      for (let k = 1; k <= 360; k++) if (gain(k) >= 0) { c.pointMort = k; break; }
      c.rentable = c.gain10 > 0;
    }
    return c;
  }

  /* ---------- la prévision complète ----------
     etat = { solde, coussin, courant, flux[], projets[] } */
  function simuler(etat, maintenant) {
    const t0 = ym(maintenant || new Date());
    const coussin = Math.max(0, n(etat.coussin)), solde0 = n(etat.solde);
    const flux = (etat.flux || []).filter((f) => f.actif !== false);
    const netBase = new Array(H + 1).fill(0);
    for (let k = 1; k <= H; k++) { let s = -n(etat.courant); for (const f of flux) s += fluxDuMois(f, t0 + k, t0); netBase[k] = s; }
    const cumul = (net) => { const b = [solde0]; for (let k = 1; k <= H; k++) b[k] = b[k - 1] + net[k]; return b; };
    const sans = cumul(netBase);

    function evaluer(p, net) {
      const q = Object.assign({}, p, { _t0: t0 }), x = p.params || {};
      const avant = cumul(net);
      const essai = (k0) => {
        const d = effets(q, k0), apres = [solde0]; let manque = 0, bas = Infinity;
        for (let k = 1; k <= H; k++) {
          apres[k] = apres[k - 1] + net[k] + d[k];
          if (k >= k0) { bas = Math.min(bas, apres[k]); if (apres[k] < coussin - 0.5 && apres[k] < avant[k] - 0.5) manque = Math.max(manque, coussin - apres[k]); }
        }
        return { d, apres, manque, bas, ok: manque === 0 };
      };
      let tot = null;
      const auPlusTot = p.type === 'achat' || p.type === 'investissement';
      if (auPlusTot) for (let k = 1; k <= H; k++) if (essai(k).ok) { tot = k; break; }
      const kd = lireYM(x.date) != null ? lireYM(x.date) - t0 : null;
      const libre = auPlusTot && x.mode !== 'date';
      const k0 = libre ? tot : (kd != null ? kd : 1);
      const r = { id: p.id, type: p.type, libre, k0, tot, chiffres: chiffres(p), ok: false, manque: 0 };
      if (k0 == null) return r; // impossible dans les 10 ans
      const e = essai(k0);
      r.ok = e.ok; r.manque = e.manque; r.bas = e.bas; r.d = e.d;
      r.effort = e.ok ? 0 : e.manque / Math.max(1, k0); // à mettre de côté en plus chaque mois d'ici là
      r.impact = e.apres[H] - avant[H];
      r.mois = ecrireYM(t0 + k0);
      return r;
    }

    let net = netBase.slice();
    const resultats = {};
    const liste = etat.projets || [];
    for (const p of liste.filter((p) => p.actif !== false)) {
      const r = evaluer(p, net); resultats[p.id] = r;
      if (r.d) for (let k = 1; k <= H; k++) net[k] += r.d[k];
    }
    for (const p of liste.filter((p) => p.actif === false)) resultats[p.id] = evaluer(p, net);
    const avec = cumul(net);

    let decouvert = null, sousCoussin = null;
    for (let k = 1; k <= H; k++) {
      if (decouvert == null && avec[k] < -0.5) decouvert = k;
      if (sousCoussin == null && coussin > 0 && avec[k] < coussin - 0.5) sousCoussin = k;
    }
    const revenus = flux.filter((f) => f.sens === 'revenu').reduce((s, f) => s + parMois(f), 0);
    const fixes = flux.filter((f) => f.sens !== 'revenu').reduce((s, f) => s + parMois(f), 0);
    return {
      H, t0, solde: solde0, coussin, sans, avec, projets: resultats, decouvert, sousCoussin,
      mensuel: { revenus, fixes, courant: n(etat.courant), reste: revenus - fixes - n(etat.courant) },
      mois: (k) => ecrireYM(t0 + k),
    };
  }

  /* ---------- lecture des opérations bancaires ----------
     Repère ce qui revient tous les mois, et estime les dépenses courantes sur les 3 derniers mois complets. */
  function cle(libelle) {
    return String(libelle || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\b(CB|CARTE|PAIEMENT|PRLV|PRELEVEMENT|SEPA|VIR|VIREMENT|INST|EUROPEEN|RECU|EMIS|DE|DU|FACT|REF|ECH|ECHEANCE|MANDAT|ID|NUM)\b/g, ' ')
      .replace(/[^A-Z ]+/g, ' ').split(/\s+/).filter((w) => w.length > 1).slice(0, 3).join(' ');
  }
  const joli = (c) => c.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
  const mediane = (a) => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  function analyser(operations, fluxConnus, maintenant) {
    const t0 = ym(maintenant || new Date());
    const groupes = new Map();
    for (const o of operations || []) {
      const i = lireYM(o.date); if (i == null || i < t0 - 6 || i > t0) continue;
      const c = cle(o.libelle); if (!c) continue;
      const g = c + (o.montant >= 0 ? '+' : '-');
      if (!groupes.has(g)) groupes.set(g, { cle: g, nom: joli(c), sens: o.montant >= 0 ? 'revenu' : 'depense', ops: [] });
      groupes.get(g).ops.push({ i, m: Math.abs(+o.montant) });
    }
    const connus = new Set((fluxConnus || []).map((f) => f.cle).filter(Boolean));
    const reguliers = [];
    for (const g of groupes.values()) {
      const mois = new Set(g.ops.map((o) => o.i)), med = mediane(g.ops.map((o) => o.m));
      if (mois.size < 3 || g.ops.length > mois.size * 1.5 || med < 5) continue;
      const ecart = (Math.max(...g.ops.map((o) => o.m)) - Math.min(...g.ops.map((o) => o.m))) / med;
      if (ecart > (g.sens === 'revenu' ? 0.4 : 0.25)) continue;
      reguliers.push({ cle: g.cle, nom: g.nom, sens: g.sens, montant: Math.round(med * 100) / 100, fois: mois.size });
    }
    reguliers.sort((a, b) => b.montant - a.montant);
    // dépenses courantes : tout ce qui n'est pas un flux déjà suivi, sur les 3 derniers mois complets
    let total = 0; const vus = new Set();
    for (const o of operations || []) {
      const i = lireYM(o.date); if (i == null || i < t0 - 3 || i >= t0) continue;
      vus.add(i);
      if (connus.has(cle(o.libelle) + (o.montant >= 0 ? '+' : '-'))) continue;
      total += +o.montant;
    }
    return { reguliers, suggestions: reguliers.filter((r) => !connus.has(r.cle)), courant: vus.size ? Math.max(0, -total / vus.size) : null };
  }

  const api = { H, n, ym, lireYM, ecrireYM, mensualite, restantDu, fluxDuMois, parMois, effets, chiffres, simuler, analyser, cle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Moteur = api;
})(typeof self !== 'undefined' ? self : this);
