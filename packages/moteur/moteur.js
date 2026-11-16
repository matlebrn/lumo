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
  // [id, nom, groupe (besoin : on ne peut guère s'en passer ; envie : on choisit), repère dans le libellé]
  const CATEGORIES = [
    ['frais', 'Frais bancaires', 'besoin', /\bFRAIS\b|COTIS|COMMISSION|AGIOS|INTERETS? DEBIT|INT DEBIT|\bREJET\b|\bOPPOSITION\b/],
    ['retraits', 'Retraits', 'envie', /RETRAIT|\bDAB\b|\bGAB\b/],
    ['credits', 'Crédits', 'besoin', /ECHEANCE PRET|\bPRET\b|COFIDIS|CETELEM|SOFINCO|\bFLOA\b|\bONEY\b|FRANFINANCE|YOUNITED|CREDIT (AUTO|CONSO|IMMO|RENOUV)|LOCATION LONGUE|\bLOA\b|\bLLD\b|PAIEMENT EN \d|PAYPAL 4X|KLARNA|ALMA/],
    ['impots', 'Impôts', 'besoin', /IMPOT|DGFIP|TRESOR PUBLIC|FINANCES PUBLIQUES|AMENDE|\bANTAI\b/],
    ['assurances', 'Assurances et mutuelle', 'besoin', /ASSURANCE|ASSUR\b|MAIF|MACIF|MATMUT|\bAXA\b|GROUPAMA|ALLIANZ|AREAS|\bMMA\b|\bGMF\b|MUTUELLE|HARMONIE|MALAKOFF|AG2R|APRIL|LUKO|\bPACIFICA\b/],
    ['logement', 'Logement et énergie', 'besoin', /LOYER|\bEDF\b|ENGIE|TOTALENERGIES|EKWATEUR|VATTENFALL|OHM ENERGIE|MINT ENERGIE|VEOLIA|SUEZ|SAUR|\bEAU\b|SYNDIC|FONCIA|NEXITY|CITYA|OFFICE HLM|HABITAT/],
    ['telecom', 'Téléphone et internet', 'besoin', /ORANGE|\bSFR\b|FREE MOBILE|FREE TELECOM|FREEBOX|BOUYGUES|\bSOSH\b|RED BY|PRIXTEL|LA POSTE MOBILE|\bB AND YOU\b/],
    ['courses', 'Courses', 'besoin', /CARREFOUR|LECLERC|INTERMARCHE|AUCHAN|LIDL|ALDI|SUPER U|HYPER U|U EXPRESS|MONOPRIX|FRANPRIX|CASINO|NETTO|GRAND FRAIS|PICARD|BIOCOOP|SPAR|COCCINELLE|MARKET|SUPERMARCHE|EPICERIE|BOULANGER(?!.*ELECTRO)|BOUCHERIE|PRIMEUR|COLRUYT|MATCH\b/],
    ['carburant', 'Carburant', 'besoin', /ESSO|SHELL|\bBP\b|AVIA|DYNEFF|AGIP|CARBU|STATION|RELAIS|TOTAL(?!ENERGIES (ELEC|GAZ|CLIENT))|IONITY|TESLA SUPERCHARG/],
    ['transport', 'Transports', 'besoin', /SNCF|OUIGO|\bTER\b|UBER(?! ?EATS)|BOLT|BLABLA|PEAGE|APRR|SANEF|VINCI AUTO|PARKING|INDIGO|RATP|NAVIGO|TAXI|LIME|NORAUTO|FEU VERT|SPEEDY|MIDAS|GARAGE|CONTROLE TECH/],
    ['sante', 'Santé', 'besoin', /PHARMA|DOCTEUR|\bDR\b|MEDECIN|DENTIST|OPTIC|KINE|LABO|HOPITAL|CLINIQUE|OSTEO|DOCTOLIB/],
    ['abonnements', 'Abonnements', 'envie', /NETFLIX|SPOTIFY|DEEZER|DISNEY|CANAL|PRIME VIDEO|AMAZON PRIME|APPLE ?COM|ITUNES|ICLOUD|GOOGLE|PLAYSTATION|XBOX|NINTENDO|YOUTUBE|BASIC ?FIT|FITNESS|KEEP COOL|ON AIR|CHATGPT|OPENAI|CLAUDE|ANTHROPIC|TWITCH|DAZN|BEIN|MOLOTOV|AUDIBLE|KINDLE/],
    ['sorties', 'Restaurants et sorties', 'envie', /MC ?DO|MCDONALD|BURGER|\bKFC\b|QUICK|SUBWAY|UBER ?EATS|DELIVEROO|JUST ?EAT|RESTAU|PIZZ|SUSHI|KEBAB|TACOS|BRASSERIE|\bBAR\b|CAFE|CINEMA|PATHE|\bCGR\b|BOWLING|STARBUCKS|O TACOS|FIVE GUYS|BOUTIQUE ?TABAC|TABAC|FDJ/],
    ['enligne', 'Achats en ligne', 'envie', /AMAZON|CDISCOUNT|ZALANDO|SHEIN|TEMU|ALIEXPRESS|VINTED|LEBONCOIN|EBAY|FNAC|DARTY|BOULANGER|PAYPAL|APPLE STORE|BACK MARKET/],
    ['maison', 'Maison et bricolage', 'envie', /LEROY|CASTORAMA|BRICO|IKEA|\bBUT\b|CONFORAMA|MAISONS DU MONDE|\bACTION\b|GIFI|FOIRFOUILLE|JARDI|WELDOM/],
    ['vetements', 'Vêtements et sport', 'envie', /KIABI|DECATHLON|H ?& ?M|\bZARA\b|PRIMARK|CELIO|JULES|INTERSPORT|GO SPORT|NIKE|ADIDAS|SNIPES|COURIR|SEPHORA|COIFF/],
  ];
  const NOM_CAT = Object.fromEntries(CATEGORIES.map(([i, nom]) => [i, nom]));
  NOM_CAT.autres = 'Autres dépenses'; NOM_CAT.revenu = 'Rentrée'; NOM_CAT.interne = 'Entre mes comptes';
  const GROUPE = Object.fromEntries(CATEGORIES.map(([i, , g]) => [i, g])); GROUPE.autres = 'envie';
  // ce que l'utilisateur peut choisir pour une dépense, dans l'ordre d'affichage
  const CHOIX_DEPENSE = ['courses', 'logement', 'telecom', 'assurances', 'credits', 'impots', 'carburant', 'transport', 'sante', 'abonnements', 'sorties', 'enligne', 'maison', 'vetements', 'retraits', 'frais', 'autres', 'interne'];
  const CHOIX_RENTREE = ['revenu', 'interne'];
  // repère d'une règle de classement : le début du libellé et le sens de l'opération
  const cleRegle = (o) => (cle(o.libelle) || MAJ(o.libelle).replace(/[^A-Z ]+/g, ' ').trim().slice(0, 40) || '?') + (+o.montant >= 0 ? '+' : '-');
  /* Catégorie d'une opération : règle choisie par l'utilisateur d'abord, sinon le libellé.
     Accepte aussi un simple libellé (une dépense). */
  function categorie(o, regles) {
    if (typeof o !== 'object' || o == null) o = { libelle: o, montant: -1 };
    if (regles) { const r = regles[cleRegle(o)]; if (r) return r; }
    if (+o.montant >= 0) return 'revenu';
    const t = MAJ(`${o.libelle || ''} ${o.contrepartie || ''}`);
    for (const [i, , , re] of CATEGORIES) if (re.test(t)) return i;
    return (o.mcc && parMcc(o.mcc)) || 'autres';
  }
  // Code d'activité du commerçant (norme ISO 18245), donné par la banque pour les paiements par carte
  const MCC = [
    ['retraits', [6010, 6011]], ['courses', [5411, 5412, 5422, 5441, 5451, 5462, 5499]],
    ['carburant', [5541, 5542, 5552, 5983]], ['sorties', [5811, 5812, 5813, 5814, 7832, 7922, 7991, 7996]],
    ['transport', [4011, 4111, 4112, 4121, 4131, 4511, 4784, 4789, 5532, 5533, 7512, 7523, 7531, 7538, 7542]],
    ['sante', [5122, 5912, 5975, 5976, 8011, 8021, 8031, 8041, 8042, 8043, 8049, 8050, 8062, 8071, 8099]],
    ['vetements', [5611, 5621, 5631, 5641, 5651, 5655, 5661, 5681, 5691, 5697, 5698, 5699, 5940, 5941, 5977, 7230, 7298]],
    ['maison', [5039, 5200, 5211, 5231, 5251, 5261, 5712, 5713, 5714, 5718, 5719, 5722]],
    ['abonnements', [4899, 5815, 5816, 5817, 5818, 7997]], ['telecom', [4812, 4814]],
    ['logement', [4900]], ['assurances', [6300]], ['impots', [9211, 9222, 9311, 9399]],
    ['enligne', [5310, 5311, 5331, 5399, 5732, 5734, 5964]],
  ];
  const MCC_CAT = new Map(MCC.flatMap(([c, L]) => L.map((x) => [x, c])));
  const parMcc = (mcc) => MCC_CAT.get(+mcc) || null;
  // Lumo hésite : une dépense que rien ne classe et que l'utilisateur n'a pas encore rangée
  const aClasser = (o, regles) => +o.montant < 0 && !(regles && regles[cleRegle(o)]) && categorie(o) === 'autres';
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
  const ibanPropre = (x) => String(x || '').replace(/\s+/g, '').toUpperCase();
  function marquerInternes(ops, comptes, regles) {
    const genreDe = new Map((comptes || []).map((c) => [c.id, genre(c)]));
    // ses propres comptes, reconnus par leur IBAN, même dans une autre banque
    const parIban = new Map((comptes || []).filter((c) => c.iban).map((c) => [ibanPropre(c.iban), c]));
    const L = ops.map((o) => ({ ...o, montant: +o.montant, d: jour(o.date), interne: false, versEpargne: false }));
    for (const o of L) {
      const c = o.contrepartie_iban && parIban.get(ibanPropre(o.contrepartie_iban));
      if (c && c.id !== o.compte_id) { o.interne = true; o.versEpargne = o.montant < 0 && genre(c) !== 'courant'; }
    }
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
    if (regles) for (const o of L) if (!o.interne && regles[cleRegle(o)] === 'interne') o.interne = true;
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
  function suiviMois({ comptes, operations, flux, regles }, maintenant) {
    const auj = maintenant ? new Date(maintenant) : new Date(); auj.setHours(12, 0, 0, 0);
    const courants = (comptes || []).filter((c) => genre(c) === 'courant');
    const soldeCourant = courants.reduce((s, c) => s + n(c.solde), 0);
    const L = marquerInternes(operations || [], comptes, regles);
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
    const parCat = (ops) => { const m = {}; for (const o of ops) { const c = categorie(o, regles); m[c] = (m[c] || 0) - o.montant; } return m; };
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
    // paiements par carte pas encore débités : le solde de la banque ne les compte pas encore
    const enCours = -L.filter((o) => o.statut === 'PDNG' && o.montant < 0 && !o.interne && surCourant(o)).reduce((s, o) => s + o.montant, 0);
    const reste = soldeCourant - enCours - totalAVenir;
    const autorise = courants.reduce((s, c) => s + (c.decouvert != null ? Math.abs(n(c.decouvert)) : 0), 0);
    const variableParJour = avant.length ? avant.reduce((s, p) => s + p.complet / p.jours, 0) / avant.length : null;

    return {
      debut: iso(debut), fin: iso(fin), joursRestants, duree: dureeP, ecoules, paie: paie ? { nom: paie.nom, montant: paie.montant, derniere: iso(paie.derniere), prochaine: iso(paie.prochaine) } : null,
      avecBanque: L.length > 0, historique: avant.length,
      soldeCourant, enCours: Math.round(enCours), decouvertAutorise: autorise || null,
      soldeDispo: courants.some((c) => c.solde_dispo != null) ? Math.round(courants.reduce((s, c) => s + (c.solde_dispo != null ? n(c.solde_dispo) : n(c.solde)), 0)) : null,
      depense: Math.round(depenses.reduce((s, o) => s - o.montant, 0)),
      entrees: Math.round(periode.filter((o) => o.montant > 0 && !o.interne).reduce((s, o) => s + o.montant, 0)),
      misDeCote: Math.round(periode.filter((o) => o.versEpargne).reduce((s, o) => s - o.montant, 0)),
      categories, aVenir, totalAVenir: Math.round(totalAVenir), reste: Math.round(reste),
      parJour: joursRestants > 0 ? Math.round(reste / joursRestants) : null,
      variableParJour: variableParJour == null ? null : Math.round(variableParJour),
      operations: periode.filter((o) => !o.interne).sort((a, b) => b.d - a.d).map((o) => ({ date: iso(o.d), montant: o.montant, libelle: o.libelle, contrepartie: o.contrepartie || null, enCours: o.statut === 'PDNG', categorie: categorie(o, regles), id: o.id })),
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
    if (suivi.decouvertAutorise && suivi.soldeCourant - (suivi.enCours || 0) < -0.8 * suivi.decouvertAutorise) A.push({ ton: 'rouge', type: 'plafond', titre: 'Tu approches de ton découvert autorisé', montant: suivi.decouvertAutorise, actuel: -(suivi.soldeCourant - (suivi.enCours || 0)) });
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

  /* ---------- bilan : ce qui rentre, ce qui sort, ce qui va, ce qui ne va pas, et quoi faire ----------
     Sur les mois complets connus (12 au plus). Avec la banque : tout vient des opérations.
     Sans banque : on part du budget saisi (revenus, dépenses fixes, dépenses courantes). */
  const arr = (v) => Math.round(v);
  const moy = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const borne = (x, a, b) => Math.max(a, Math.min(b, x));
  function bilan({ operations, comptes, flux, regles, mensuel }, maintenant) {
    const auj = maintenant ? new Date(maintenant) : new Date(); auj.setHours(12, 0, 0, 0);
    const t0 = ym(auj);
    const L = marquerInternes(operations || [], comptes, regles);
    const C = (comptes || []).map((c) => ({ ...c, genre: genre(c), solde: n(c.solde) }));
    const epargneDispo = C.filter((c) => c.genre === 'epargne').reduce((s, c) => s + c.solde, 0);
    const placements = C.filter((c) => c.genre === 'placement').reduce((s, c) => s + c.solde, 0);
    const courants = C.filter((c) => c.genre === 'courant');
    const soldeCourant = courants.reduce((s, c) => s + c.solde, 0);
    const avecBanque = L.length > 0;

    // ----- les mois -----
    let mois = [];
    if (avecBanque) {
      const premier = L.reduce((d, o) => (o.d < d ? o.d : d), L[0].d);
      let i0 = ym(premier); if (premier.getDate() > 7) i0++; // premier mois incomplet : on l'écarte
      i0 = Math.max(i0, t0 - 12);
      for (let i = i0; i <= t0; i++) mois.push({ i, mois: ecrireYM(i), enCours: i === t0, entrees: 0, sorties: 0, misDeCote: 0, cats: {}, ops: 0 });
      const parI = new Map(mois.map((m) => [m.i, m]));
      for (const o of L) {
        const m = parI.get(ym(o.d)); if (!m) continue;
        if (o.versEpargne) m.misDeCote -= o.montant;
        if (o.interne) continue;
        m.ops++;
        if (o.montant >= 0) { m.entrees += o.montant; continue; }
        const c = categorie(o, regles); if (c === 'interne') continue;
        m.sorties -= o.montant; m.cats[c] = (m.cats[c] || 0) - o.montant;
      }
      mois = mois.map((m) => ({ ...m, entrees: arr(m.entrees), sorties: arr(m.sorties), net: arr(m.entrees - m.sorties), misDeCote: arr(m.misDeCote) }));
    }
    const complets = mois.filter((m) => !m.enCours);
    const recents = complets.slice(-3), anciens = complets.slice(-6, -3);
    if (avecBanque && !complets.length) return { avecBanque, assez: false, mois, aClasser: L.filter((o) => !o.interne && aClasser(o, regles)).length };

    // ----- moyennes par mois -----
    let revenus, depenses, cats = {};
    if (avecBanque) {
      revenus = moy(recents.map((m) => m.entrees)); depenses = moy(recents.map((m) => m.sorties));
      for (const m of recents) for (const [c, v] of Object.entries(m.cats)) cats[c] = (cats[c] || 0) + v / recents.length;
    } else {
      const M0 = mensuel || { revenus: 0, fixes: 0, courant: 0 };
      revenus = M0.revenus; depenses = M0.fixes + M0.courant;
      // sans banque, on range les dépenses fixes saisies d'après leur nom
      for (const f of flux || []) if (f.sens === 'depense' && f.actif !== false) { const c = categorie(f.nom); const k = c === 'autres' ? 'fixes' : c; cats[k] = (cats[k] || 0) + parMois(f); }
      if (M0.courant) cats.courant = (cats.courant || 0) + M0.courant;
    }
    const net = revenus - depenses;
    const taux = revenus > 0 ? net / revenus : null;
    const nomCat = (c) => NOM_CAT[c] || (c === 'fixes' ? 'Autres dépenses fixes' : c === 'courant' ? 'Dépenses courantes' : c);
    const groupeDe = (c) => (c === 'fixes' ? 'besoin' : c === 'courant' ? 'envie' : GROUPE[c] || 'envie');
    const categories = Object.entries(cats).filter(([, v]) => v >= 1).map(([id, v]) => {
      const avant = anciens.length ? moy(anciens.map((m) => m.cats[id] || 0)) : null;
      return { id, nom: nomCat(id), groupe: groupeDe(id), montant: arr(v), part: depenses ? v / depenses : 0, avant: avant == null ? null : arr(avant), serie: complets.map((m) => arr(m.cats[id] || 0)) };
    }).sort((a, b) => b.montant - a.montant);
    const besoins = categories.filter((c) => c.groupe === 'besoin').reduce((s, c) => s + c.montant, 0);
    const envies = categories.filter((c) => c.groupe === 'envie').reduce((s, c) => s + c.montant, 0);
    const repartition = revenus > 0 ? { besoins: besoins / revenus, envies: envies / revenus, epargne: Math.max(0, net) / revenus } : null;
    const credits = cats.credits || 0;
    const endettement = revenus > 0 ? credits / revenus : null;
    const moisSecurite = depenses > 0 ? epargneDispo / depenses : null;
    const hausses = categories.filter((c) => c.avant != null && c.montant - c.avant >= 30 && c.montant > c.avant * 1.2).map((c) => ({ ...c, de: c.montant - c.avant })).sort((a, b) => b.de - a.de);

    // ----- découvert : solde du compte courant jour par jour, sur 90 jours -----
    let joursRouge = 0, plusBas = null, frais = 0;
    if (avecBanque && courants.length) {
      const ids = new Set(courants.map((c) => c.id)), deb = new Date(auj.getTime() - 90 * JOUR_MS);
      const ops = L.filter((o) => ids.has(o.compte_id) || !o.compte_id).sort((a, b) => b.d - a.d);
      let solde = soldeCourant, k = 0;
      for (let d = new Date(auj); d >= deb; d = new Date(d.getTime() - JOUR_MS)) {
        if (solde < 0) joursRouge++;
        plusBas = plusBas == null ? solde : Math.min(plusBas, solde);
        while (k < ops.length && ops[k].d >= new Date(d.getFullYear(), d.getMonth(), d.getDate())) { solde -= ops[k].montant; k++; }
      }
      plusBas = arr(plusBas);
      frais = arr(L.filter((o) => o.montant < 0 && o.d >= deb && categorie(o, regles) === 'frais').reduce((s, o) => s - o.montant, 0));
    }

    // ----- abonnements et paiements réguliers -----
    const abonnements = [];
    if (avecBanque) {
      const G = new Map();
      for (const o of L) {
        if (o.montant >= 0 || o.interne || ym(o.d) < t0 - 4) continue;
        const c = categorie(o, regles); if (c !== 'abonnements') continue;
        const k = cle(o.libelle) || o.libelle; if (!G.has(k)) G.set(k, { nom: joli(k), m: [], mois: new Set() });
        G.get(k).m.push(-o.montant); G.get(k).mois.add(ym(o.d));
      }
      for (const g of G.values()) if (g.mois.size >= 2) { const v = mediane(g.m); abonnements.push({ nom: g.nom, montant: Math.round(v * 100) / 100, parAn: arr(v * 12) }); }
    } else for (const f of flux || []) if (f.sens === 'depense' && f.actif !== false && categorie(f.nom) === 'abonnements') abonnements.push({ nom: f.nom, montant: n(f.montant), parAn: arr(parMois(f) * 12) });
    abonnements.sort((a, b) => b.montant - a.montant);
    const totalAbosAn = abonnements.reduce((s, a) => s + a.parAn, 0), totalAbos = totalAbosAn / 12;

    // ----- la note sur 100 -----
    const pts = {
      epargne: taux == null ? 0 : 35 * borne((taux + 0.05) / 0.25, 0, 1),
      securite: moisSecurite == null ? 0 : 25 * borne(moisSecurite / 3, 0, 1),
      decouvert: !avecBanque ? (net >= 0 ? 20 : 5) : 20 * borne(1 - joursRouge / 20, 0, 1) - (frais > 0 ? 4 : 0),
      dettes: endettement == null ? 5 : 10 * borne((0.35 - endettement) / 0.2, 0, 1),
      maitrise: repartition ? 10 * borne((0.75 - repartition.besoins) / 0.25, 0, 1) : 5,
    };
    const note = arr(borne(Object.values(pts).reduce((s, x) => s + x, 0), 0, 100));
    const niveau = note >= 75 ? { ton: 'bon', nom: 'Solide' } : note >= 55 ? { ton: 'bon', nom: 'Correct' } : note >= 35 ? { ton: 'alerte', nom: 'Fragile' } : { ton: 'rouge', nom: 'En difficulté' };
    const difficulte = net < 0 || joursRouge >= 5 || niveau.ton === 'rouge';

    // ----- ce qui va, ce qui ne va pas -----
    const P = (ton, titre, texte) => ({ ton, titre, texte });
    const va = [], vaPas = [];
    const e = (v) => `${Math.round(v).toLocaleString('fr-FR')} €`, pc = (v) => `${Math.round(v * 100)} %`;
    if (taux != null) {
      if (taux >= 0.15) va.push(P('bon', `Tu gardes ${pc(taux)} de tes revenus`, `Soit ${e(net)} par mois en moyenne. Au-dessus de 15 %, c’est un très bon rythme.`));
      else if (taux >= 0.05) va.push(P('bon', `Tu termines le mois dans le vert`, `Il te reste ${e(net)} par mois en moyenne, ${pc(taux)} de tes revenus. Vise 10 à 20 %.`));
      else if (net >= 0) vaPas.push(P('alerte', 'Tu finis le mois tout juste', `Il ne reste que ${e(net)} par mois en moyenne. Au moindre imprévu, tu passes dans le rouge.`));
      else vaPas.push(P('rouge', `Tu dépenses plus que tu ne gagnes`, `${e(-net)} de trop chaque mois en moyenne : ${e(depenses)} de dépenses pour ${e(revenus)} de rentrées.`));
    }
    if (moisSecurite != null) {
      if (moisSecurite >= 3) va.push(P('bon', `Ton épargne couvre ${Math.floor(moisSecurite)} mois`, `${e(epargneDispo)} de côté : de quoi tenir face à un coup dur.`));
      else if (moisSecurite >= 1) vaPas.push(P('alerte', `Ton épargne couvre ${moisSecurite < 1.5 ? '1 mois' : `${Math.floor(moisSecurite)} mois`}`, `${e(epargneDispo)} de côté. L’idéal : 3 mois de dépenses, soit ${e(depenses * 3)}.`));
      else vaPas.push(P(epargneDispo > 0 ? 'alerte' : 'rouge', epargneDispo > 0 ? 'Pas assez d’épargne de secours' : 'Aucune épargne de secours', `Moins d’un mois de dépenses de côté. Une panne de voiture ou une facture imprévue te met en difficulté.`));
    }
    if (avecBanque) {
      if (joursRouge === 0 && frais === 0) va.push(P('bon', 'Aucun découvert en 3 mois', 'Ton compte courant est resté positif et tu n’as payé aucun frais bancaire.'));
      else if (joursRouge > 0) vaPas.push(P(joursRouge >= 10 ? 'rouge' : 'alerte', `${joursRouge} jour${joursRouge > 1 ? 's' : ''} à découvert en 3 mois`, `Ton compte est descendu jusqu’à ${e(plusBas)}${frais ? `, et tu as payé ${e(frais)} de frais bancaires` : ''}.`));
      else if (frais > 0) vaPas.push(P('alerte', `${e(frais)} de frais bancaires en 3 mois`, 'De l’argent perdu : vérifie ta carte, tes options et les commissions.'));
    }
    if (endettement != null && credits > 0) {
      if (endettement > 0.35) vaPas.push(P('rouge', `Tes crédits prennent ${pc(endettement)} de tes revenus`, `${e(credits)} par mois. Au-delà de 35 %, le budget devient très serré et une banque refuse en général un nouveau prêt.`));
      else if (endettement > 0.25) vaPas.push(P('alerte', `Crédits : ${pc(endettement)} de tes revenus`, `${e(credits)} par mois. Reste sous 35 %, évite d’en ajouter.`));
      else va.push(P('bon', `Crédits sous contrôle`, `${e(credits)} par mois, ${pc(endettement)} de tes revenus.`));
    }
    if (repartition && repartition.besoins > 0.6) vaPas.push(P('alerte', `Les dépenses obligatoires pèsent ${pc(repartition.besoins)}`, `Logement, factures, courses, transport… Au-delà de 60 %, il reste peu de marge pour le reste.`));
    for (const h of hausses.slice(0, 2)) vaPas.push(P('alerte', `${h.nom} : en hausse`, `${e(h.montant)} par mois ces 3 derniers mois, contre ${e(h.avant)} avant (+${e(h.de)}).`));
    if (totalAbos >= 40) vaPas.push(P('alerte', `${abonnements.length} abonnements : ${e(totalAbosAn)} par an`, `${e(totalAbos)} par mois qui partent sans que tu y penses.`));

    // ----- le plan : quoi faire, dans l'ordre -----
    const plan = [];
    const A = (titre, texte, gain) => plan.push({ titre, texte, gain: gain ? arr(gain) : 0 });
    if (net < 0) A(`Trouver ${e(-net)} par mois`, `C’est ce qui manque pour équilibrer. Les étapes suivantes montrent où les prendre.`, 0);
    if (avecBanque && (joursRouge > 0 || frais > 0)) A('Arrêter les frais bancaires', `${frais ? `${e(frais)} payés en 3 mois. ` : ''}Demande à ta banque la liste des frais et un plafond. Décale tes prélèvements juste après ta paie pour ne plus passer sous zéro.`, frais / 3);
    if (abonnements.length) {
      const top = abonnements.slice(0, 3).map((a) => a.nom).join(', ');
      A('Faire le tri dans tes abonnements', `${e(totalAbos)} par mois (${top}${abonnements.length > 3 ? '…' : ''}). Garde ceux que tu utilises vraiment chaque semaine.`, totalAbos * 0.4);
    }
    const coupables = categories.filter((c) => c.groupe === 'envie' && !['abonnements', 'retraits', 'autres', 'courant'].includes(c.id) && c.montant >= 60).slice(0, 2);
    for (const c of coupables) A(`${c.nom} : viser ${e(c.montant * 0.8)}`, `Tu y mets ${e(c.montant)} par mois. Avec 20 % de moins, tu gardes ${e(c.montant * 0.2)}${c.avant != null && c.montant > c.avant ? ` (c’était ${e(c.avant)} avant)` : ''}.`, c.montant * 0.2);
    if (cats.courses >= 250) A('Courses : préparer une liste', `${e(cats.courses)} par mois. Liste, marques distributeur et un plafond par semaine font souvent gagner 10 %.`, cats.courses * 0.1);
    if (endettement > 0.35) A('Ne pas ajouter de crédit', 'Pas de nouveau crédit ni de paiement en plusieurs fois. Demande à ta banque si un rachat ou une renégociation baisserait tes mensualités.', 0);
    const gains = plan.reduce((s, a) => s + a.gain, 0);
    const libre = Math.max(0, net);
    if (moisSecurite != null && moisSecurite < 3) {
      const cible = depenses * (moisSecurite < 1 ? 1 : 3), manque = Math.max(0, cible - epargneDispo);
      const parMoisE = Math.max(20, Math.round(Math.max(libre * 0.5, revenus * 0.05, net < 0 ? gains * 0.5 : 0) / 10) * 10);
      if (manque > 0) A(moisSecurite < 1 ? 'Te faire un matelas d’un mois' : 'Monter ton matelas à 3 mois', `Objectif : ${e(cible)} sur un livret. En mettant ${e(parMoisE)} de côté chaque mois, tu y es dans ${Math.ceil(manque / parMoisE)} mois.`, 0);
    }
    if (net >= 0 && taux != null && taux < 0.15 && revenus > 0) {
      const v = Math.max(20, Math.round((revenus * 0.1) / 10) * 10);
      A('Épargner dès la paie', `Programme un virement automatique de ${e(v)} vers ton livret le jour de ta paie. Ce qui part en premier ne se dépense pas.`, 0);
    }
    if (moisSecurite != null && moisSecurite >= 3 && soldeCourant > depenses * 1.5 && depenses > 0) A('Ne laisse pas dormir ton compte courant', `${e(soldeCourant - depenses)} de plus que ce dont tu as besoin pour le mois. Sur un livret, cet argent rapporterait des intérêts.`, 0);

    return {
      paie: avecBanque ? analysePaie(operations, comptes, auj) : null,
      avecBanque, assez: true, mois, revenus: arr(revenus), depenses: arr(depenses), net: arr(net), taux,
      categories, besoins: arr(besoins), envies: arr(envies), repartition, credits: arr(credits), endettement,
      epargneDispo: arr(epargneDispo), placements: arr(placements), moisSecurite, joursRouge, plusBas, frais,
      abonnements, totalAbos: arr(totalAbos), totalAbosAn, hausses, note, niveau, difficulte, points: pts, va, vaPas, plan, gains: arr(gains),
      nbMois: avecBanque ? recents.length : 0,
      aClasser: L.filter((o) => !o.interne && aClasser(o, regles)).length,
    };
  }

  /* La paie : d'où elle vient, quand elle tombe, combien en moyenne, les primes, la prochaine.
     C'est le revenu qui revient le plus de mois (400 € ou plus), à montant voisin. */
  function analysePaie(operations, comptes, maintenant) {
    const auj = maintenant ? new Date(maintenant) : new Date(); auj.setHours(12, 0, 0, 0);
    const L = marquerInternes(operations || [], comptes).filter((o) => o.montant >= 400 && !o.interne && o.statut !== 'PDNG' && o.d <= auj);
    const G = new Map();
    for (const o of L) { const k = cle(o.contrepartie || o.libelle) || cle(o.libelle) || 'REVENU'; if (!G.has(k)) G.set(k, []); G.get(k).push(o); }
    let best = null;
    for (const [k, ops] of G) {
      const mois = new Set(ops.map((o) => ym(o.d)));
      if (mois.size < 2) continue;
      const score = mois.size * 1e7 + mediane(ops.map((o) => o.montant));
      if (!best || score > best.score) best = { k, ops, score };
    }
    if (!best) return null;
    const parMoisP = new Map();
    for (const o of best.ops) parMoisP.set(ym(o.d), (parMoisP.get(ym(o.d)) || 0) + o.montant);
    const mois = [...parMoisP.entries()].sort((a, b) => a[0] - b[0]).map(([i, v]) => ({ mois: ecrireYM(i), montant: Math.round(v) }));
    const recents = mois.filter((m) => lireYM(m.mois) >= ym(auj) - 12);
    const med = mediane(recents.map((m) => m.montant));
    const primes = recents.filter((m) => m.montant > med * 1.15 && m.montant - med >= 100).map((m) => ({ ...m, enPlus: Math.round(m.montant - med) }));
    const tries = best.ops.slice().sort((a, b) => a.d - b.d), derniere = tries[tries.length - 1].d;
    const jourHabituel = Math.round(mediane(tries.slice(-6).map((o) => o.d.getDate())));
    const t3 = recents.slice(-3), t6 = recents.slice(-6, -3);
    return {
      nom: joli(best.k), jourHabituel, derniere: iso(derniere), prochaine: iso(decaleMois(derniere, 1, jourHabituel)),
      moyenne: Math.round(moy(recents.map((m) => m.montant))), habituelle: Math.round(med),
      mois: recents, primes, nbMois: mois.length,
      evolution: t3.length === 3 && t6.length === 3 ? Math.round(((moy(t3.map((m) => m.montant)) - moy(t6.map((m) => m.montant))) / moy(t6.map((m) => m.montant))) * 1000) / 10 : null,
    };
  }

  /* Opérations à afficher : toutes, du plus récent au plus ancien, chacune avec sa catégorie. */
  function listeOperations(operations, comptes, regles) {
    return marquerInternes(operations || [], comptes, regles).sort((a, b) => b.d - a.d)
      .map((o) => ({ id: o.id, date: iso(o.d), montant: o.montant, libelle: o.libelle, contrepartie: o.contrepartie || null, mcc: o.mcc || null, enCours: o.statut === 'PDNG', compte_id: o.compte_id, interne: o.interne, categorie: o.interne ? 'interne' : categorie(o, regles), cle: cleRegle(o), hesite: !o.interne && aClasser(o, regles) }));
  }

  const api = { H, n, ym, lireYM, ecrireYM, mensualite, restantDu, fluxDuMois, parMois, effets, chiffres, simuler, analyser, cle, categorie, genre, suiviMois, comptesVue, alertes, NOM_CAT, GROUPE, CHOIX_DEPENSE, CHOIX_RENTREE, cleRegle, aClasser, bilan, listeOperations, analysePaie, parMcc, marquerInternes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Moteur = api;
})(typeof self !== 'undefined' ? self : this);
