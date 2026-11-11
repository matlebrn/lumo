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
