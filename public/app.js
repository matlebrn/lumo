/* Lumo · l'appli. Quatre onglets : Prévision, Projets, Budget, Lumi.
   Les calculs sont dans moteur.js ; ici, on affiche, on enregistre et on parle à la banque. */
(() => {
  'use strict';
  const SB_URL = 'https://yyxudhwlduznoteuddmp.supabase.co';
  const SB_CLE = 'sb_publishable_uUzzvK1hb5_AQucx23BC2g_6jyLnP_Q';
  const M = window.Moteur;
  const sb = window.supabase.createClient(SB_URL, SB_CLE);
  const $ = (s, r = document) => r.querySelector(s);

  /* ---------- état ---------- */
  const S = {
    user: null, exemple: false, vue: 'prevision', horizon: 36,
    d: null, sim: null, analyse: null,
    porte: { mode: 'entree', email: '', mdp: '', erreur: '', attente: false },
    depart: { mode: 'choix', erreur: '' },
    feuille: null, fil: [], lumiAttente: false, banques: null,
  };

  /* ---------- écriture des nombres et des dates ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NB = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const eur = (v, signe) => { const x = Math.round(+v || 0); return (signe && x > 0 ? '+' : '') + NB.format(x).replace('-', '−') + ' €'; };
  const pct = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',') + ' %';
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const moisLong = (ym) => ym ? `${MOIS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}` : '';
  const duree = (k) => {
    if (k <= 1) return '1 mois';
    const a = Math.floor(k / 12), m = k % 12;
    if (!a) return `${k} mois`;
    return `${a} an${a > 1 ? 's' : ''}${m ? ` et ${m} mois` : ''}`;
  };
  const dans = (k) => (k <= 1 ? 'le mois prochain' : `dans ${duree(k)}`);
  const ilYA = (iso) => {
    if (!iso) return 'jamais';
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 2) return 'à l’instant'; if (m < 60) return `il y a ${m} min`;
    if (m < 1440) return `il y a ${Math.round(m / 60)} h`; return `il y a ${Math.round(m / 1440)} j`;
  };
  const nombre = (v) => (v == null || v === '' ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v));
  const id = () => crypto.randomUUID();

  /* ---------- icônes ---------- */
  const trait = (d, plus = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${plus}>${d}</svg>`;
  const I = {
    prevision: trait('<path d="M3 17l5-5 4 3 8-9"/><path d="M15 6h5v5"/>'),
    projets: trait('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>'),
    budget: trait('<path d="M4 7h16M4 12h16M4 17h10"/>'),
    lumi: trait('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'),
    reglages: trait('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 00-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 00-2.2 1.3l-2.3-.9-2 3.4 2 1.5a7 7 0 000 2.6l-2 1.5 2 3.4 2.3-.9a7 7 0 002.2 1.3L10 21h4l.4-2.4a7 7 0 002.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z"/>'),
    plus: trait('<path d="M12 5v14M5 12h14"/>'),
    fermer: trait('<path d="M6 6l12 12M18 6L6 18"/>'),
    envoyer: trait('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    alerte: trait('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>'),
    achat: trait('<path d="M5 8h14l-1.2 11H6.2z"/><path d="M9 8V6a3 3 0 016 0v2"/>'),
    investissement: trait('<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>'),
    changement: trait('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'),
    credit: trait('<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10.5h18M7 15h4"/>'),
  };
  const TYPES = {
    achat: { nom: 'Un achat', quoi: 'Voiture, voyage, travaux : quand tu peux te l’offrir', ex: 'Voiture, voyage, travaux…' },
    investissement: { nom: 'Un investissement', quoi: 'Locatif, placement : est-ce rentable, et quand', ex: 'Studio locatif, garage, placement…' },
    changement: { nom: 'Un changement de vie', quoi: 'Salaire, loyer, enfant : ce que ça change sur 10 ans', ex: 'Augmentation, nouveau loyer…' },
    credit: { nom: 'Un crédit', quoi: 'Mensualité, coût total, ce qu’il te reste pour vivre', ex: 'Prêt travaux, crédit auto…' },
  };

  /* ---------- données : sur le serveur, ou en mémoire pour l'exemple ---------- */
  function exemple() {
    return {
      profil: { prenom: '', coussin: 2000, courant_manuel: 780, ignores: [], pret: true },
      comptes: [
        { id: id(), nom: 'Compte courant', type: 'courant', solde: 2350, source: 'manuel', inclus: true },
        { id: id(), nom: 'Livret A', type: 'epargne', solde: 6400, source: 'manuel', inclus: true },
      ],
      flux: [
        { id: id(), nom: 'Salaire', sens: 'revenu', montant: 2150, frequence: 'mois', evolution: 1.5, actif: true },
        { id: id(), nom: 'Loyer', sens: 'depense', montant: 640, frequence: 'mois', evolution: 0, actif: true },
        { id: id(), nom: 'Énergie et internet', sens: 'depense', montant: 118, frequence: 'mois', evolution: 0, actif: true },
        { id: id(), nom: 'Assurances', sens: 'depense', montant: 96, frequence: 'mois', evolution: 0, actif: true },
        { id: id(), nom: 'Abonnements', sens: 'depense', montant: 54, frequence: 'mois', evolution: 0, actif: true },
        { id: id(), nom: 'Impôts locaux', sens: 'depense', montant: 420, frequence: 'an', mois: 10, evolution: 0, actif: true },
      ],
      projets: [
        { id: id(), type: 'achat', nom: 'Voiture d’occasion', actif: true, ordre: 0, params: { montant: 9000, mode: 'tot', financement: 'comptant' } },
        { id: id(), type: 'investissement', nom: 'Studio locatif', actif: true, ordre: 1, params: { prix: 78000, frais: 7500, mode: 'tot', financement: 'credit', apport: 8000, taux: 3.6, dureeAns: 20, revenu: 510, charges: 120, valorisation: 1 } },
      ],
      operations: [], sessions: [],
    };
  }
  async function charger() {
    if (S.exemple) { S.d = S.d || exemple(); return calculer(); }
    const depuis = new Date(Date.now() - 215 * 864e5).toISOString().slice(0, 10);
    const [p, c, f, pr, se] = await Promise.all([
      sb.from('profils').select('*').maybeSingle(),
      sb.from('comptes').select('*').order('cree'),
      sb.from('flux').select('*').order('cree'),
      sb.from('projets').select('*').order('ordre').order('cree'),
      sb.from('eb_sessions').select('session_id,bank,status,last_sync,valid_until,error').neq('status', 'REVOKED'),
    ]);
    const err = [p, c, f, pr].find((r) => r.error);
    if (err) throw new Error(err.error.message);
    const operations = [];
    for (let page = 0; page < 5; page++) { // 1000 lignes par appel
      const r = await sb.from('operations').select('date,montant,libelle').gte('date', depuis).order('date', { ascending: false }).range(page * 1000, page * 1000 + 999);
      if (r.error || !r.data.length) break;
      operations.push(...r.data);
      if (r.data.length < 1000) break;
    }
    S.d = {
      profil: p.data || { prenom: '', coussin: 0, courant_manuel: null, ignores: [], pret: false },
      comptes: c.data, flux: f.data, projets: pr.data, operations, sessions: se.data || [],
    };
    calculer();
  }
  const pourBase = (table, r) => { // nombres propres avant d'écrire
    const o = { ...r };
    if (table === 'flux') { o.montant = Math.abs(M.n(o.montant)); o.evolution = M.n(o.evolution); o.mois = o.frequence === 'mois' ? null : +o.mois || 1; o.debut = o.debut || null; o.fin = o.fin || null; }
    if (table === 'comptes') o.solde = M.n(o.solde);
    return o;
  };
  async function ecrire(table, ligne, nouveau) {
    const o = pourBase(table, ligne), L = S.d[table], i = L.findIndex((x) => x.id === o.id);
    if (!S.exemple) {
      const r = nouveau ? await sb.from(table).insert(o) : await sb.from(table).update(o).eq('id', o.id);
      if (r.error) { dire('Enregistrement impossible. Réessaie.'); throw new Error(r.error.message); }
    }
    if (i >= 0) L[i] = o; else L.push(o);
    calculer();
  }
  async function effacer(table, ident) {
    if (!S.exemple) { const r = await sb.from(table).delete().eq('id', ident); if (r.error) { dire('Suppression impossible. Réessaie.'); throw new Error(r.error.message); } }
    S.d[table] = S.d[table].filter((x) => x.id !== ident);
    calculer();
  }
  async function ecrireProfil(patch) {
    Object.assign(S.d.profil, patch);
    if (!S.exemple) {
      const { prenom, coussin, courant_manuel, ignores, pret } = S.d.profil;
      const r = await sb.from('profils').upsert({ user_id: S.user.id, prenom, coussin: M.n(coussin), courant_manuel, ignores, pret });
      if (r.error) { dire('Enregistrement impossible. Réessaie.'); throw new Error(r.error.message); }
    }
    calculer();
  }
  async function serveur(fonction, corps) { // appelle une fonction du serveur Lumo avec le compte connecté
    const { data } = await sb.auth.getSession();
    const r = await fetch(`${SB_URL}/functions/v1/${fonction}`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: SB_CLE, authorization: `Bearer ${data.session?.access_token || ''}` }, body: JSON.stringify(corps || {}) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, statut: r.status, ...j };
  }

  /* ---------- calcul ---------- */
  function etat(projets) {
    const d = S.d;
    S.analyse = M.analyser(d.operations, d.flux);
    return {
      solde: d.comptes.filter((c) => c.inclus).reduce((s, c) => s + +c.solde, 0),
      coussin: d.profil.coussin,
      courant: d.profil.courant_manuel ?? S.analyse.courant ?? 0,
      flux: d.flux, projets: projets || d.projets,
    };
  }
  function calculer() { S.sim = M.simuler(etat()); }
  const suggestions = () => S.analyse.suggestions.filter((s) => !(S.d.profil.ignores || []).includes(s.cle));

  /* ---------- ce que Lumo dit d'un projet ---------- */
  function endettement(p, c) { // mensualités des projets ÷ revenus (une banque compte environ 70 % des loyers)
    const revenus = S.sim.mensuel.revenus + (p.type === 'investissement' ? 0.7 * M.n(p.params.revenu) : 0);
    if (!revenus || !c.mensualite) return null;
    let m = c.mensualite;
    for (const q of S.d.projets) if (q.id !== p.id && q.actif !== false && S.sim.projets[q.id]) m += S.sim.projets[q.id].chiffres.mensualite || 0;
    return (m / revenus) * 100;
  }
  function avis(p, r) {
    const x = p.params || {}, c = r.chiffres, faits = [];
    const garde = S.sim.coussin > 0 ? 'garder ton coussin' : 'ne pas passer dans le rouge';
    let ton = 'bon', titre = '', court = 'Faisable';
    const loin = r.k0 != null && r.k0 > M.H, passe = r.k0 != null && r.k0 < 1;
    const quand = r.k0 != null && !loin ? moisLong(r.mois || S.sim.mois(r.k0)) : '';
    const tenir = () => { if (isFinite(r.bas)) faits.push(`Au plus bas, il te restera <b>${eur(r.bas)}</b> sur tes comptes.`); };
    const juste = () => {
      ton = 'alerte'; court = 'Trop juste';
      faits.push(`Il te manque <b>${eur(r.manque)}</b> pour ${garde}.`);
      if (r.tot && r.tot !== r.k0) faits.push(`Sans risque à partir de <b>${moisLong(S.sim.mois(r.tot))}</b>.`);
      if (r.k0 > 1) faits.push(`Ou mets <b>${eur(r.effort)} de plus par mois</b> de côté d’ici là.`);
    };
    const dette = () => {
      const t = endettement(p, c); if (t == null) return;
      faits.push(`Les crédits de tes projets pèsent <b>${pct(t)}</b> de tes revenus. ${t > 35 ? 'Au-delà de 35 %, une banque refuse en général.' : 'Les banques acceptent en général jusqu’à 35 %.'}`);
      if (t > 35 && ton === 'bon') { ton = 'alerte'; court = 'Crédit trop lourd'; }
    };
    const credit = () => { if (c.mensualite) { faits.push(`Crédit : <b>${eur(c.mensualite)} par mois</b> pendant ${duree(c.duree)}${c.coutCredit > 0 ? `, dont ${eur(c.coutCredit)} d’intérêts` : ''}.`); dette(); } };

    if (p.type === 'achat' || p.type === 'investissement') {
      const inv = p.type === 'investissement';
      if (inv) {
        faits.push(c.cashflow >= 0 ? `Te rapporte <b>${eur(c.cashflow)} par mois</b>${c.mensualite ? ', crédit payé' : ''}.` : `Te coûte <b>${eur(-c.cashflow)} par mois</b>, loyers déduits.`);
        if (c.rendementBrut) faits.push(`Rendement : <b>${pct(c.rendementBrut)}</b> brut, ${pct(c.rendementNet)} une fois les charges payées.`);
        faits.push(c.rentable ? `Gain estimé au bout de 10 ans : <b>${eur(c.gain10, true)}</b>${c.pointMort ? `, dans le vert après ${duree(c.pointMort)}` : ''}.` : `Au bout de 10 ans, tu serais à <b>${eur(c.gain10, true)}</b>${c.pointMort ? ` ; dans le vert après ${duree(c.pointMort)}` : ''}.`);
      }
      const rent = inv ? (c.rentable ? 'Rentable' : 'Pas rentable sur 10 ans') : '';
      if (r.k0 == null) { ton = 'rouge'; court = 'Hors de portée'; titre = inv ? `${rent}, mais hors de portée avant 10 ans` : 'Hors de portée avant 10 ans'; faits.push(`Avec tes chiffres actuels, tu ne peux pas le financer et ${garde}.`); }
      else if (loin) { ton = 'alerte'; court = 'Trop loin'; titre = 'Au-delà de 10 ans'; faits.push('Lumo ne prévoit pas plus loin que 10 ans.'); }
      else if (passe) { court = 'En cours'; titre = inv ? `${rent}, déjà lancé` : 'Déjà lancé'; }
      else if (r.ok) { titre = r.libre ? `${inv ? rent + ', possible' : 'Possible'} dès ${quand}` : `${inv ? rent + ', faisable' : 'Faisable'} en ${quand}`; if (r.libre) faits.unshift(`C’est ${dans(r.k0)}.`); tenir(); }
      else { titre = `Trop juste en ${quand}`; juste(); }
      if (inv && !c.rentable && ton === 'bon') { ton = 'alerte'; court = 'Pas rentable'; }
      else if (inv && ton === 'bon') court = 'Rentable';
      credit();
      if (inv) faits.push('<span class="doux">Estimation avant impôts.</span>');
    } else if (p.type === 'changement') {
      titre = c.parMois ? `${eur(c.parMois, true)} par mois` : M.n(x.depart) ? `${eur(M.n(x.depart))} au départ` : 'Rien ne change pour l’instant';
      court = c.parMois >= 0 ? 'Favorable' : 'À surveiller';
      if (loin) { ton = 'alerte'; court = 'Trop loin'; faits.push('Lumo ne prévoit pas plus loin que 10 ans.'); }
      else {
        if (quand) faits.push(`${passe ? 'Depuis' : 'À partir de'} ${quand}${x.fin ? `, jusqu’en ${moisLong(x.fin)}` : ''}.`);
        if (r.impact != null) faits.push(`Sur 10 ans : <b>${eur(r.impact, true)}</b> sur tes comptes.`);
        if (!r.ok) { ton = 'alerte'; court = 'Trop juste'; faits.push(`Tu passerais sous la limite : il manquerait <b>${eur(r.manque)}</b> pour ${garde}.`); }
        else if (c.parMois < 0) ton = 'neutre';
      }
    } else if (p.type === 'credit') {
      titre = `${eur(c.mensualite)} par mois`; court = 'Supportable';
      const reste = S.sim.mensuel.reste - c.mensualite;
      if (!loin && r.k0 != null && c.duree) faits.push(`${passe ? 'En cours' : `À partir de ${quand}`}, jusqu’en ${moisLong(S.sim.mois(r.k0 + c.duree - 1))}.`);
      if (c.coutCredit > 0) faits.push(`Il te coûte <b>${eur(c.coutCredit)}</b> d’intérêts en tout.`);
      faits.push(`Pendant ce temps, il te reste <b>${eur(reste)} par mois</b> une fois tout payé.`);
      if (reste < 0) { ton = 'rouge'; court = 'Trop lourd'; }
      else if (!r.ok) { ton = 'alerte'; court = 'Trop juste'; faits.push(`Tu passerais sous la limite : il manquerait <b>${eur(r.manque)}</b> pour ${garde}.`); }
      dette();
    }
    return { ton, titre, court, faits };
  }
  const blocAvis = (a) => `<div class="verdict">${a.titre}</div><div class="faits">${a.faits.map((f) => `<div>${f}</div>`).join('')}</div>`;

  /* ---------- courbe ---------- */
  function beauPas(v) { const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  const kEur = (v) => (Math.abs(v) >= 1000 ? `${NB.format(Math.round(v / 100) / 10).replace('-', '−')} k€` : `${NB.format(v).replace('-', '−')} €`);
  function courbe(sim, h) {
    const W = 340, HT = 184, g = 2, dr = 6, haut = 14, bas = 24;
    const A = sim.avec.slice(0, h + 1), B = sim.sans.slice(0, h + 1);
    const ecart = A.some((v, i) => Math.abs(v - B[i]) > 1);
    let lo = Math.min(0, ...A, ...(ecart ? B : [])), hi = Math.max(...A, ...(ecart ? B : []), sim.coussin, 100);
    const marge = (hi - lo) * 0.1; hi += marge; if (lo < 0) lo -= marge;
    const X = (k) => g + ((W - g - dr) * k) / h, Y = (v) => haut + (HT - haut - bas) * (1 - (v - lo) / (hi - lo));
    const chemin = (T) => T.map((v, k) => `${k ? 'L' : 'M'}${X(k).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
    const pas = beauPas((hi - lo) / 3);
    let grille = '';
    for (let v = Math.ceil(lo / pas) * pas; v <= hi; v += pas) {
      grille += `<line x1="${g}" x2="${W - dr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${v === 0 && lo < 0 ? 'rgba(231,147,130,.55)' : 'rgba(255,255,255,.06)'}"/><text x="${g + 2}" y="${(Y(v) - 4).toFixed(1)}">${kEur(v)}</text>`;
    }
    let axe = '';
    const chaque = h <= 12 ? 3 : h <= 60 ? 12 : 24;
    for (let k = 1; k <= h; k++) {
      const abs = sim.t0 + k;
      if (h <= 12 ? k % chaque === 0 : abs % 12 === 0 && (Math.floor(abs / 12) - Math.floor(sim.t0 / 12)) % (chaque / 12) === 0) {
        axe += `<text x="${X(k).toFixed(1)}" y="${HT - 6}" text-anchor="${k === h ? 'end' : 'middle'}">${h <= 12 ? COURT[abs % 12] : Math.floor(abs / 12)}</text>`;
      }
    }
    const reperes = S.d.projets.filter((p) => p.actif !== false).map((p) => sim.projets[p.id]).filter((r) => r && r.k0 >= 1 && r.k0 <= h)
      .map((r) => `<circle cx="${X(r.k0).toFixed(1)}" cy="${Y(A[r.k0]).toFixed(1)}" r="4.5" fill="#09090A" stroke="#F6E3B0" stroke-width="2"/>`).join('');
    const coussin = sim.coussin > 0 ? `<line x1="${g}" x2="${W - dr}" y1="${Y(sim.coussin).toFixed(1)}" y2="${Y(sim.coussin).toFixed(1)}" stroke="rgba(217,181,108,.4)" stroke-dasharray="2 4"/>` : '';
    return `<div class="courbe" id="courbe" data-h="${h}" data-g="${g}" data-l="${W - g - dr}" data-w="${W}">
      <svg viewBox="0 0 ${W} ${HT}" role="img" aria-label="Évolution prévue de ton argent sur ${duree(h)}">
        <defs><linearGradient id="voile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9B56C" stop-opacity=".28"/><stop offset="1" stop-color="#D9B56C" stop-opacity="0"/></linearGradient></defs>
        ${grille}${coussin}
        <path d="${chemin(A)}L${X(h).toFixed(1)} ${Y(lo).toFixed(1)}L${X(0)} ${Y(lo).toFixed(1)}Z" fill="url(#voile)"/>
        ${ecart ? `<path d="${chemin(B)}" fill="none" stroke="#6F6B63" stroke-width="1.5" stroke-dasharray="4 4"/>` : ''}
        <path d="${chemin(A)}" fill="none" stroke="#D9B56C" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
        ${reperes}${axe}
        <g id="curseur" hidden><line y1="${haut - 4}" y2="${HT - bas}" stroke="rgba(246,227,176,.5)"/><circle r="4.5" fill="#F6E3B0"/></g>
      </svg>
    </div>
    <div class="lecture" id="lecture"></div>
    <div class="legende">${ecart ? '<span><i></i>Avec tes projets</span><span><i class="tirets"></i>Sans</span>' : ''}<button class="lien" data-a="detail" style="margin-left:auto">Voir mois par mois</button></div>`;
  }
  function lecture(k) {
    const el = $('#lecture'); if (!el) return;
    const sim = S.sim, h = S.horizon, ecart = Math.abs(sim.avec[k] - sim.sans[k]) > 1;
    el.innerHTML = k == null
      ? `<span>Aujourd’hui <b>${eur(sim.solde)}</b></span><span>Glisse ton doigt sur la courbe</span>`
      : `<span>${k === 0 ? 'Aujourd’hui' : moisLong(sim.mois(k))} <b>${eur(sim.avec[k])}</b></span>${ecart ? `<span>sans projets ${eur(sim.sans[k])}</span>` : `<span>${k === h ? '' : dans(k)}</span>`}`;
  }
  function suivreCourbe(e) {
    const c = $('#courbe'); if (!c) return;
    const b = c.getBoundingClientRect(), W = +c.dataset.w, h = +c.dataset.h;
    const x = ((e.clientX - b.left) / b.width) * W;
    const k = Math.max(0, Math.min(h, Math.round(((x - +c.dataset.g) / +c.dataset.l) * h)));
    const cur = $('#curseur'), px = +c.dataset.g + (+c.dataset.l * k) / h;
    const chemins = c.querySelectorAll('path'); const ligne = chemins[chemins.length - 1];
    const pt = ligne.getPointAtLength ? pointSurLigne(ligne, k, h) : null;
    cur.removeAttribute('hidden');
    cur.querySelector('line').setAttribute('x1', px); cur.querySelector('line').setAttribute('x2', px);
    cur.querySelector('circle').setAttribute('cx', px); if (pt != null) cur.querySelector('circle').setAttribute('cy', pt);
    lecture(k);
  }
  function pointSurLigne(ligne, k) { // ordonnée du point k dans le tracé « M x y L x y … »
    const nums = ligne.getAttribute('d').match(/-?\d+(\.\d+)?/g); return +nums[k * 2 + 1];
  }

  /* ---------- ce qui arrive : les dates qui comptent sur la période affichée ---------- */
  function evenements(h) {
    const sim = S.sim, E = [], dedans = (k) => k >= 1 && k <= h;
    for (const p of S.d.projets.filter((p) => p.actif !== false)) {
      const r = sim.projets[p.id]; if (!r || r.k0 == null) continue;
      const c = r.chiffres;
      if (dedans(r.k0)) E.push({ k: r.k0, t: esc(p.nom), d: p.type === 'changement' ? `${eur(c.parMois, true)} par mois` : p.type === 'credit' ? `${eur(-c.mensualite, true)} par mois` : eur(r.d[r.k0], true) });
      const fin = c.mensualite && c.duree ? r.k0 + c.duree + (p.type === 'credit' ? 0 : 1) : null;
      if (fin && dedans(fin)) E.push({ k: fin, t: `Crédit fini · ${esc(p.nom)}`, d: `${eur(c.mensualite, true)} par mois` });
    }
    for (const f of S.d.flux) {
      const fin = M.lireYM(f.fin), deb = M.lireYM(f.debut), v = M.parMois(f) * (f.sens === 'revenu' ? 1 : -1);
      if (fin != null && dedans(fin + 1 - sim.t0)) E.push({ k: fin + 1 - sim.t0, t: `Fin · ${esc(f.nom)}`, d: `${eur(-v, true)} par mois` });
      if (deb != null && dedans(deb - sim.t0)) E.push({ k: deb - sim.t0, t: `Début · ${esc(f.nom)}`, d: `${eur(v, true)} par mois` });
      if (f.frequence === 'an') for (let k = 1; k <= Math.min(h, 12); k++) { const x = M.fluxDuMois(f, sim.t0 + k, sim.t0); if (x) E.push({ k, t: esc(f.nom), d: eur(x, true) }); }
    }
    if (sim.decouvert != null && dedans(sim.decouvert)) E.push({ k: sim.decouvert, t: 'Comptes dans le rouge', d: eur(sim.avec[sim.decouvert]), ton: 'moins' });
    else if (sim.sousCoussin != null && dedans(sim.sousCoussin)) E.push({ k: sim.sousCoussin, t: 'Coussin entamé', d: eur(sim.avec[sim.sousCoussin]), ton: 'moins' });
    return E.sort((a, b) => a.k - b.k);
  }
  function feuilleDetail() {
    const sim = S.sim, h = S.horizon;
    let lignes = '';
    for (let k = 1; k <= h; k++) {
      const abs = sim.t0 + k, bas = sim.avec[k] < 0 ? 'moins' : sim.coussin && sim.avec[k] < sim.coussin ? 'or' : '';
      lignes += `<div class="mois-ligne"><span>${COURT[abs % 12]} ${Math.floor(abs / 12)}</span><span class="plus">${eur(sim.entrees[k], true)}</span><span class="moins">${eur(-sim.sorties[k])}</span><b class="${bas}">${eur(sim.avec[k])}</b></div>`;
    }
    return coque('Mois par mois', `<div class="mois-ligne tete"><span>Mois</span><span>Rentrées</span><span>Sorties</span><span>Solde</span></div>${lignes}<p class="note">Solde à la fin de chaque mois, projets comptés.</p>`);
  }

  /* ---------- écrans ---------- */
  const bandeauExemple = () => (S.exemple ? `<div class="bandeau"><span>Exemple : rien n’est enregistré.</span><button data-a="creer-compte">Créer mon compte</button></div>` : '');
  const entete = (titre, sous, bouton) => `<div class="entete"><div><h1>${titre}</h1>${sous ? `<div class="sous">${sous}</div>` : ''}</div>${bouton || ''}</div>`;
  const etiquette = (a) => `<span class="etiquette ${a.ton}">${a.court}</span>`;

  function vuePrevision() {
    const sim = S.sim, h = S.horizon, d = S.d, m = sim.mensuel;
    const fin = sim.avec[h], gain = fin - sim.solde;
    let alerte = '';
    if (m.reste < 0) alerte = `<div class="avis rouge">${I.alerte}<p>Chaque mois, tu dépenses <b>${eur(-m.reste)}</b> de plus que tu ne gagnes.</p></div>`;
    if (sim.decouvert != null) alerte += `<div class="avis rouge">${I.alerte}<p>Tes comptes passent <b>dans le rouge en ${moisLong(sim.mois(sim.decouvert))}</b>. Décale un projet ou revois ton budget.</p></div>`;
    else if (sim.sousCoussin != null) alerte += `<div class="avis alerte">${I.alerte}<p>En <b>${moisLong(sim.mois(sim.sousCoussin))}</b>, tu passes sous ton coussin de ${eur(sim.coussin)}.</p></div>`;
    const sug = suggestions();
    const max = Math.max(m.revenus, m.fixes + m.courant, 1);
    const barre = (nom, v, cls) => `<div class="barre"><span>${nom}</span><span>${eur(v)}</span><div class="rail"><i class="${cls}" style="width:${Math.min(100, (v / max) * 100).toFixed(1)}%"></i></div></div>`;
    const projets = d.projets.filter((p) => p.actif !== false), ev = evenements(h);
    return `<div class="ecran">
      ${bandeauExemple()}
      ${entete(d.profil.prenom ? `Bonjour ${esc(d.profil.prenom)}` : 'Ta prévision', '', `<button class="rond" data-a="reglages" aria-label="Réglages">${I.reglages}</button>`)}
      <div class="carte hero">
        <div class="phrase">Dans ${duree(h)}, tu auras environ</div>
        <div class="gros">${eur(fin)}</div>
        <div class="ecart ${gain >= 0 ? 'plus' : 'moins'}">${eur(gain, true)} par rapport à aujourd’hui</div>
        <div class="puces">${[[12, '1 an'], [36, '3 ans'], [60, '5 ans'], [120, '10 ans']].map(([k, t]) => `<button data-a="horizon" data-k="${k}" class="${k === h ? 'actif' : ''}">${t}</button>`).join('')}</div>
        ${courbe(sim, h)}
      </div>
      ${alerte}
      ${sug.length ? `<div class="avis bon">${I.lumi}<p>Lumo a repéré <b>${sug.length} revenu${sug.length > 1 ? 's' : ''} ou paiement${sug.length > 1 ? 's' : ''} régulier${sug.length > 1 ? 's' : ''}</b> dans ta banque. <button class="lien" data-a="onglet" data-v="budget">Vérifier</button></p></div>` : ''}
      <div class="titre"><span>Chaque mois</span><button data-a="onglet" data-v="budget">Modifier</button></div>
      <div class="carte">
        <div class="barres">${barre('Revenus', m.revenus, '')}${barre('Dépenses fixes', m.fixes, 'gris')}${barre('Dépenses courantes', m.courant, 'gris')}</div>
        <div class="reste"><span>Il te reste</span><b class="${m.reste >= 0 ? 'plus' : 'moins'}">${eur(m.reste)}</b></div>
      </div>
      ${ev.length ? `<div class="titre"><span>Ce qui arrive</span></div><div class="carte serree">${ev.slice(0, 8).map((e) => `<div class="ligne"><div class="corps"><div class="nom">${e.t}</div><div class="detail">${moisLong(sim.mois(e.k))}</div></div><div class="somme ${e.ton || (e.d.startsWith('+') ? 'plus' : '')}">${e.d}</div></div>`).join('')}</div>${ev.length > 8 ? `<p class="note">Et ${ev.length - 8} autre${ev.length > 9 ? 's' : ''} date${ev.length > 9 ? 's' : ''} plus loin.</p>` : ''}` : ''}
      <div class="titre"><span>Tes projets</span><button data-a="nouveau-projet">Ajouter</button></div>
      ${projets.length ? `<div class="carte serree">${projets.map((p) => { const r = sim.projets[p.id], a = avis(p, r); return `<button class="ligne" data-a="projet" data-id="${p.id}"><div class="corps"><div class="nom">${esc(p.nom)}</div><div class="detail">${a.titre}</div></div>${etiquette(a)}</button>`; }).join('')}</div>`
        : `<div class="carte"><p class="vide">Une voiture, un appartement, un crédit ? Ajoute un projet : Lumo te dit quand c’est possible et ce que ça change.</p><button class="bouton" data-a="nouveau-projet">Simuler un projet</button></div>`}
      <p class="note">Prévision en euros d’aujourd’hui, avant impôts, d’après tes chiffres actuels. C’est une estimation, pas une promesse.</p>
    </div>`;
  }

  function vueProjets() {
    const sim = S.sim, L = S.d.projets;
    return `<div class="ecran">
      ${bandeauExemple()}
      ${entete('Projets', L.length ? 'Touche un projet pour changer ses chiffres' : '', `<button class="rond" data-a="nouveau-projet" aria-label="Nouveau projet">${I.plus}</button>`)}
      ${L.length ? L.map((p) => { const a = avis(p, sim.projets[p.id]); return `<button class="carte projet ${p.actif === false ? 'eteint' : ''}" data-a="projet" data-id="${p.id}">
        <div class="haut"><div><h3>${esc(p.nom)}</h3><div class="genre">${TYPES[p.type].nom}${p.actif === false ? ' · hors prévision' : ''}</div></div>${etiquette(a)}</div>
        ${blocAvis(a)}</button>`; }).join('')
        : `<div class="carte"><p class="vide">Aucun projet pour l’instant. Choisis ce que tu veux simuler :</p>${listeTypes()}</div>`}
      ${L.length ? `<button class="bouton second" data-a="nouveau-projet">Nouveau projet</button><p class="note">L’ordre compte : Lumo finance d’abord le premier projet de la liste, puis le suivant avec ce qu’il reste.</p>` : ''}
    </div>`;
  }
  const listeTypes = () => `<div class="types">${Object.entries(TYPES).map(([t, o]) => `<button data-a="type-projet" data-t="${t}"><div class="ico">${I[t]}</div><div><b>${o.nom}</b><span>${o.quoi}</span></div></button>`).join('')}</div>`;

  const FREQ = { mois: 'par mois', trimestre: 'tous les 3 mois', an: 'par an' };
  function vueBudget() {
    const d = S.d, m = S.sim.mensuel, sug = suggestions();
    const ligne = (f) => `<button class="ligne" data-a="flux" data-id="${f.id}"><div class="corps"><div class="nom">${esc(f.nom)}</div><div class="detail">${FREQ[f.frequence]}${f.frequence !== 'mois' && f.mois ? ` · ${MOIS[f.mois - 1]}` : ''}${f.fin ? ` · jusqu’en ${moisLong(f.fin)}` : ''}${+f.evolution ? ` · ${+f.evolution > 0 ? '+' : ''}${pct(+f.evolution)} par an` : ''}</div></div><div class="somme">${eur(f.montant)}</div></button>`;
    const bloc = (sens, titre, vide) => { const L = d.flux.filter((f) => f.sens === sens); return `<div class="titre"><span>${titre}</span><button data-a="nouveau-flux" data-sens="${sens}">Ajouter</button></div><div class="carte serree">${L.length ? L.map(ligne).join('') : `<p class="vide">${vide}</p>`}</div>`; };
    const auto = d.profil.courant_manuel == null;
    return `<div class="ecran">
      ${bandeauExemple()}
      ${entete('Budget', `Il te reste <b class="${m.reste >= 0 ? 'plus' : 'moins'}">${eur(m.reste)}</b> par mois`)}
      ${sug.length ? `<div class="titre"><span>Repérés dans ta banque</span><button data-a="tout-ajouter">Tout ajouter</button></div><div class="carte serree">${sug.map((s) => `<div class="ligne"><div class="corps"><div class="nom">${esc(s.nom)}</div><div class="detail">${s.sens === 'revenu' ? 'Revenu' : 'Dépense'} · ${eur(s.montant)} par mois · <button class="lien" data-a="ignorer" data-cle="${esc(s.cle)}">Ignorer</button></div></div><button class="etiquette bon" data-a="ajouter-suggestion" data-cle="${esc(s.cle)}">Ajouter</button></div>`).join('')}</div>` : ''}
      ${bloc('revenu', 'Revenus', 'Ajoute ton salaire et tes autres revenus réguliers.')}
      ${bloc('depense', 'Dépenses fixes', 'Loyer, crédits, assurances, abonnements…')}
      <div class="titre"><span>Dépenses courantes</span></div>
      <div class="carte serree"><button class="ligne" data-a="courant"><div class="corps"><div class="nom">Courses, essence, sorties…</div><div class="detail">${auto ? (S.analyse.courant != null ? 'Calculées d’après tes 3 derniers mois de banque' : 'À renseigner') : 'Montant que tu as fixé'}</div></div><div class="somme">${eur(m.courant)}<small>par mois</small></div></button></div>
      <p class="note">Les dépenses fixes reviennent à date régulière. Tout le reste va dans les dépenses courantes.</p>
    </div>`;
  }

  const IDEES = ['Combien je peux mettre de côté chaque mois ?', 'Est-ce que je peux acheter une voiture à 8 000 € l’été prochain ?', 'Quel est mon projet le plus risqué ?'];
  function vueLumi() {
    return `<div class="ecran">
      ${bandeauExemple()}
      ${entete('Lumi', 'Pose tes questions, Lumi répond avec tes prévisions')}
      <div class="fil" id="fil">
        ${S.fil.length ? S.fil.map((m) => `<div class="mot ${m.role === 'user' ? 'moi' : 'lumi'}">${esc(m.content)}</div>`).join('') : `<div class="idees">${IDEES.map((q) => `<button data-a="idee">${q}</button>`).join('')}</div>`}
        ${S.lumiAttente ? '<div class="mot lumi attente">Lumi réfléchit…</div>' : ''}
      </div>
      <div class="ecrire"><form data-form="lumi"><input name="q" placeholder="Écris ta question" autocomplete="off" enterkeyhint="send" aria-label="Ta question"><button aria-label="Envoyer">${I.envoyer}</button></form></div>
    </div>`;
  }
  function contexteLumi() {
    const sim = S.sim, d = S.d, m = sim.mensuel, L = [];
    L.push(`Date : ${moisLong(sim.mois(0))}. Prénom : ${d.profil.prenom || 'non renseigné'}.`);
    L.push(`Argent disponible aujourd'hui : ${eur(sim.solde)} (${d.comptes.filter((c) => c.inclus).map((c) => `${c.nom} ${eur(c.solde)}`).join(', ') || 'aucun compte'}). Coussin de sécurité voulu : ${eur(sim.coussin)}.`);
    L.push(`Chaque mois : revenus ${eur(m.revenus)}, dépenses fixes ${eur(m.fixes)}, dépenses courantes ${eur(m.courant)}, reste ${eur(m.reste)}.`);
    L.push('Revenus et dépenses réguliers : ' + (d.flux.map((f) => `${f.nom} (${f.sens === 'revenu' ? '+' : '−'}${eur(f.montant)} ${FREQ[f.frequence]}${f.fin ? `, jusqu'en ${moisLong(f.fin)}` : ''})`).join(' ; ') || 'aucun'));
    L.push(`Prévision avec les projets : ${[12, 36, 60, 120].map((k) => `${duree(k)} → ${eur(sim.avec[k])}`).join(', ')}.`);
    L.push(`Prévision sans aucun projet : ${[12, 36, 60, 120].map((k) => `${duree(k)} → ${eur(sim.sans[k])}`).join(', ')}.`);
    if (sim.decouvert != null) L.push(`Alerte : comptes dans le rouge en ${moisLong(sim.mois(sim.decouvert))}.`);
    else if (sim.sousCoussin != null) L.push(`Alerte : sous le coussin en ${moisLong(sim.mois(sim.sousCoussin))}.`);
    for (const p of d.projets) {
      const a = avis(p, sim.projets[p.id]);
      L.push(`Projet « ${p.nom} » (${TYPES[p.type].nom.toLowerCase()}${p.actif === false ? ', non compté dans la prévision' : ''}) : ${JSON.stringify(p.params)}. Verdict Lumo : ${a.titre}. ${a.faits.join(' ').replace(/<[^>]+>/g, '')}`);
    }
    if (!d.projets.length) L.push('Aucun projet enregistré.');
    return L.join('\n');
  }
  async function demanderLumi(q) {
    q = q.trim(); if (!q || S.lumiAttente) return;
    S.fil.push({ role: 'user', content: q }); S.lumiAttente = true; afficher(); basDuFil();
    let rep;
    if (S.exemple) rep = 'Dans l’exemple, Lumi est en veille. Crée ton compte : il répondra avec tes vrais chiffres.';
    else {
      try {
        const r = await serveur('coach', { messages: S.fil.slice(-12), contexte: contexteLumi() });
        rep = r.ok ? r.texte : r.message || 'Lumi est indisponible pour le moment.';
      } catch { rep = 'Pas de connexion. Réessaie dans un instant.'; }
    }
    S.fil.push({ role: 'assistant', content: rep || 'Lumi n’a pas su répondre. Reformule ta question.' }); S.lumiAttente = false; afficher(); basDuFil();
  }
  const basDuFil = () => requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));

  /* ---------- porte d'entrée : connexion, création de compte ---------- */
  const LOGO = `<img class="logo" src="/icons/logo-mark.png?v=1" alt="" width="120" height="60">`;
  function vuePorte() {
    const p = S.porte;
    const err = p.erreur ? `<p class="erreur">${esc(p.erreur)}</p>` : '';
    if (p.mode === 'code') return `<div class="porte">${LOGO}<h1>Vérifie ta boîte mail</h1>
      <p class="accroche">On vient d’écrire à ${esc(p.email)}. Entre le code à 6 chiffres reçu, ou touche le lien dans l’e-mail puis reviens ici.</p>
      <form data-form="code">${err}<label class="champ"><span>Code reçu par e-mail</span><div class="saisie"><input name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="123456"></div></label>
      <button class="bouton" ${p.attente ? 'disabled' : ''}>Valider le code</button></form>
      <button class="bouton second" data-a="lien-clique" style="margin-top:10px">J’ai touché le lien</button>
      <button class="bouton discret" data-a="porte" data-m="entree">Retour</button></div>`;
    const creation = p.mode === 'creation';
    return `<div class="porte">${LOGO}
      <h1>Ton argent, <em>dans le temps.</em></h1>
      <p class="accroche">Lumo relie ta banque et prévoit tes revenus et tes dépenses sur 10 ans. Tu sais quand un projet devient possible, et s’il est rentable.</p>
      <form data-form="porte">${err}
        <label class="champ"><span>E-mail</span><div class="saisie"><input name="email" type="email" autocomplete="email" value="${esc(p.email)}" placeholder="toi@exemple.fr" required></div></label>
        <label class="champ"><span>Mot de passe</span><div class="saisie"><input name="mdp" type="password" autocomplete="${creation ? 'new-password' : 'current-password'}" placeholder="${creation ? '8 caractères ou plus' : ''}" required></div></label>
        <button class="bouton" ${p.attente ? 'disabled' : ''}>${creation ? 'Créer mon compte' : 'Me connecter'}</button>
      </form>
      <button class="bouton second" data-a="porte" data-m="${creation ? 'entree' : 'creation'}">${creation ? 'J’ai déjà un compte' : 'Créer un compte'}</button>
      <button class="bouton discret" data-a="exemple">Voir un exemple sans compte</button>
      ${creation ? '' : '<button class="bouton discret" data-a="oubli" style="padding-top:0">Mot de passe oublié</button>'}
      <p class="pied"><a href="/confidentialite">Confidentialité</a> · <a href="/conditions">Conditions</a></p>
    </div>`;
  }
  const ERREURS = [[/invalid login/i, 'E-mail ou mot de passe incorrect.'], [/not confirmed/i, 'Confirme d’abord ton e-mail.'], [/already registered/i, 'Un compte existe déjà avec cet e-mail.'], [/password.*(6|short|weak)/i, 'Mot de passe trop court.'], [/rate limit|too many|security purposes/i, 'Trop d’essais. Patiente une minute.'], [/expired|invalid.*(token|otp)/i, 'Code incorrect ou expiré.'], [/fetch|network/i, 'Pas de connexion. Réessaie.']];
  const traduire = (m) => (ERREURS.find(([re]) => re.test(m || '')) || [0, 'Ça n’a pas marché. Réessaie.'])[1];
  async function soumettrePorte(f) {
    const p = S.porte; p.email = f.email.value.trim(); p.mdp = f.mdp.value; p.erreur = '';
    if (p.mode === 'creation' && p.mdp.length < 8) { p.erreur = 'Choisis un mot de passe de 8 caractères ou plus.'; return afficher(); }
    p.attente = true; afficher();
    if (p.mode === 'creation') {
      const { data, error } = await sb.auth.signUp({ email: p.email, password: p.mdp, options: { emailRedirectTo: location.origin } });
      p.attente = false;
      if (error) p.erreur = traduire(error.message);
      else if (data.user && data.user.identities && !data.user.identities.length) p.erreur = 'Un compte existe déjà avec cet e-mail.';
      else if (!data.session) p.mode = 'code';
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: p.email, password: p.mdp });
      p.attente = false;
      if (error) { if (/not confirmed/i.test(error.message)) p.mode = 'code'; else p.erreur = traduire(error.message); }
    }
    if (!S.user) afficher();
  }

  /* ---------- premier lancement ---------- */
  function vueDepart() {
    const dp = S.depart, err = dp.erreur ? `<p class="erreur">${esc(dp.erreur)}</p>` : '';
    if (dp.mode === 'chiffres') return `<div class="porte">
      <h1>Quatre chiffres <em>pour démarrer.</em></h1>
      <p class="accroche">À peu près, c’est très bien. Tu affineras ensuite dans l’onglet Budget.</p>
      <form data-form="depart">${err}
        ${champ({ f: 'solde', t: 'Ce que tu as aujourd’hui sur tes comptes', u: '€' }, {})}
        ${champ({ f: 'revenus', t: 'Tes revenus par mois', u: '€ par mois' }, {})}
        ${champ({ f: 'fixes', t: 'Tes dépenses fixes par mois', u: '€ par mois', aide: 'Loyer, crédits, assurances, abonnements.' }, {})}
        ${champ({ f: 'courant', t: 'Tes dépenses courantes par mois', u: '€ par mois', aide: 'Courses, essence, sorties, tout le reste.' }, {})}
        <button class="bouton">Voir ma prévision</button>
      </form>
      <button class="bouton discret" data-a="depart" data-m="choix">Retour</button></div>`;
    return `<div class="porte">${LOGO}
      <h1>Bienvenue <em>sur Lumo.</em></h1>
      <p class="accroche">Pour prévoir, Lumo a besoin de savoir ce que tu as, ce qui rentre et ce qui sort.</p>
      ${err}
      <label class="champ"><span>Ton prénom</span><div class="saisie"><input id="prenom" autocomplete="given-name" value="${esc(S.d.profil.prenom || '')}"></div></label>
      <div class="types">
        <button data-a="depart-banque"><div class="ico">${I.credit}</div><div><b>Connecter ma banque</b><span>Lumo lit tes comptes et repère tout seul tes revenus et tes dépenses.</span></div></button>
        <button data-a="depart" data-m="chiffres"><div class="ico">${I.budget}</div><div><b>Saisir mes chiffres</b><span>Quatre chiffres suffisent pour une première prévision.</span></div></button>
      </div>
      <button class="bouton discret" data-a="deconnexion">Me déconnecter</button></div>`;
  }
  async function soumettreDepart(f) {
    const v = (k) => M.n(f.querySelector(`[data-f="${k}"]`).value);
    if (!v('revenus')) { S.depart.erreur = 'Indique au moins tes revenus par mois.'; return afficher(); }
    try {
      await ecrire('comptes', { id: id(), nom: 'Mes comptes', type: 'courant', solde: v('solde'), source: 'manuel', inclus: true }, true);
      await ecrire('flux', { id: id(), nom: 'Revenus', sens: 'revenu', montant: v('revenus'), frequence: 'mois', evolution: 0, actif: true }, true);
      if (v('fixes')) await ecrire('flux', { id: id(), nom: 'Dépenses fixes', sens: 'depense', montant: v('fixes'), frequence: 'mois', evolution: 0, actif: true }, true);
      await ecrireProfil({ courant_manuel: v('courant'), pret: true });
      afficher();
    } catch { S.depart.erreur = 'Enregistrement impossible. Réessaie.'; afficher(); }
  }

  /* ---------- champs de formulaire ---------- */
  const lire = (o, chemin) => chemin.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  const poser = (o, chemin, v) => { const K = chemin.split('.'); let x = o; for (const k of K.slice(0, -1)) x = x[k] = x[k] || {}; x[K[K.length - 1]] = v; };
  function champ(o, b) {
    const v = lire(b, o.f);
    const genre = o.type === 'ym' ? 'type="month"' : o.type === 'texte' ? 'type="text" autocomplete="off"' : 'type="text" inputmode="decimal" autocomplete="off"';
    return `<label class="champ"><span>${o.t}</span><div class="saisie"><input data-f="${o.f}" ${genre} value="${esc(o.type === 'ym' || o.type === 'texte' ? v ?? '' : nombre(v))}" placeholder="${esc(o.p || '')}" class="${o.u ? 'avec-unite' : ''}">${o.u ? `<span class="unite">${o.u}</span>` : ''}</div>${o.aide ? `<small class="aide">${o.aide}</small>` : ''}</label>`;
  }
  const choix = (f, b, options, t) => `<div class="champ">${t ? `<span>${t}</span>` : ''}<div class="choix">${options.map(([v, nom]) => `<button type="button" data-a="choix" data-f="${f}" data-v="${v}" class="${(lire(b, f) ?? options[0][0]) === v ? 'actif' : ''}">${nom}</button>`).join('')}</div></div>`;
  const bascule = (f, b, t, aide) => `<div class="bascule"><span>${t}${aide ? `<small>${aide}</small>` : ''}</span><button type="button" class="inter ${lire(b, f) ? 'oui' : ''}" data-a="bascule" data-f="${f}" role="switch" aria-checked="${!!lire(b, f)}" aria-label="${esc(t)}"></button></div>`;
  const deux = (a, b) => `<div class="deux">${a}${b}</div>`;

  /* ---------- feuilles ---------- */
  function ouvrir(f) { S.feuille = f; afficherFeuille(); }
  function fermer() {
    const retour = S.feuille && S.feuille.retour;
    S.feuille = retour ? { nom: retour } : null;
    afficherFeuille(); afficher();
  }
  const coque = (titre, corps) => `<div class="feuille" role="dialog" aria-modal="true" aria-label="${esc(titre)}"><header><h2>${titre}</h2><button class="rond" data-a="fermer" aria-label="Fermer">${I.fermer}</button></header><div class="dedans">${corps}</div></div>`;

  function apercuProjet(b) {
    const autres = S.d.projets.filter((p) => p.id !== b.id), place = S.d.projets.findIndex((p) => p.id === b.id);
    const essai = { ...b, actif: true };
    const L = autres.slice(); L.splice(place < 0 ? L.length : place, 0, essai);
    const avant = S.sim; S.sim = M.simuler(etat(L));
    const a = avis(essai, S.sim.projets[b.id]); S.sim = avant;
    return blocAvis(a);
  }
  const projetVide = (b) => { const x = b.params; return b.type === 'achat' ? !M.n(x.montant) : b.type === 'investissement' ? !M.n(x.prix) : b.type === 'credit' ? !M.n(x.capital) || !M.n(x.dureeAns) : !M.n(x.revenu) && !M.n(x.depense) && !M.n(x.depart); };
  function feuilleProjet(F) {
    const b = F.brouillon, x = b.params, T = TYPES[b.type];
    const quand = () => choix('params.mode', b, [['tot', 'Dès que possible'], ['date', 'À une date']], 'Quand ?') + (x.mode === 'date' ? champ({ f: 'params.date', t: 'Mois visé', type: 'ym' }, b) : '');
    const credit = (t) => choix('params.financement', b, [['comptant', 'Comptant'], ['credit', 'À crédit']], t)
      + (x.financement === 'credit' ? champ({ f: 'params.apport', t: 'Ton apport', u: '€' }, b) + deux(champ({ f: 'params.taux', t: 'Taux du crédit', u: '% par an' }, b), champ({ f: 'params.dureeAns', t: 'Durée', u: 'ans' }, b)) : '');
    let corps = champ({ f: 'nom', t: 'Nom du projet', type: 'texte', p: T.ex }, b);
    if (b.type === 'achat') corps += champ({ f: 'params.montant', t: 'Combien ça coûte', u: '€' }, b) + quand() + credit('Comment tu paies ?');
    if (b.type === 'investissement') corps += deux(champ({ f: 'params.prix', t: 'Prix', u: '€' }, b), champ({ f: 'params.frais', t: 'Frais en plus', u: '€' }, b))
      + '<small class="aide" style="display:block;margin:-8px 2px 14px;color:var(--pale);font-size:12.5px">Frais : notaire, travaux, dossier.</small>'
      + quand() + credit('Comment tu finances ?')
      + deux(champ({ f: 'params.revenu', t: 'Ce que ça rapporte', u: '€/mois' }, b), champ({ f: 'params.charges', t: 'Ce que ça coûte', u: '€/mois' }, b))
      + '<small class="aide" style="display:block;margin:-8px 2px 14px;color:var(--pale);font-size:12.5px">Rapporte : loyer ou revenus. Coûte : taxe foncière, assurance, copropriété, entretien, ramenés au mois.</small>'
      + champ({ f: 'params.valorisation', t: 'Prise de valeur attendue', u: '% par an', aide: 'Laisse 0 si tu ne sais pas.' }, b);
    if (b.type === 'changement') corps += champ({ f: 'params.revenu', t: 'Tes revenus changent de', u: '€ par mois' }, b) + choix('params.revenuSens', b, [['plus', 'En plus'], ['moins', 'En moins']])
      + champ({ f: 'params.depense', t: 'Tes dépenses changent de', u: '€ par mois' }, b) + choix('params.depenseSens', b, [['plus', 'En plus'], ['moins', 'En moins']])
      + deux(champ({ f: 'params.date', t: 'À partir de', type: 'ym' }, b), champ({ f: 'params.fin', t: 'Jusqu’à (facultatif)', type: 'ym' }, b))
      + champ({ f: 'params.depart', t: 'Coût au départ (facultatif)', u: '€', aide: 'Déménagement, caution, équipement…' }, b);
    if (b.type === 'credit') corps += champ({ f: 'params.capital', t: 'Montant emprunté', u: '€' }, b)
      + deux(champ({ f: 'params.taux', t: 'Taux', u: '% par an' }, b), champ({ f: 'params.dureeAns', t: 'Durée', u: 'ans' }, b))
      + champ({ f: 'params.date', t: 'Première mensualité', type: 'ym' }, b)
      + bascule('params.verse', b, 'L’argent arrive sur mon compte', 'Oui pour un prêt personnel. Non si le crédit paie directement un achat.');
    corps += `<div class="apercu" id="apercu">${projetVide(b) ? '<div class="faits">Remplis les chiffres : Lumo te répond en direct.</div>' : apercuProjet(b)}</div>`;
    corps += bascule('actif', b, 'Compter dans ma prévision', 'Éteins pour garder l’idée sans toucher à ta courbe.');
    const rang = S.d.projets.findIndex((p) => p.id === b.id), total = S.d.projets.length;
    if (!F.nouveau && total > 1) corps += `<div class="champ"><span>Priorité : ${rang + 1}${rang ? 'e' : 'er'} sur ${total}. Lumo finance les projets dans cet ordre.</span><div class="choix"><button type="button" data-a="deplacer" data-sens="-1" ${rang === 0 ? 'disabled' : ''}>Passer avant</button><button type="button" data-a="deplacer" data-sens="1" ${rang === total - 1 ? 'disabled' : ''}>Passer après</button></div></div>`;
    corps += `<button class="bouton" data-a="enregistrer-projet">Enregistrer</button>${F.nouveau ? '' : '<button class="bouton danger" data-a="supprimer-projet">Supprimer ce projet</button>'}`;
    return coque(F.nouveau ? T.nom : esc(b.nom || T.nom), corps);
  }
  function feuilleFlux(F) {
    const b = F.brouillon, rev = b.sens === 'revenu';
    return coque(F.nouveau ? (rev ? 'Nouveau revenu' : 'Nouvelle dépense fixe') : esc(b.nom), `
      ${champ({ f: 'nom', t: 'Nom', type: 'texte', p: rev ? 'Salaire, prime, loyer perçu…' : 'Loyer, assurance, abonnement…' }, b)}
      ${champ({ f: 'montant', t: 'Montant', u: '€' }, b)}
      ${choix('frequence', b, [['mois', 'Tous les mois'], ['trimestre', 'Tous les 3 mois'], ['an', 'Tous les ans']], 'Ça revient')}
      ${b.frequence && b.frequence !== 'mois' ? `<label class="champ"><span>${b.frequence === 'an' ? 'Mois où ça tombe' : 'Un des mois où ça tombe'}</span><div class="saisie"><select data-f="mois">${MOIS.map((m, i) => `<option value="${i + 1}" ${+b.mois === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></div></label>` : ''}
      ${deux(champ({ f: 'debut', t: 'Commence en (facultatif)', type: 'ym' }, b), champ({ f: 'fin', t: 'Se termine en (facultatif)', type: 'ym' }, b))}
      ${champ({ f: 'evolution', t: 'Évolution prévue', u: '% par an', aide: rev ? 'Exemple : 2 si ton salaire monte d’environ 2 % par an.' : 'Laisse 0 si le montant ne bouge pas.' }, b)}
      <button class="bouton" data-a="enregistrer-flux">Enregistrer</button>
      ${F.nouveau ? '' : '<button class="bouton danger" data-a="supprimer-flux">Supprimer</button>'}`);
  }
  function feuilleCourant(F) {
    const auto = S.analyse.courant;
    return coque('Dépenses courantes', `
      <p class="doux" style="margin-bottom:16px">Tout ce qui n’est pas une dépense fixe : courses, essence, sorties, achats du quotidien.</p>
      ${champ({ f: 'montant', t: 'En moyenne', u: '€ par mois' }, F.brouillon)}
      <button class="bouton" data-a="enregistrer-courant">Enregistrer</button>
      ${auto != null ? `<button class="bouton discret" data-a="courant-auto">Laisser Lumo calculer d’après ma banque (${eur(auto)})</button>` : ''}`);
  }
  function feuilleCompte(F) {
    const b = F.brouillon, banque = b.source === 'banque';
    return coque(F.nouveau ? 'Nouveau compte' : esc(b.nom), `
      ${champ({ f: 'nom', t: 'Nom', type: 'texte', p: 'Compte courant, Livret A…' }, b)}
      ${banque ? `<p class="doux" style="margin:0 2px 16px">Solde lu dans ta banque : <b class="or">${eur(b.solde)}</b></p>` : champ({ f: 'solde', t: 'Solde aujourd’hui', u: '€' }, b)}
      ${choix('type', b, [['courant', 'Compte courant'], ['epargne', 'Épargne']], 'Type')}
      ${bascule('inclus', b, 'Compter dans ma prévision', 'Éteins pour un compte que tu ne veux pas mêler à tes projets.')}
      <button class="bouton" data-a="enregistrer-compte">Enregistrer</button>
      ${F.nouveau || banque ? '' : '<button class="bouton danger" data-a="supprimer-compte">Supprimer ce compte</button>'}`);
  }
  function feuilleReglages(F) {
    const d = S.d, b = F.brouillon || (F.brouillon = { prenom: d.profil.prenom || '', coussin: d.profil.coussin || '' });
    return coque('Réglages', `
      ${champ({ f: 'prenom', t: 'Ton prénom', type: 'texte' }, b)}
      ${champ({ f: 'coussin', t: 'Ton coussin de sécurité', u: '€', aide: 'La somme que tu veux toujours garder. Lumo ne dit jamais « possible » si un projet la fait fondre.' }, b)}
      <button class="bouton second" data-a="enregistrer-reglages">Enregistrer</button>
      <div class="titre"><span>Comptes</span><button data-a="nouveau-compte">Ajouter</button></div>
      <div class="carte serree">${d.comptes.length ? d.comptes.map((c) => `<button class="ligne" data-a="compte" data-id="${c.id}"><div class="corps"><div class="nom">${esc(c.nom)}</div><div class="detail">${c.source === 'banque' ? esc(c.banque || 'Banque') : 'Saisi à la main'}${c.inclus ? '' : ' · hors prévision'}</div></div><div class="somme">${eur(c.solde)}</div></button>`).join('') : '<p class="vide">Aucun compte.</p>'}</div>
      <div class="titre"><span>Banque</span></div>
      ${S.exemple ? '<p class="note" style="margin-top:0">La connexion bancaire s’active avec un compte Lumo.</p>' : `
      ${d.sessions.length ? `<div class="carte serree">${d.sessions.map((s) => `<div class="ligne"><div class="corps"><div class="nom">${esc(s.bank)}</div><div class="detail">${s.status === 'AUTHORIZED' ? `Mise à jour ${ilYA(s.last_sync)}` : 'Accès expiré : reconnecte ta banque'}${s.error ? ` · ${esc(s.error)}` : ''}</div></div><button class="etiquette rouge" data-a="retirer-banque" data-id="${esc(s.session_id)}">Retirer</button></div>`).join('')}</div>
      <button class="bouton second" data-a="sync" ${F.attente ? 'disabled' : ''}>${F.attente ? 'Mise à jour…' : 'Mettre à jour maintenant'}</button><div style="height:10px"></div>` : ''}
      <button class="bouton ${d.sessions.length ? 'discret' : ''}" data-a="banques">${d.sessions.length ? 'Connecter une autre banque' : 'Connecter ma banque'}</button>
      <p class="note">Lumo lit tes comptes, il ne peut ni payer ni virer. Mise à jour automatique 4 fois par jour.</p>`}
      <div class="titre"><span>Compte</span></div>
      ${S.exemple ? '<button class="bouton" data-a="creer-compte">Créer mon compte</button>' : `<p class="doux" style="margin:0 4px 12px">${esc(S.user.email)}</p>
      <button class="bouton second" data-a="deconnexion">Me déconnecter</button>
      <button class="bouton danger" data-a="supprimer-tout">Supprimer mon compte et mes données</button>`}
      <p class="note" style="text-align:center"><a class="lien" href="/confidentialite">Confidentialité</a> · <a class="lien" href="/conditions">Conditions</a></p>`);
  }
  function feuilleBanques(F) {
    const q = (F.q || '').toLowerCase(), L = (S.banques || []).filter((b) => b.name.toLowerCase().includes(q));
    return coque('Ta banque', `
      ${F.erreur ? `<p class="erreur">${esc(F.erreur)}</p>` : ''}
      <label class="champ"><div class="saisie"><input data-f="q" data-filtre type="search" placeholder="Chercher ma banque" value="${esc(F.q || '')}" autocomplete="off"></div></label>
      <div class="carte serree" id="liste-banques">${listeBanques(L)}</div>
      <p class="note">Tu seras envoyé sur le site de ta banque pour donner ton accord, puis ramené ici.</p>`);
  }
  const listeBanques = (L) => (S.banques == null ? '<p class="vide">Chargement des banques…</p>' : L.length ? L.slice(0, 60).map((b) => `<button class="ligne" data-a="choisir-banque" data-nom="${esc(b.name)}"><div class="corps"><div class="nom">${esc(b.name)}</div></div><span class="doux">›</span></button>`).join('') : '<p class="vide">Aucune banque à ce nom.</p>');
  function feuilleConfirmer(F) {
    return coque(F.titre, `<p class="doux" style="margin-bottom:18px">${F.texte}</p><button class="bouton" data-a="${F.action}" ${F.id ? `data-id="${esc(F.id)}"` : ''} style="background:var(--moins)">${F.bouton}</button><button class="bouton discret" data-a="fermer">Annuler</button>`);
  }
  function feuilleMdp() {
    return coque('Nouveau mot de passe', `<form data-form="mdp"><label class="champ"><span>Choisis un mot de passe</span><div class="saisie"><input name="mdp" type="password" autocomplete="new-password" placeholder="8 caractères ou plus" required minlength="8"></div></label><button class="bouton">Enregistrer</button></form>`);
  }
  const FEUILLES = { projet: feuilleProjet, types: () => coque('Nouveau projet', listeTypes()), flux: feuilleFlux, courant: feuilleCourant, compte: feuilleCompte, reglages: feuilleReglages, detail: feuilleDetail, banques: feuilleBanques, confirmer: feuilleConfirmer, mdp: feuilleMdp };
  function afficherFeuille() {
    const el = $('#feuille'), F = S.feuille;
    if (!F) { el.hidden = true; el.innerHTML = ''; document.body.style.overflow = ''; return; }
    const haut = $('.dedans', el) ? $('.dedans', el).scrollTop : 0, meme = el.dataset.nom === F.nom;
    el.innerHTML = FEUILLES[F.nom](F); el.dataset.nom = F.nom; el.hidden = false; document.body.style.overflow = 'hidden';
    if (meme) $('.dedans', el).scrollTop = haut;
  }

  /* ---------- affichage général ---------- */
  const ONGLETS = [['prevision', 'Prévision'], ['projets', 'Projets'], ['budget', 'Budget'], ['lumi', 'Lumi']];
  const VUES = { prevision: vuePrevision, projets: vueProjets, budget: vueBudget, lumi: vueLumi };
  function afficher() {
    const app = $('#app');
    if (!S.user && !S.exemple) { app.innerHTML = vuePorte(); return; }
    if (!S.d) return;
    if (!S.exemple && !S.d.profil.pret) { app.innerHTML = vueDepart(); return; }
    const n = suggestions().length;
    app.innerHTML = VUES[S.vue]() + `<nav class="onglets"><div>${ONGLETS.map(([v, t]) => `<button data-a="onglet" data-v="${v}" class="${S.vue === v ? 'actif' : ''}" ${S.vue === v ? 'aria-current="page"' : ''}>${I[v]}${t}${v === 'budget' && n ? `<span class="pastille">${n}</span>` : ''}</button>`).join('')}</div></nav>`;
    if (S.vue === 'prevision') lecture(null);
  }
  let minuteur;
  function dire(texte) { const b = $('#bulle'); b.textContent = texte; b.hidden = false; clearTimeout(minuteur); minuteur = setTimeout(() => { b.hidden = true; }, 3800); }

  /* ---------- banque ---------- */
  async function ouvrirBanques(retour) {
    ouvrir({ nom: 'banques', retour });
    const r = await serveur('bank/u/banques').catch(() => ({ ok: false }));
    if (!r.ok) {
      if (S.feuille && S.feuille.nom === 'banques') { S.feuille.erreur = r.code === 'pas_activee' ? 'La connexion bancaire n’est pas encore activée sur Lumo. En attendant, saisis tes chiffres à la main.' : 'Impossible de charger la liste des banques. Réessaie plus tard.'; S.banques = S.banques || []; afficherFeuille(); }
      return;
    }
    const { data } = await sb.from('eb_banks').select('name').eq('country', 'FR').order('name');
    S.banques = data || [];
    if (S.feuille && S.feuille.nom === 'banques') afficherFeuille();
  }
  async function choisirBanque(nom) {
    dire('Ouverture de ta banque…');
    const r = await serveur('bank/u/connecter', { banque: nom }).catch(() => ({ ok: false }));
    if (r.ok && r.url) { location.href = r.url; return; }
    S.feuille.erreur = r.code === 'pas_activee' ? 'La connexion bancaire n’est pas encore activée sur Lumo.' : 'Cette banque ne répond pas. Réessaie plus tard.'; afficherFeuille();
  }
  async function synchroniser(silencieux) {
    const r = await serveur('bank/u/sync').catch(() => ({ ok: false }));
    await charger();
    if (!silencieux) dire(r.ok ? 'Comptes à jour.' : 'Mise à jour incomplète. Réessaie plus tard.');
  }

  /* ---------- actions ---------- */
  const moisProchain = () => M.ecrireYM(M.ym(new Date()) + 1);
  const A = {
    onglet: (el) => { S.vue = el.dataset.v; afficher(); window.scrollTo(0, 0); },
    horizon: (el) => { S.horizon = +el.dataset.k; afficher(); },
    fermer,
    reglages: () => ouvrir({ nom: 'reglages' }),
    detail: () => ouvrir({ nom: 'detail' }),
    porte: (el) => { S.porte.mode = el.dataset.m; S.porte.erreur = ''; afficher(); },
    exemple: () => { S.exemple = true; S.d = null; charger(); afficher(); window.scrollTo(0, 0); },
    'creer-compte': () => { S.exemple = false; S.d = null; S.feuille = null; afficherFeuille(); S.vue = 'prevision'; S.fil = []; S.porte.mode = 'creation'; afficher(); },
    oubli: async () => {
      const email = ($('[name=email]') || {}).value;
      if (!email) { S.porte.erreur = 'Écris d’abord ton e-mail ci-dessus.'; return afficher(); }
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin });
      dire(error ? traduire(error.message) : 'E-mail envoyé : ouvre le lien pour choisir un nouveau mot de passe.');
    },
    'lien-clique': async () => {
      const { error } = await sb.auth.signInWithPassword({ email: S.porte.email, password: S.porte.mdp });
      if (error) { S.porte.erreur = /not confirmed/i.test(error.message) ? 'Ton e-mail n’est pas encore confirmé.' : traduire(error.message); afficher(); }
    },
    deconnexion: async () => { await sb.auth.signOut(); },
    depart: (el) => { const p = $('#prenom'); if (p) S.d.profil.prenom = p.value.trim(); S.depart = { mode: el.dataset.m, erreur: '' }; afficher(); window.scrollTo(0, 0); },
    'depart-banque': async () => { const p = $('#prenom'); if (p) S.d.profil.prenom = p.value.trim(); ouvrirBanques(); },
    idee: (el) => demanderLumi(el.textContent),

    /* projets */
    'nouveau-projet': () => ouvrir({ nom: 'types' }),
    'type-projet': (el) => {
      const t = el.dataset.t, base = { achat: { mode: 'tot', financement: 'comptant' }, investissement: { mode: 'tot', financement: 'credit', dureeAns: 20 }, changement: { date: moisProchain(), revenuSens: 'plus', depenseSens: 'plus' }, credit: { date: moisProchain(), verse: false } }[t];
      ouvrir({ nom: 'projet', nouveau: true, brouillon: { id: id(), type: t, nom: '', actif: true, ordre: S.d.projets.length, params: base } });
    },
    projet: (el) => { const p = S.d.projets.find((x) => x.id === el.dataset.id); ouvrir({ nom: 'projet', brouillon: JSON.parse(JSON.stringify(p)) }); },
    'enregistrer-projet': async () => {
      const F = S.feuille, b = F.brouillon;
      if (projetVide(b)) return dire('Remplis au moins le montant.');
      if ((b.type === 'achat' || b.type === 'investissement') && b.params.mode === 'date' && !b.params.date) return dire('Choisis le mois visé.');
      if (b.params.financement === 'credit' && !M.n(b.params.dureeAns)) return dire('Indique la durée du crédit.');
      b.nom = (b.nom || '').trim() || TYPES[b.type].nom.replace(/^Un(e)? /, '').replace(/^./, (c) => c.toUpperCase());
      for (const k of ['montant', 'prix', 'frais', 'apport', 'taux', 'dureeAns', 'revenu', 'charges', 'valorisation', 'depense', 'depart', 'capital']) if (k in b.params) b.params[k] = M.n(b.params[k]);
      await ecrire('projets', b, F.nouveau); S.feuille = null; afficherFeuille(); if (F.nouveau) S.vue = 'projets'; afficher(); dire('Projet enregistré.');
    },
    deplacer: async (el) => {
      const L = S.d.projets, i = L.findIndex((p) => p.id === S.feuille.brouillon.id), j = i + +el.dataset.sens;
      if (i < 0 || j < 0 || j >= L.length) return;
      [L[i], L[j]] = [L[j], L[i]];
      for (const [k, p] of L.entries()) if (p.ordre !== k) { p.ordre = k; if (!S.exemple) await sb.from('projets').update({ ordre: k }).eq('id', p.id); }
      S.feuille.brouillon.ordre = j; calculer(); afficherFeuille();
    },
    'supprimer-projet': async () => { await effacer('projets', S.feuille.brouillon.id); S.feuille = null; afficherFeuille(); afficher(); dire('Projet supprimé.'); },

    /* budget */
    'nouveau-flux': (el) => ouvrir({ nom: 'flux', nouveau: true, brouillon: { id: id(), nom: '', sens: el.dataset.sens, montant: '', frequence: 'mois', mois: new Date().getMonth() + 1, evolution: 0, actif: true } }),
    flux: (el) => ouvrir({ nom: 'flux', brouillon: { ...S.d.flux.find((x) => x.id === el.dataset.id) } }),
    'enregistrer-flux': async () => {
      const F = S.feuille, b = F.brouillon;
      if (!M.n(b.montant)) return dire('Indique un montant.');
      b.nom = (b.nom || '').trim() || (b.sens === 'revenu' ? 'Revenu' : 'Dépense');
      await ecrire('flux', b, F.nouveau); S.feuille = null; afficherFeuille(); afficher();
    },
    'supprimer-flux': async () => { await effacer('flux', S.feuille.brouillon.id); S.feuille = null; afficherFeuille(); afficher(); },
    'ajouter-suggestion': async (el) => { const s = suggestions().find((x) => x.cle === el.dataset.cle); if (s) await ecrire('flux', { id: id(), nom: s.nom, sens: s.sens, montant: s.montant, frequence: 'mois', evolution: 0, cle: s.cle, actif: true }, true); afficher(); },
    'tout-ajouter': async () => { for (const s of suggestions()) await ecrire('flux', { id: id(), nom: s.nom, sens: s.sens, montant: s.montant, frequence: 'mois', evolution: 0, cle: s.cle, actif: true }, true); afficher(); dire('Ajoutés à ton budget.'); },
    ignorer: async (el) => { await ecrireProfil({ ignores: [...(S.d.profil.ignores || []), el.dataset.cle] }); afficher(); },
    courant: () => ouvrir({ nom: 'courant', brouillon: { montant: Math.round(S.sim.mensuel.courant) || '' } }),
    'enregistrer-courant': async () => { await ecrireProfil({ courant_manuel: M.n(S.feuille.brouillon.montant) }); S.feuille = null; afficherFeuille(); afficher(); },
    'courant-auto': async () => { await ecrireProfil({ courant_manuel: null }); S.feuille = null; afficherFeuille(); afficher(); },

    /* réglages, comptes, banque */
    'enregistrer-reglages': async () => { const b = S.feuille.brouillon; await ecrireProfil({ prenom: (b.prenom || '').trim(), coussin: M.n(b.coussin) }); dire('Réglages enregistrés.'); afficher(); },
    'nouveau-compte': () => ouvrir({ nom: 'compte', nouveau: true, retour: 'reglages', brouillon: { id: id(), nom: '', type: 'courant', solde: '', source: 'manuel', inclus: true } }),
    compte: (el) => ouvrir({ nom: 'compte', retour: 'reglages', brouillon: { ...S.d.comptes.find((x) => x.id === el.dataset.id) } }),
    'enregistrer-compte': async () => {
      const F = S.feuille, b = F.brouillon; b.nom = (b.nom || '').trim() || 'Compte';
      const { id: i, nom, type, solde, source, inclus } = b;
      if (F.nouveau) await ecrire('comptes', { id: i, nom, type, solde, source, inclus }, true);
      else { Object.assign(S.d.comptes.find((x) => x.id === i), b); await ecrire('comptes', source === 'banque' ? { ...b, solde: S.d.comptes.find((x) => x.id === i).solde } : b, false); }
      fermer();
    },
    'supprimer-compte': async () => { await effacer('comptes', S.feuille.brouillon.id); fermer(); },
    banques: () => ouvrirBanques('reglages'),
    'choisir-banque': (el) => choisirBanque(el.dataset.nom),
    sync: async () => { S.feuille.attente = true; afficherFeuille(); await synchroniser(); if (S.feuille) { S.feuille.attente = false; afficherFeuille(); } afficher(); },
    'retirer-banque': (el) => ouvrir({ nom: 'confirmer', retour: 'reglages', titre: 'Retirer cette banque ?', texte: 'Lumo n’aura plus accès à cette banque. Ses comptes et ses opérations seront effacés de Lumo.', bouton: 'Retirer la banque', action: 'retirer-banque-oui', id: el.dataset.id }),
    'retirer-banque-oui': async (el) => { const r = await serveur('bank/u/retirer', { session: el.dataset.id }).catch(() => ({ ok: false })); await charger(); fermer(); dire(r.ok ? 'Banque retirée.' : 'Ça n’a pas marché. Réessaie.'); },
    'supprimer-tout': () => ouvrir({ nom: 'confirmer', retour: 'reglages', titre: 'Supprimer ton compte ?', texte: 'Ton compte Lumo, tes comptes, tes opérations et tes projets seront effacés pour de bon. C’est définitif.', bouton: 'Tout supprimer', action: 'supprimer-tout-oui' }),
    'supprimer-tout-oui': async () => { const r = await serveur('bank/u/supprimer-compte').catch(() => ({ ok: false })); if (!r.ok) return dire('Suppression impossible. Réessaie.'); S.feuille = null; afficherFeuille(); await sb.auth.signOut(); dire('Compte supprimé.'); },

    /* champs à boutons */
    choix: (el) => { poser(S.feuille.brouillon, el.dataset.f, el.dataset.v); afficherFeuille(); },
    bascule: (el) => { poser(S.feuille.brouillon, el.dataset.f, !lire(S.feuille.brouillon, el.dataset.f)); afficherFeuille(); },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]');
    if (el) { e.preventDefault(); const f = A[el.dataset.a]; if (f) Promise.resolve(f(el)).catch((err) => console.error(err)); return; }
    if (e.target.id === 'feuille') fermer();
  });
  document.addEventListener('input', (e) => {
    const el = e.target, F = S.feuille;
    if (!el.dataset || !el.dataset.f || !F) return;
    if ('filtre' in el.dataset) { F.q = el.value; const q = el.value.toLowerCase(); $('#liste-banques').innerHTML = listeBanques((S.banques || []).filter((b) => b.name.toLowerCase().includes(q))); return; }
    poser(F.brouillon, el.dataset.f, el.value);
    const ap = $('#apercu');
    if (ap && F.nom === 'projet') ap.innerHTML = projetVide(F.brouillon) ? '<div class="faits">Remplis les chiffres : Lumo te répond en direct.</div>' : apercuProjet(F.brouillon);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]'); if (!f) return;
    e.preventDefault();
    const quoi = f.dataset.form;
    if (quoi === 'porte') soumettrePorte(f);
    if (quoi === 'depart') soumettreDepart(f);
    if (quoi === 'lumi') { const q = f.q.value; f.q.value = ''; demanderLumi(q); }
    if (quoi === 'code') (async () => {
      S.porte.attente = true; afficher();
      const { error } = await sb.auth.verifyOtp({ email: S.porte.email, token: f.code.value.trim(), type: 'signup' });
      S.porte.attente = false; if (error) { S.porte.erreur = traduire(error.message); afficher(); }
    })();
    if (quoi === 'mdp') (async () => { const { error } = await sb.auth.updateUser({ password: f.mdp.value }); if (error) return dire(traduire(error.message)); S.feuille = null; afficherFeuille(); dire('Mot de passe changé.'); })();
  });
  for (const ev of ['pointerdown', 'pointermove']) document.addEventListener(ev, (e) => { if (e.target.closest && e.target.closest('#courbe')) suivreCourbe(e); });

  /* ---------- démarrage ---------- */
  let charge = null;
  async function entrer(session) {
    const u = session ? session.user : null;
    if (u && S.user && u.id === S.user.id) return;
    S.user = u;
    if (!u) { S.d = S.exemple ? S.d : null; S.fil = []; S.feuille = null; afficherFeuille(); S.depart = { mode: 'choix', erreur: '' }; afficher(); return; }
    S.exemple = false; S.d = null; S.vue = 'prevision';
    try {
      await (charge = charger());
      const retour = new URLSearchParams(location.search).get('banque');
      if (retour) {
        history.replaceState(null, '', location.pathname);
        if (retour === 'ok') { if (!S.d.profil.pret) await ecrireProfil({ pret: true }); dire('Banque connectée.'); }
        else dire(retour === 'annulee' ? 'Connexion à la banque annulée.' : 'La connexion à la banque a échoué. Réessaie.');
      }
      afficher();
      if (S.d.sessions.some((s) => s.status === 'AUTHORIZED' && (!s.last_sync || Date.now() - new Date(s.last_sync).getTime() > 6 * 3600e3))) synchroniser(true).then(afficher);
    } catch (e) {
      console.error(e);
      $('#app').innerHTML = `<div class="porte"><h1>Lumo ne répond pas.</h1><p class="accroche">Vérifie ta connexion, puis réessaie.</p><button class="bouton" onclick="location.reload()">Réessayer</button></div>`;
    }
  }
  sb.auth.onAuthStateChange((evt, session) => {
    setTimeout(() => { // hors du verrou d'authentification
      if (evt === 'PASSWORD_RECOVERY') ouvrir({ nom: 'mdp' });
      entrer(session);
    }, 0);
  });
  if (new URLSearchParams(location.search).has('exemple')) A.exemple();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
  window.Lumo = { S, afficher, charger }; // pour les tests
})();
