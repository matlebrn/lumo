// Les outils de Lumi : il doit retrouver des opérations précises et donner des chiffres exacts.
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../packages/moteur/outils.js');

const ops = [];
for (let m = 1; m <= 10; m++) {
  const mm = String(m).padStart(2, '0');
  ops.push({ date: `2026-${mm}-05`, montant: -640, libelle: 'PRLV SEPA LOYER AGENCE DU CENTRE', compte_id: 'cc' });
  if (m >= 3) ops.push({ date: `2026-${mm}-10`, montant: -189.9, libelle: 'PRLV CETELEM CREDIT AUTO', compte_id: 'cc' });
  ops.push({ date: `2026-${mm}-28`, montant: 2150, libelle: 'VIR SALAIRE TRANSPORTS MARTIN', compte_id: 'cc' });
  ops.push({ date: `2026-${mm}-29`, montant: -200, libelle: 'VIR VERS LIVRET A', compte_id: 'cc' }, { date: `2026-${mm}-29`, montant: 200, libelle: 'VIR DE COMPTE COURANT', compte_id: 'la' });
}
ops.push({ date: '2026-02-14', montant: -1200, libelle: 'CB GARAGE DU JURA', compte_id: 'cc' });
const P = O.preparer({ operations: ops, comptes: [{ id: 'cc', nom: 'Compte courant', type: 'courant', solde: 900 }, { id: 'la', nom: 'Livret A', type: 'epargne', solde: 3000 }], classements: {}, flux: [], projets: [], profil: { coussin: 1000 } });

test('« mon premier loyer » : la plus ancienne opération du loyer', () => {
  const r = O.executer(P, 'chercher_operations', { mots: ['loyer'], tri: 'ancien', limite: 1 });
  assert.equal(r.nombre, 10);
  assert.equal(r.premiere.date, '2026-01-05');
  assert.equal(r.operations[0].date, '2026-01-05');
  assert.equal(r.historique_disponible.du, '2026-01-05');
});

test('« tous mes versements pour ma voiture » : crédit auto et garage, total exact', () => {
  const r = O.executer(P, 'chercher_operations', { mots: ['CREDIT AUTO', 'GARAGE'], sens: 'depense' });
  assert.equal(r.nombre, 9);
  assert.equal(r.total, -(8 * 189.9 + 1200));
  assert.equal(r.premiere.libelle, 'CB GARAGE DU JURA');
});

test('regrouper par mois et par catégorie', () => {
  const m = O.executer(P, 'regrouper', { par: 'mois', mots: ['CETELEM'] });
  assert.equal(m.groupes.length, 8);
  assert.equal(m.groupes[0].groupe, '2026-03');
  const c = O.executer(P, 'regrouper', { par: 'categorie', sens: 'depense' });
  assert.equal(c.groupes[0].groupe, 'Logement et énergie');
});

test('les virements vers le livret ne sont pas des dépenses, sauf si on les demande', () => {
  assert.equal(O.executer(P, 'chercher_operations', { mots: ['LIVRET'] }).nombre, 0);
  assert.equal(O.executer(P, 'chercher_operations', { mots: ['LIVRET'], inclure_internes: true }).nombre, 10);
});

test('libellés pour retrouver un nom, outils inconnus refusés, listes plafonnées', () => {
  const l = O.executer(P, 'libelles', { sens: 'depense' });
  assert.ok(l.libelles.some((x) => /CETELEM/.test(x.libelle) && x.premiere === '2026-03-10'));
  assert.ok(O.executer(P, 'supprimer_tout', {}).erreur);
  assert.ok(O.executer(P, 'chercher_operations', { limite: 9999 }).operations.length <= 50);
  assert.equal(O.executer(P, 'comptes').comptes.length, 2);
});

test('le serveur décrit exactement les outils que le téléphone sait exécuter, avec les mêmes catégories', () => {
  const fs = require('node:fs'), path = require('node:path'), M = require('../packages/moteur/moteur.js');
  const src = fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/lumi/index.ts'), 'utf8');
  const permis = JSON.parse(src.match(/OUTILS_PERMIS = new Set\((\[[^\]]+\])\)/)[1]);
  assert.deepEqual([...permis].sort(), [...O.NOMS].sort());
  const cats = JSON.parse(src.match(/categorie: \{ type: "string", enum: (\[[^\]]+\])/)[1]);
  assert.deepEqual(cats.sort(), [...M.CHOIX_DEPENSE].sort());
});
