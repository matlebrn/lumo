/* Lumo · les outils de Lumi. Lumi ne voit jamais toutes les opérations d'un coup : il pose des questions
   précises (chercher, regrouper, lister les libellés…) et ces fonctions lui répondent avec des chiffres exacts.
   Fonctions pures : elles reçoivent les données de la personne, déjà filtrées par le serveur, et ne font que lire.
   Ils tournent sur le téléphone : le serveur ne lit jamais la banque pour Lumi, il relaie seulement. */
(function (root, fabrique) {
  if (typeof module !== 'undefined' && module.exports) module.exports = fabrique(require('./moteur.js'));
  else root.LumiOutils = fabrique(root.Moteur);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';
  const PLAFOND = 50;
  const sansAccent = (t) => String(t || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const arrondi = (v) => Math.round(v * 100) / 100;
  const dateOk = (s) => typeof s === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(s);

  /** Prépare les opérations une fois : catégorie, virements internes, compte. */
  function preparer(d) {
    const regles = d.classements || {};
    const noms = new Map((d.comptes || []).map((c) => [c.id, c.nom]));
    const L = M.listeOperations(d.operations || [], d.comptes || [], regles).map((o) => ({
      date: o.date, montant: arrondi(+o.montant), libelle: String(o.libelle || '').slice(0, 90),
      contrepartie: o.contrepartie ? String(o.contrepartie).slice(0, 60) : null, en_cours: !!o.enCours,
      categorie: o.categorie, interne: o.interne, compte: noms.get(o.compte_id) || null, cle: sansAccent(`${o.libelle || ''} ${o.contrepartie || ''}`),
    }));
    const dates = L.map((o) => o.date).sort();
    return { ...d, L, couverture: dates.length ? { du: dates[0], au: dates[dates.length - 1], operations: dates.length } : null };
  }

  function filtrer(P, a) {
    a = a || {};
    const mots = (Array.isArray(a.mots) ? a.mots : a.mots ? [a.mots] : []).map(sansAccent).filter(Boolean).slice(0, 10);
    const min = a.montant_min != null ? Math.abs(+a.montant_min) : null, max = a.montant_max != null ? Math.abs(+a.montant_max) : null;
    return P.L.filter((o) => {
      if (!a.inclure_internes && o.interne) return false;
      if (a.sens === 'depense' && o.montant >= 0) return false;
      if (a.sens === 'rentree' && o.montant < 0) return false;
      if (a.categorie && o.categorie !== a.categorie) return false;
      if (dateOk(a.depuis) && o.date < a.depuis) return false;
      if (dateOk(a.jusqua) && o.date.slice(0, a.jusqua.length) > a.jusqua) return false;
      if (min != null && Math.abs(o.montant) < min) return false;
      if (max != null && Math.abs(o.montant) > max) return false;
      if (mots.length && !mots.some((m) => o.cle.includes(m))) return false;
      return true;
    });
  }
  const somme = (L) => arrondi(L.reduce((s, o) => s + o.montant, 0));
  const court = (o) => ({ date: o.date, montant: o.montant, libelle: o.libelle, ...(o.contrepartie ? { qui: o.contrepartie } : {}), ...(o.en_cours ? { en_cours: true } : {}), categorie: M.NOM_CAT[o.categorie] || o.categorie, compte: o.compte });

  const OUTILS = {
    chercher_operations(P, a) {
      const L = filtrer(P, a);
      const tri = a && a.tri, T = L.slice();
      if (tri === 'ancien') T.sort((x, y) => (x.date < y.date ? -1 : 1));
      else if (tri === 'gros') T.sort((x, y) => Math.abs(y.montant) - Math.abs(x.montant));
      else T.sort((x, y) => (x.date < y.date ? 1 : -1));
      const n = Math.max(1, Math.min(PLAFOND, +((a && a.limite) || 20)));
      const parDate = L.slice().sort((x, y) => (x.date < y.date ? -1 : 1));
      return {
        historique_disponible: P.couverture, nombre: L.length, total: somme(L),
        total_depenses: somme(L.filter((o) => o.montant < 0)), total_rentrees: somme(L.filter((o) => o.montant > 0)),
        premiere: parDate.length ? court(parDate[0]) : null, derniere: parDate.length ? court(parDate[parDate.length - 1]) : null,
        operations: T.slice(0, n).map(court), affichees: Math.min(n, T.length),
      };
    },
    regrouper(P, a) {
      const par = (a && a.par) || 'mois', L = filtrer(P, a), G = new Map();
      for (const o of L) {
        const k = par === 'categorie' ? (M.NOM_CAT[o.categorie] || o.categorie) : par === 'libelle' ? (M.cle(o.libelle) || o.libelle) : par === 'compte' ? (o.compte || 'Inconnu') : o.date.slice(0, 7);
        const g = G.get(k) || { groupe: k, nombre: 0, total: 0 }; g.nombre++; g.total += o.montant; G.set(k, g);
      }
      const R = [...G.values()].map((g) => ({ ...g, total: arrondi(g.total) }));
      R.sort(par === 'mois' ? (x, y) => (x.groupe < y.groupe ? -1 : 1) : (x, y) => Math.abs(y.total) - Math.abs(x.total));
      return { historique_disponible: P.couverture, par, nombre: L.length, total: somme(L), groupes: R.slice(0, 40) };
    },
    libelles(P, a) {
      const L = filtrer(P, a), G = new Map();
      for (const o of L) {
        const k = M.cle(o.libelle) || o.libelle;
        const g = G.get(k) || { libelle: o.libelle, nombre: 0, total: 0, premiere: o.date, derniere: o.date, categorie: M.NOM_CAT[o.categorie] || o.categorie };
        g.nombre++; g.total += o.montant; if (o.date < g.premiere) g.premiere = o.date; if (o.date > g.derniere) g.derniere = o.date; G.set(k, g);
      }
      const R = [...G.values()].map((g) => ({ ...g, total: arrondi(g.total) })).sort((x, y) => Math.abs(y.total) - Math.abs(x.total));
      return { historique_disponible: P.couverture, differents: R.length, libelles: R.slice(0, 40) };
    },
    comptes(P) {
      return { comptes: (P.comptes || []).map((c) => ({ nom: c.nom, type: M.genre(c), solde: arrondi(+c.solde), ...(c.solde_dispo != null ? { disponible: arrondi(+c.solde_dispo) } : {}), ...(c.decouvert != null ? { decouvert_autorise: arrondi(Math.abs(+c.decouvert)) } : {}), banque: c.banque || (c.source === 'banque' ? 'Banque' : 'Saisi à la main') })), operations_en_cours: somme(P.L.filter((o) => o.en_cours)), historique_disponible: P.couverture };
    },
    paie(P) {
      const a = M.analysePaie(P.operations || [], P.comptes || []);
      return a ? { trouvee: true, ...a, historique_disponible: P.couverture } : { trouvee: false, raison: 'Pas de revenu régulier de 400 € ou plus sur au moins 2 mois', historique_disponible: P.couverture };
    },
    budget(P) {
      return {
        revenus_et_depenses_reguliers: (P.flux || []).filter((f) => f.actif !== false).map((f) => ({ nom: f.nom, sens: f.sens, montant: +f.montant, frequence: f.frequence, debut: f.debut || null, fin: f.fin || null })),
        projets: (P.projets || []).map((p) => ({ nom: p.nom, type: p.type, compte_dans_la_prevision: p.actif !== false, chiffres: p.params })),
        coussin_de_securite: +(P.profil && P.profil.coussin) || 0,
      };
    },
  };

  // Les descriptions des outils données au modèle sont sur le serveur (supabase/functions/lumi) : il fait foi.
  function executer(P, nom, args) {
    const f = Object.prototype.hasOwnProperty.call(OUTILS, nom) ? OUTILS[nom] : null;
    if (!f) return { erreur: `Outil inconnu : ${nom}` };
    try { return f(P, args && typeof args === 'object' ? args : {}); } catch (e) { return { erreur: 'Calcul impossible' }; }
  }
  return { preparer, executer, NOMS: Object.keys(OUTILS) };
});
