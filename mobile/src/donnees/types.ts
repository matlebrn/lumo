import type { Compte, Flux, Operation, Projet, Regles } from '@moteur';
import type { Plan } from '@/droits';
import type { StyleLumi } from '@/lumi/styles';

export type Situation = 'etudiant' | 'salarie' | 'famille' | 'independant' | 'retraite';
export type Objectif = 'finDeMois' | 'projet' | 'grossir' | 'sortir';

export interface Profil {
  prenom: string; coussin: number; courant_manuel: number | null; ignores: string[]; pret: boolean;
  situation: Situation | null; objectif: Objectif | null; style_lumi: StyleLumi; jour_paie?: number | null;
}
/** Un accès à une banque (DSP2) : valable environ 180 jours, à renouveler ensuite. */
export interface Session { session_id: string; bank: string; status: string; last_sync: string | null; valid_until: string | null; error: string | null }
export interface Donnees {
  profil: Profil; comptes: Compte[]; flux: Flux[]; projets: Projet[]; operations: Operation[];
  classements: Regles; plan: Plan; sessions: Session[];
}
