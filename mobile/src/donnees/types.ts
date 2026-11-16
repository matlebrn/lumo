import type { Compte, Flux, Operation, Projet, Regles } from '@moteur';
import type { Plan } from '@/droits';
import type { StyleLumi } from '@/lumi/styles';

export type Situation = 'etudiant' | 'salarie' | 'famille' | 'independant' | 'retraite';
export type Objectif = 'finDeMois' | 'projet' | 'grossir' | 'sortir';

export interface Profil {
  prenom: string; coussin: number; courant_manuel: number | null; ignores: string[]; pret: boolean;
  situation: Situation | null; objectif: Objectif | null; style_lumi: StyleLumi;
}
export interface Donnees {
  profil: Profil; comptes: Compte[]; flux: Flux[]; projets: Projet[]; operations: Operation[];
  classements: Regles; plan: Plan;
}
