// Gratuit ou Lumo Plus : ce que chaque formule permet.
// Le serveur garde le plan de chaque personne (table « droits », non modifiable depuis l'appli) et applique
// lui-même les limites qui comptent (questions à Lumi, banques). L'appli ne fait qu'afficher.
export type Plan = 'gratuit' | 'plus';

export const LIMITES = {
  gratuit: { banques: 1, horizonMois: 12, projets: 1, lumiParJour: 3, historiqueMois: 3, planComplet: false, patrimoine: false, automatique: false },
  plus: { banques: Infinity, horizonMois: 120, projets: Infinity, lumiParJour: 200, historiqueMois: 12, planComplet: true, patrimoine: true, automatique: true },
} as const;

export type Droit = keyof typeof LIMITES['gratuit'];
export const limite = <D extends Droit>(plan: Plan, d: D) => LIMITES[plan][d];
