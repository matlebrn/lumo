// Types des outils de Lumi (outils.js) : recherches en lecture seule sur les données de la personne.
import type { Compte, Flux, Operation, Projet, Regles } from './moteur';
export interface DonneesOutils { operations: Operation[]; comptes: Compte[]; flux?: Flux[]; projets?: Projet[]; classements?: Regles; profil?: { coussin?: number } }
export type Prepare = DonneesOutils & { couverture: { du: string; au: string; operations: number } | null };
export function preparer(d: DonneesOutils): Prepare;
export function executer(P: Prepare, nom: string, args: unknown): Record<string, unknown>;
export const NOMS: string[];
