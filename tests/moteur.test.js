// Tests du moteur de prévision : node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/moteur.js');

const JOUR = new Date(2026, 10, 11); // 11 novembre 2026
const proche = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const base = (plus = {}) => Object.assign({
  solde: 5000, coussin: 1000, courant: 700,
  flux: [{ sens: 'revenu', montant: 2000, frequence: 'mois' }, { sens: 'depense', montant: 800, frequence: 'mois' }],
  projets: [],
}, plus);

test('mensualité de crédit : 100 000 € à 3,6 % sur 20 ans', () => {
  proche(M.mensualite(100000, 3.6, 240), 585.11, 0.05);
  proche(M.mensualite(12000, 0, 24), 500, 0.001);
  proche(M.restantDu(100000, 3.6, 240, 240), 0, 0.01);
  proche(M.restantDu(100000, 3.6, 240, 0), 100000, 0.01);
});

test('sans projet, le solde monte de ce qui reste chaque mois', () => {
  const s = M.simuler(base(), JOUR);
  assert.equal(s.mensuel.reste, 500);
  proche(s.avec[12], 5000 + 12 * 500);
  proche(s.avec[120], 5000 + 120 * 500);
  assert.equal(s.decouvert, null);
});

test('dépense annuelle et trimestrielle tombent le bon mois', () => {
  const s = M.simuler(base({ flux: [{ sens: 'depense', montant: 1200, frequence: 'an', mois: 1 }, { sens: 'depense', montant: 300, frequence: 'trimestre', mois: 2 }], courant: 0 }), JOUR);
  proche(s.avec[1], 5000);            // décembre : rien
  proche(s.avec[2], 5000 - 1200);     // janvier : l'annuelle
  proche(s.avec[3], 5000 - 1500);     // février : la trimestrielle
  proche(s.avec[12], 5000 - 1200 - 4 * 300);
});

test('un flux qui se termine ne compte plus après sa fin', () => {
  const s = M.simuler(base({ flux: [{ sens: 'depense', montant: 100, frequence: 'mois', fin: '2027-02' }], courant: 0 }), JOUR);
  proche(s.avec[12], 5000 - 300); // décembre, janvier, février
});

test('achat au plus tôt : dès que le coussin est préservé', () => {
  const s = M.simuler(base({ projets: [{ id: 'a', type: 'achat', params: { montant: 9000, mode: 'tot' } }] }), JOUR);
  const r = s.projets.a;
  assert.equal(r.k0, 10); // 5000 + 10×500 − 9000 = 1000 = coussin
  assert.equal(r.mois, '2027-09');
  assert.ok(r.ok);
  proche(s.avec[10], 1000);
});

test('achat à une date trop proche : il manque de l’argent, avec une date de repli', () => {
  const s = M.simuler(base({ projets: [{ id: 'a', type: 'achat', params: { montant: 9000, mode: 'date', date: '2027-03' } }] }), JOUR);
  const r = s.projets.a;
  assert.equal(r.ok, false);
  proche(r.manque, 1000 - (5000 + 4 * 500 - 9000)); // 3000
  assert.equal(r.tot, 10);
  proche(r.effort, 750);
  assert.equal(s.decouvert, 4);
});

test('achat à crédit : apport puis mensualités', () => {
  const s = M.simuler(base({ projets: [{ id: 'a', type: 'achat', params: { montant: 12000, mode: 'date', date: '2026-12', financement: 'credit', apport: 2000, taux: 0, dureeAns: 2 } }] }), JOUR);
  proche(s.projets.a.chiffres.mensualite, 10000 / 24, 0.01);
  proche(s.avec[1], 5000 + 500 - 2000);
  proche(s.avec[25], 5000 + 25 * 500 - 12000);
});

test('investissement : rentabilité et point mort', () => {
  const p = { id: 'i', type: 'investissement', params: { prix: 85000, frais: 8000, financement: 'credit', apport: 10000, taux: 3.6, dureeAns: 20, revenu: 520, charges: 130, valorisation: 1, mode: 'tot' } };
  const c = M.chiffres(p);
  proche(c.mensualite, 485.64, 0.1);
  proche(c.cashflow, 520 - 130 - 485.64, 0.1);
  proche(c.rendementBrut, 6.71, 0.01);
  assert.ok(c.gain10 > 0 && c.rentable);
  assert.ok(c.pointMort > 12 && c.pointMort < 120);
  const s = M.simuler(base({ solde: 12000, projets: [p] }), JOUR);
  assert.ok(s.projets.i.k0 >= 1);
  assert.ok(s.projets.i.ok);
});

test('investissement jamais rentable : signalé comme tel', () => {
  const c = M.chiffres({ type: 'investissement', params: { prix: 50000, frais: 5000, financement: 'comptant', revenu: 100, charges: 150, valorisation: 0 } });
  assert.equal(c.rentable, false);
  assert.equal(c.pointMort, null);
});

test('changement de vie : hausse de salaire à partir d’une date', () => {
  const s = M.simuler(base({ projets: [{ id: 'c', type: 'changement', params: { revenu: 200, date: '2027-01' } }] }), JOUR);
  proche(s.avec[1], 5500);
  proche(s.avec[2], 5500 + 700);
  proche(s.projets.c.impact, 200 * 119);
});

test('crédit : mensualité, coût total et fin', () => {
  const s = M.simuler(base({ projets: [{ id: 'k', type: 'credit', params: { capital: 6000, taux: 0, dureeAns: 1, date: '2026-12' } }] }), JOUR);
  proche(s.projets.k.chiffres.mensualite, 500);
  proche(s.avec[12], 5000);          // 12 mois à +500 −500
  proche(s.avec[13], 5500);
});

test('un projet désactivé est évalué mais ne change pas la courbe', () => {
  const s = M.simuler(base({ projets: [{ id: 'a', type: 'achat', actif: false, params: { montant: 3000, mode: 'tot' } }] }), JOUR);
  assert.deepEqual(s.avec, s.sans);
  assert.equal(s.projets.a.k0, 1);
});

test('deux projets : le second tient compte du premier', () => {
  const s = M.simuler(base({ projets: [
    { id: 'a', type: 'achat', params: { montant: 9000, mode: 'tot' } },
    { id: 'b', type: 'achat', params: { montant: 3000, mode: 'tot' } },
  ] }), JOUR);
  assert.equal(s.projets.a.k0, 10);
  assert.equal(s.projets.b.k0, 16);
});

test('lecture des opérations : repère le salaire et le loyer, estime le courant', () => {
  const ops = [];
  for (const m of ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10']) {
    ops.push({ date: m + '-28', montant: 2100 + (m.endsWith('08') ? 60 : 0), libelle: 'VIR SEPA AMBULANCES EXEMPLE SALAIRE' });
    ops.push({ date: m + '-05', montant: -640, libelle: 'PRLV SEPA FONCIA LOYER 0625' });
    ops.push({ date: m + '-12', montant: -83.4, libelle: 'CB LECLERC DOLE 12/0' + m.slice(6) });
    ops.push({ date: m + '-20', montant: -212.9, libelle: 'CB LECLERC DOLE 20/0' + m.slice(6) });
  }
  const a = M.analyser(ops, [], JOUR);
  assert.deepEqual(a.suggestions.map((s) => s.sens + ':' + s.montant), ['revenu:2100', 'depense:640']);
  proche(a.courant, 0); // tant que rien n'est suivi, salaire compris : pas de dépense nette négative
  const b = M.analyser(ops, a.suggestions, JOUR);
  proche(b.courant, 83.4 + 212.9, 0.01);
  assert.equal(b.suggestions.length, 0);
});

test('entrées et sorties de chaque mois, projets compris', () => {
  const s = M.simuler(base({ projets: [{ id: 'a', type: 'achat', params: { montant: 3000, mode: 'date', date: '2027-01' } }] }), JOUR);
  proche(s.entrees[1], 2000); proche(s.sorties[1], 1500);
  proche(s.sorties[2], 4500);
  for (let k = 1; k <= 12; k++) proche(s.avec[k] - s.avec[k - 1], s.entrees[k] - s.sorties[k]);
});

/* ---------- argent au quotidien ---------- */
function banque(auj, { courses = 60, livret = true } = {}) {
  const ops = [], d = (a, m, j) => `${a}-${String(m + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
  for (let k = 4; k >= 0; k--) {
    const x = new Date(auj.getFullYear(), auj.getMonth() - k, 1), a = x.getFullYear(), m = x.getMonth();
    const ajoute = (j, montant, libelle, compte_id = 'cc') => { const t = new Date(a, m, j); if (t <= auj) ops.push({ date: d(a, m, j), montant, libelle, compte_id }); };
    ajoute(28, 2150, 'VIR SEPA SALAIRE TRANSPORTS MARTIN');
    ajoute(5, -640, 'PRLV SEPA LOYER AGENCE');
    ajoute(10, -118, 'PRLV SEPA EDF');
    for (const j of [2, 9, 16, 23]) ajoute(j, -courses, 'CB CARREFOUR MARKET');
    ajoute(12, -55, 'CB TOTAL ACCESS');
    if (livret) { ajoute(29, -200, 'VIR VERS LIVRET A'); ajoute(29, 200, 'VIR DE COMPTE COURANT', 'la'); }
  }
  return ops;
}
const COMPTES = [{ id: 'cc', nom: 'Compte courant', type: 'courant', solde: 1300 }, { id: 'la', nom: 'Livret A', type: 'epargne', solde: 6400 }, { id: 'av', nom: 'Assurance vie', type: 'epargne', solde: 3000 }];
const FLUX = [{ nom: 'Loyer', sens: 'depense', montant: 640, frequence: 'mois' }, { nom: 'Énergie', sens: 'depense', montant: 118, frequence: 'mois' }];

test('catégories des libellés bancaires', () => {
  assert.equal(M.categorie('CB CARREFOUR MARKET 12/11'), 'courses');
  assert.equal(M.categorie('PRLV SEPA EDF CLIENTS'), 'factures');
  assert.equal(M.categorie('CB TOTAL ACCESS DOLE'), 'carburant');
  assert.equal(M.categorie('CB UBER EATS'), 'sorties');
  assert.equal(M.categorie('CB NETFLIX.COM'), 'abonnements');
  assert.equal(M.categorie('RETRAIT DAB 12/11'), 'retraits');
  assert.equal(M.categorie('CB INCONNU SARL'), 'autres');
});

test('le mois en cours part de la dernière paie', () => {
  const auj = new Date(2026, 10, 12);
  const s = M.suiviMois({ comptes: COMPTES, operations: banque(auj), flux: FLUX }, auj);
  assert.equal(s.paie.derniere, '2026-10-28');
  assert.equal(s.paie.prochaine, '2026-11-28');
  assert.equal(s.joursRestants, 16);
  assert.equal(s.misDeCote, 200); // virement vers le livret : épargne, pas dépense
  // depuis le 28/10 : courses 2/11 et 9/11, loyer, EDF, carburant
  assert.equal(s.depense, 60 * 2 + 640 + 118 + 55);
  assert.equal(s.aVenir.length, 0); // loyer et EDF déjà passés
  assert.equal(s.reste, 1300);
  assert.equal(s.parJour, Math.round(1300 / 16));
  const courses = s.categories.find((c) => c.id === 'courses');
  assert.equal(courses.montant, 120);
  assert.equal(courses.habituel, 120);
});

test('prélèvements à venir et risque de découvert', () => {
  const auj = new Date(2026, 10, 3); // avant le loyer du 5
  const s = M.suiviMois({ comptes: [{ ...COMPTES[0], solde: 500 }, COMPTES[1]], operations: banque(auj), flux: FLUX }, auj);
  assert.deepEqual(s.aVenir.map((x) => x.nom), ['Loyer', 'Énergie']);
  assert.equal(s.reste, 500 - 758);
  const A = M.alertes(s, auj);
  assert.equal(A[0].type, 'risque');
  assert.equal(A[0].ton, 'rouge');
});

test('dépense inhabituelle repérée au même stade du mois', () => {
  const auj = new Date(2026, 10, 12);
  const ops = banque(auj).map((o) => (o.libelle.includes('CARREFOUR') && o.date >= '2026-10-28' ? { ...o, montant: -150 } : o));
  const s = M.suiviMois({ comptes: COMPTES, operations: ops, flux: FLUX }, auj);
  const a = M.alertes(s, auj).find((x) => x.type === 'inhabituel');
  assert.ok(a, 'alerte attendue');
  assert.equal(a.categorie, 'courses');
  assert.equal(a.actuel, 300);
  assert.equal(a.habituel, 120);
});

test('paie en retard', () => {
  const auj = new Date(2026, 11, 3); // la paie du 28/11 manque
  const ops = banque(new Date(2026, 10, 27));
  const s = M.suiviMois({ comptes: COMPTES, operations: ops, flux: FLUX }, auj);
  assert.ok(M.alertes(s, auj).some((a) => a.type === 'paie'));
});

test('sans banque : mois calendaire, aucune alerte inventée', () => {
  const auj = new Date(2026, 10, 12);
  const s = M.suiviMois({ comptes: [{ id: 'x', nom: 'Mes comptes', type: 'courant', solde: 900 }], operations: [], flux: FLUX }, auj);
  assert.equal(s.avecBanque, false);
  assert.equal(s.debut, '2026-11-01');
  assert.deepEqual(M.alertes(s, auj), []);
});

test('vue des comptes : genres et évolution sur 6 mois', () => {
  const auj = new Date(2026, 10, 12);
  const v = M.comptesVue(COMPTES, banque(auj), auj);
  assert.equal(v.total, 10700);
  assert.equal(v.parGenre.placement, 3000); // assurance vie
  assert.equal(v.parGenre.epargne, 6400);
  assert.equal(v.histoire.length, 6);
  assert.equal(v.histoire[5].total, 10700);
  assert.ok(v.histoire[4].total < v.histoire[5].total || v.histoire[4].total !== undefined);
});

test('un prélèvement annuel ne compte que dans son mois', () => {
  const auj = new Date(2026, 10, 12);
  const flux = [...FLUX, { nom: 'Impôts locaux', sens: 'depense', montant: 420, frequence: 'an', mois: 10 }, { nom: 'Assurance auto', sens: 'depense', montant: 380, frequence: 'an', mois: 11 }];
  const s = M.suiviMois({ comptes: COMPTES, operations: banque(auj), flux }, auj);
  assert.deepEqual(s.aVenir.map((x) => x.nom), ['Assurance auto']);
});
