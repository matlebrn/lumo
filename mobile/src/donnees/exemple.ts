// Un an de banque inventé, toujours le même : sert à découvrir Lumo sans compte, et aux tests.
import type { Operation } from '@moteur';
import type { Donnees } from './types';

function operations(): Operation[] {
  let graine = 7; const alea = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
  const auj = new Date(), L: Operation[] = [];
  const ajoute = (x: Date, j: number, montant: number, libelle: string, compte_id = 'ex-cc') => {
    const d = new Date(x.getFullYear(), x.getMonth(), j);
    if (d <= auj) L.push({ date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`, montant: Math.round(montant * 100) / 100, libelle, compte_id });
  };
  for (let k = 12; k >= 0; k--) {
    const x = new Date(auj.getFullYear(), auj.getMonth() - k, 1), recent = k === 0 || (k === 1 && auj.getDate() < 28);
    if (k <= 4) ajoute(x, 19, -9.99, 'CB DISNEY PLUS');
    ajoute(x, 3, -24.99, 'PRLV BASIC FIT');
    ajoute(x, 7, -(9 + alea() * 25), 'CB SARL LE COMPTOIR DOLOIS');
    if (k <= 2) ajoute(x, 24, -(60 + alea() * 50), 'CB LE BISTROT DU PORT');
    if (k === 2) ajoute(x, 30, -8, 'COMMISSION INTERVENTION');
    ajoute(x, 28, 2150, 'VIR SEPA SALAIRE TRANSPORTS MARTIN');
    ajoute(x, 5, -640, 'PRLV SEPA LOYER AGENCE DU CENTRE');
    ajoute(x, 10, -118, 'PRLV SEPA EDF CLIENTS PARTICULIERS');
    ajoute(x, 12, -96, 'PRLV SEPA MAIF ASSURANCE');
    ajoute(x, 15, -13.49, 'CB NETFLIX.COM'); ajoute(x, 17, -10.99, 'CB SPOTIFY');
    for (const j of [2, 6, 9, 13, 16, 20, 23, 27]) ajoute(x, j, -(28 + alea() * 55) * (recent ? 1.35 : 1), alea() > 0.5 ? 'CB CARREFOUR MARKET' : 'CB E.LECLERC');
    for (const j of [8, 21]) ajoute(x, j, -(48 + alea() * 18), 'CB TOTAL ACCESS');
    for (const j of [11, 25]) ajoute(x, j, -(14 + alea() * 30), alea() > 0.5 ? 'CB UBER EATS' : 'CB LA BRASSERIE');
    ajoute(x, 18, -(20 + alea() * 60), 'CB AMAZON PAYMENTS');
    ajoute(x, 29, -200, 'VIR VERS LIVRET A'); ajoute(x, 29, 200, 'VIR DE COMPTE COURANT', 'ex-la');
  }
  return L.sort((a, b) => (a.date < b.date ? 1 : -1)).map((o, i) => ({ ...o, id: `ex-${i}` }));
}

export function exemple(): Donnees {
  const id = (s: string) => `ex-${s}`;
  return {
    plan: 'gratuit', classements: {},
    profil: { prenom: '', coussin: 2000, courant_manuel: 780, ignores: [], pret: true, situation: 'salarie', objectif: 'projet', style_lumi: 'coach' },
    comptes: [
      { id: 'ex-cc', nom: 'Compte courant', type: 'courant', solde: 1480, source: 'banque', banque: 'Exemple', inclus: true },
      { id: 'ex-la', nom: 'Livret A', type: 'epargne', solde: 6400, source: 'banque', banque: 'Exemple', inclus: true },
      { id: 'ex-av', nom: 'Assurance vie', type: 'placement', solde: 3200, source: 'manuel', inclus: false },
    ],
    flux: [
      { id: id('f1'), nom: 'Salaire', sens: 'revenu', montant: 2150, frequence: 'mois', evolution: 1.5, actif: true },
      { id: id('f2'), nom: 'Loyer', sens: 'depense', montant: 640, frequence: 'mois', evolution: 0, actif: true },
      { id: id('f3'), nom: 'Énergie et internet', sens: 'depense', montant: 118, frequence: 'mois', evolution: 0, actif: true },
      { id: id('f4'), nom: 'Assurances', sens: 'depense', montant: 96, frequence: 'mois', evolution: 0, actif: true },
      { id: id('f5'), nom: 'Netflix', sens: 'depense', montant: 13.49, frequence: 'mois', evolution: 0, actif: true },
      { id: id('f6'), nom: 'Impôts locaux', sens: 'depense', montant: 420, frequence: 'an', mois: 10, evolution: 0, actif: true },
    ],
    projets: [
      { id: id('p1'), type: 'achat', nom: 'Voiture d’occasion', actif: true, ordre: 0, params: { montant: 9000, mode: 'tot', financement: 'comptant' } },
      { id: id('p2'), type: 'investissement', nom: 'Studio locatif', actif: true, ordre: 1, params: { prix: 78000, frais: 7500, mode: 'tot', financement: 'credit', apport: 8000, taux: 3.6, dureeAns: 20, revenu: 510, charges: 120, valorisation: 1 } },
    ],
    operations: operations(),
  };
}
