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
    const entrees = new Array(H + 1).fill(0), sorties = new Array(H + 1).fill(0);
    for (let k = 1; k <= H; k++) {
      sorties[k] = n(etat.courant);
      for (const f of flux) { const v = fluxDuMois(f, t0 + k, t0); if (v > 0) entrees[k] += v; else sorties[k] -= v; }
      netBase[k] = entrees[k] - sorties[k];
    }
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
      if (r.d) for (let k = 1; k <= H; k++) { net[k] += r.d[k]; if (r.d[k] > 0) entrees[k] += r.d[k]; else sorties[k] -= r.d[k]; }
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
      H, t0, solde: solde0, coussin, sans, avec, entrees, sorties, projets: resultats, decouvert, sousCoussin,
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

  /* ---------- argent au quotidien : comptes, mois en cours, alertes ----------
     Tout part des opérations bancaires (date, montant signé, libellé, compte_id) et des soldes actuels. */
  const MAJ = (t) => String(t || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const CATEGORIES = [
    ['retraits', 'Retraits', /RETRAIT|\bDAB\b|\bGAB\b/],
    ['courses', 'Courses', /CARREFOUR|LECLERC|INTERMARCHE|AUCHAN|LIDL|ALDI|SUPER U|HYPER U|U EXPRESS|MONOPRIX|FRANPRIX|CASINO|NETTO|GRAND FRAIS|PICARD|BIOCOOP|SPAR|COCCINELLE|MARKET|SUPERMARCHE|EPICERIE|BOULANGER(?!.*ELECTRO)|BOUCHERIE|PRIMEUR/],
    ['carburant', 'Carburant', /ESSO|SHELL|\bBP\b|AVIA|DYNEFF|AGIP|CARBU|STATION|RELAIS|TOTAL(?!ENERGIES (ELEC|GAZ|CLIENT))/],
    ['factures', 'Logement et factures', /LOYER|\bEDF\b|ENGIE|TOTALENERGIES|EKWATEUR|VEOLIA|SUEZ|SAUR|ORANGE|\bSFR\b|FREE MOBILE|FREE TELECOM|FREEBOX|BOUYGUES|SOSH|RED BY|ASSURANCE|MAIF|MACIF|MATMUT|\bAXA\b|GROUPAMA|ALLIANZ|AREAS|\bMMA\b|\bGMF\b|MUTUELLE|IMPOT|DGFIP|TRESOR PUBLIC|SYNDIC|CREDIT|ECHEANCE PRET/],
    ['abonnements', 'Abonnements', /NETFLIX|SPOTIFY|DEEZER|DISNEY|CANAL|PRIME VIDEO|AMAZON PRIME|APPLE ?COM|ITUNES|ICLOUD|GOOGLE|PLAYSTATION|XBOX|NINTENDO|YOUTUBE|BASIC ?FIT|FITNESS|KEEP COOL/],
    ['sorties', 'Restaurants et sorties', /MC ?DO|MCDONALD|BURGER|\bKFC\b|QUICK|SUBWAY|UBER ?EATS|DELIVEROO|JUST ?EAT|RESTAU|PIZZ|SUSHI|KEBAB|TACOS|BRASSERIE|\bBAR\b|CAFE|CINEMA|PATHE|\bCGR\b|BOWLING/],
    ['transport', 'Transports', /SNCF|OUIGO|\bTER\b|UBER|BOLT|BLABLA|PEAGE|APRR|SANEF|VINCI AUTO|PARKING|INDIGO|RATP|NAVIGO|TAXI|LIME/],
    ['enligne', 'Achats en ligne', /AMAZON|CDISCOUNT|ZALANDO|SHEIN|TEMU|ALIEXPRESS|VINTED|LEBONCOIN|EBAY|FNAC|DARTY|BOULANGER|PAYPAL/],
    ['maison', 'Maison et bricolage', /LEROY|CASTORAMA|BRICO|IKEA|\bBUT\b|CONFORAMA|MAISONS DU MONDE|\bACTION\b|GIFI|FOIRFOUILLE|JARDI/],
    ['vetements', 'Vêtements et sport', /KIABI|DECATHLON|H ?& ?M|\bZARA\b|PRIMARK|CELIO|JULES|INTERSPORT|GO SPORT|NIKE|ADIDAS|SNIPES|COURIR/],
    ['sante', 'Santé', /PHARMA|DOCTEUR|\bDR\b|MEDECIN|DENTIST|OPTIC|KINE|LABO|HOPITAL|CLINIQUE|OSTEO/],
  ];
  const NOM_CAT = Object.fromEntries(CATEGORIES.map(([i, nom]) => [i, nom]));
  NOM_CAT.autres = 'Autres dépenses';
  function categorie(libelle) {
    const t = MAJ(libelle);
    for (const [i, , re] of CATEGORIES) if (re.test(t)) return i;
    return 'autres';
  }
  const EPARGNE_LIBELLE = /LIVRET|EPARGNE|\bLDD\b|\bLEP\b|\bPEL\b|\bCEL\b|ASSURANCE VIE|\bPEA\b|\bPER\b/;
  // genre d'un compte pour l'affichage : disponible, épargne, placement
  function genre(c) {
    if (c.type === 'placement' || /ASSURANCE.?VIE|\bPEA\b|\bPER\b|TITRES|BOURSE/.test(MAJ(c.nom))) return 'placement';
    return c.type === 'epargne' ? 'epargne' : 'courant';
  }

  const jour = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const JOUR_MS = 864e5;
  const ecartJours = (a, b) => Math.round((b - a) / JOUR_MS);
  function decaleMois(d, k, jourVoulu) { // même jour du mois, k mois plus loin (borné à la fin du mois)
    const j = jourVoulu || d.getDate(), x = new Date(d.getFullYear(), d.getMonth() + k, 1);
    const der = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    return new Date(x.getFullYear(), x.getMonth(), Math.min(j, der));
  }

  // virements entre ses propres comptes : ni une dépense, ni un revenu
  function marquerInternes(ops, comptes) {
    const genreDe = new Map((comptes || []).map((c) => [c.id, genre(c)]));
    const L = ops.map((o) => ({ ...o, montant: +o.montant, d: jour(o.date), interne: false, versEpargne: false }));
    const pos = L.filter((o) => o.montant > 0);
    for (const o of L) {
      if (o.montant >= 0 || o.interne) continue;
      const paire = pos.find((p) => !p.interne && p.compte_id && p.compte_id !== o.compte_id && Math.abs(p.montant + o.montant) < 0.01 && Math.abs(ecartJours(o.d, p.d)) <= 4);
      if (paire) {
        o.interne = paire.interne = true;
        o.versEpargne = genreDe.get(paire.compte_id) !== 'courant';
      } else if (/\bVIR/.test(MAJ(o.libelle)) && EPARGNE_LIBELLE.test(MAJ(o.libelle))) {
        o.interne = true; o.versEpargne = true;
      }
    }
    return L;
  }

  // la paie : le revenu régulier le plus élevé (au moins 2 mois, 400 € ou plus)
  function trouverPaie(L, auj) {
    const groupes = new Map();
    for (const o of L) {
      if (o.montant < 400 || o.interne || ecartJours(o.d, auj) > 130 || o.d > auj) continue;
      const c = cle(o.libelle) || 'REVENU';
      if (!groupes.has(c)) groupes.set(c, []);
      groupes.get(c).push(o);
    }
    let best = null;
    for (const [c, ops] of groupes) {
      const mois = new Set(ops.map((o) => ym(o.d)));
      if (mois.size < 2) continue;
      const med = mediane(ops.map((o) => o.montant));
      if (!best || med > best.montant) best = { cle: c, nom: joli(c), montant: med, ops: ops.sort((a, b) => a.d - b.d) };
    }
    if (!best) return null;
    const derniere = best.ops[best.ops.length - 1].d;
    const jourHabituel = Math.round(mediane(best.ops.map((o) => o.d.getDate())));
    return { nom: best.nom, montant: Math.round(best.montant), derniere, prochaine: decaleMois(derniere, 1, jourHabituel), jourHabituel };
  }

  /* Le mois en cours : depuis la dernière paie (ou le 1er du mois sans paie repérée) jusqu'à la prochaine. */
  function suiviMois({ comptes, operations, flux }, maintenant) {
    const auj = maintenant ? new Date(maintenant) : new Date(); auj.setHours(12, 0, 0, 0);
    const courants = (comptes || []).filter((c) => genre(c) === 'courant');
    const soldeCourant = courants.reduce((s, c) => s + n(c.solde), 0);
    const L = marquerInternes(operations || [], comptes);
    const paie = trouverPaie(L, auj);
    let debut, fin;
    if (paie) { debut = new Date(paie.derniere); fin = new Date(paie.prochaine); }
    else { debut = new Date(auj.getFullYear(), auj.getMonth(), 1); fin = new Date(auj.getFullYear(), auj.getMonth() + 1, 1); }
    debut.setHours(0, 0, 0, 0); fin.setHours(0, 0, 0, 0);
    const dureeP = Math.max(1, ecartJours(debut, fin));
    const ecoules = Math.min(dureeP, Math.max(0, ecartJours(debut, auj)));
    const joursRestants = Math.max(0, ecartJours(auj, fin));
    const idsCourants = new Set(courants.map((c) => c.id));
    const surCourant = (o) => !o.compte_id || !idsCourants.size || idsCourants.has(o.compte_id);
    const dans = (o, a, b) => o.d >= a && o.d < b;
    const periode = L.filter((o) => dans(o, debut, new Date(auj.getTime() + JOUR_MS)) && surCourant(o));
    const depenses = periode.filter((o) => o.montant < 0 && !o.interne);
    const parCat = (ops) => { const m = {}; for (const o of ops) { const c = categorie(o.libelle); m[c] = (m[c] || 0) - o.montant; } return m; };
    const actuel = parCat(depenses);

    // habitude : les 3 périodes précédentes, jusqu'au même jour de la période
    const avant = [];
    for (let k = 1; k <= 3; k++) {
      const a = decaleMois(debut, -k, debut.getDate()), b = new Date(a.getTime() + ecoules * JOUR_MS + JOUR_MS), finP = decaleMois(debut, -k + 1, debut.getDate());
      const ops = L.filter((o) => o.montant < 0 && !o.interne && surCourant(o));
      const auMeme = ops.filter((o) => dans(o, a, b)), complet = ops.filter((o) => dans(o, a, finP));
      if (!L.some((o) => o.d < a)) break; // pas assez d'historique pour cette période
      avant.push({ auMeme: parCat(auMeme), complet: complet.reduce((s, o) => s - o.montant, 0), jours: Math.max(1, ecartJours(a, finP)) });
    }
    const habituel = {};
    for (const p of avant) for (const [c, v] of Object.entries(p.auMeme)) habituel[c] = (habituel[c] || 0) + v / avant.length;
    const ids = new Set([...Object.keys(actuel), ...Object.keys(habituel)]);
    const categories = [...ids].map((c) => ({ id: c, nom: NOM_CAT[c], montant: Math.round(actuel[c] || 0), habituel: avant.length ? Math.round(habituel[c] || 0) : null }))
      .filter((c) => c.montant > 0 || (c.habituel || 0) > 0).sort((a, b) => b.montant - a.montant);

    // prélèvements mensuels pas encore passés d'ici la prochaine paie
    const negPeriode = periode.filter((o) => o.montant < 0);
    const aVenir = [];
    for (const f of flux || []) {
      if (f.sens !== 'depense' || f.actif === false) continue;
      const per = PERIODE[f.frequence] || 1;
      if (per > 1) { // trimestriel ou annuel : seulement si son mois tombe entre aujourd'hui et la paie
        const ref = (f.mois || 1) - 1, mois = new Set();
        for (let x = new Date(auj.getFullYear(), auj.getMonth(), 1); x <= fin; x = new Date(x.getFullYear(), x.getMonth() + 1, 1)) mois.add(x.getMonth());
        if (![...mois].some((m) => (((m - ref) % per) + per) % per === 0)) continue;
      }
      const montant = n(f.montant);
      const passe = negPeriode.some((o) => (f.cle && cle(o.libelle) + '-' === f.cle) || Math.abs(-o.montant - montant) <= Math.max(1, montant * 0.02));
      if (!passe) aVenir.push({ nom: f.nom, montant });
    }
    const totalAVenir = aVenir.reduce((s, x) => s + x.montant, 0);
    const reste = soldeCourant - totalAVenir;
    const variableParJour = avant.length ? avant.reduce((s, p) => s + p.complet / p.jours, 0) / avant.length : null;

    return {
      debut: iso(debut), fin: iso(fin), joursRestants, duree: dureeP, ecoules, paie: paie ? { nom: paie.nom, montant: paie.montant, derniere: iso(paie.derniere), prochaine: iso(paie.prochaine) } : null,
      avecBanque: L.length > 0, historique: avant.length,
      soldeCourant, depense: Math.round(depenses.reduce((s, o) => s - o.montant, 0)),
      entrees: Math.round(periode.filter((o) => o.montant > 0 && !o.interne).reduce((s, o) => s + o.montant, 0)),
      misDeCote: Math.round(periode.filter((o) => o.versEpargne).reduce((s, o) => s - o.montant, 0)),
      categories, aVenir, totalAVenir: Math.round(totalAVenir), reste: Math.round(reste),
      parJour: joursRestants > 0 ? Math.round(reste / joursRestants) : null,
      variableParJour: variableParJour == null ? null : Math.round(variableParJour),
      operations: periode.filter((o) => !o.interne).sort((a, b) => b.d - a.d).map((o) => ({ date: iso(o.d), montant: o.montant, libelle: o.libelle, categorie: o.montant < 0 ? categorie(o.libelle) : 'revenu' })),
    };
  }

  /* Tous les comptes : total, par genre, et le total à la fin de chacun des 6 derniers mois. */
  function comptesVue(comptes, operations, maintenant) {
    const auj = maintenant ? new Date(maintenant) : new Date();
    const C = (comptes || []).map((c) => ({ ...c, genre: genre(c), solde: n(c.solde) }));
    const parGenre = { courant: 0, epargne: 0, placement: 0 };
    for (const c of C) parGenre[c.genre] += c.solde;
    const total = C.reduce((s, c) => s + c.solde, 0);
    const avecOps = new Set((operations || []).map((o) => o.compte_id).filter(Boolean));
    const histoire = [];
    for (let k = 5; k >= 0; k--) {
      const finMois = k === 0 ? auj : new Date(auj.getFullYear(), auj.getMonth() - k + 1, 0, 23, 59);
      let t = total;
      for (const o of operations || []) if (o.compte_id && avecOps.has(o.compte_id) && jour(o.date) > finMois) t -= +o.montant;
      histoire.push({ mois: ecrireYM(ym(finMois)), total: Math.round(t) });
    }
    const connu = avecOps.size > 0;
    return { comptes: C, total: Math.round(total), parGenre, histoire: connu ? histoire : null, variation: connu ? Math.round(total - histoire[0].total) : null };
  }

  /* Alertes du jour, de la plus grave à la moins grave. */
  function alertes(suivi, maintenant) {
    const A = [], auj = maintenant ? new Date(maintenant) : new Date();
    if (suivi.soldeCourant < 0) A.push({ ton: 'rouge', type: 'decouvert', titre: 'Ton compte courant est à découvert', montant: -suivi.soldeCourant });
    else if (suivi.avecBanque && suivi.joursRestants > 0) {
      const besoin = suivi.totalAVenir + (suivi.variableParJour || 0) * suivi.joursRestants;
      const manque = Math.round(besoin - suivi.soldeCourant);
      if (suivi.reste < 0) A.push({ ton: 'rouge', type: 'risque', titre: 'Découvert à prévoir avant la paie', montant: -suivi.reste, quand: suivi.fin });
      else if (manque > 0 && suivi.variableParJour) {
        const jours = Math.floor(suivi.reste / suivi.variableParJour);
        A.push({ ton: 'alerte', type: 'risque', titre: 'Risque de découvert avant la paie', montant: manque, quand: iso(new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() + Math.max(0, jours))) });
      }
    }
    if (suivi.paie && ecartJours(jour(suivi.paie.prochaine), auj) > 3) A.push({ ton: 'alerte', type: 'paie', titre: 'Ta paie n’est pas encore arrivée', quand: suivi.paie.prochaine, montant: suivi.paie.montant });
    if (suivi.historique && suivi.ecoules >= 3) {
      const hautes = suivi.categories.filter((c) => c.habituel != null && c.habituel >= 30 && c.montant > c.habituel * 1.3 && c.montant - c.habituel >= 40)
        .sort((a, b) => (b.montant - b.habituel) - (a.montant - a.habituel)).slice(0, 2);
      for (const c of hautes) A.push({ ton: 'alerte', type: 'inhabituel', titre: `${c.nom} : plus que d’habitude`, montant: c.montant - c.habituel, categorie: c.id, actuel: c.montant, habituel: c.habituel });
    }
    return A;
  }

  const api = { H, n, ym, lireYM, ecrireYM, mensualite, restantDu, fluxDuMois, parMois, effets, chiffres, simuler, analyser, cle, categorie, genre, suiviMois, comptesVue, alertes, NOM_CAT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Moteur = api;
})(typeof self !== 'undefined' ? self : this);
