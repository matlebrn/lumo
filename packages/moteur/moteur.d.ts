// Types du moteur de calcul de Lumo (moteur.js), partagé par l'appli web et l'appli mobile.
// Le moteur ne fait que des calculs : aucune donnée n'y entre ni n'en sort sans passer par l'appli.

export type Sens = 'revenu' | 'depense';
export type Frequence = 'mois' | 'trimestre' | 'an';
export type TypeCompte = 'courant' | 'epargne' | 'placement';
export type TypeProjet = 'achat' | 'investissement' | 'changement' | 'credit';
export type Groupe = 'besoin' | 'envie';
export type Ton = 'bon' | 'alerte' | 'rouge';

export interface Compte { id: string; nom: string; type: TypeCompte; solde: number | string; source?: 'manuel' | 'banque'; banque?: string | null; inclus?: boolean; iban?: string | null; solde_dispo?: number | string | null; decouvert?: number | string | null; devise?: string | null }
export interface Operation { id?: string; date: string; montant: number | string; libelle?: string | null; compte_id?: string | null; contrepartie?: string | null; contrepartie_iban?: string | null; mcc?: string | null; date_valeur?: string | null; code_banque?: string | null; statut?: 'BOOK' | 'PDNG' | null }
export interface Flux { id?: string; nom: string; sens: Sens; montant: number | string; frequence: Frequence; mois?: number | null; debut?: string | null; fin?: string | null; evolution?: number | string; cle?: string | null; actif?: boolean }
export interface Projet { id: string; type: TypeProjet; nom: string; params: Record<string, any>; actif?: boolean; ordre?: number }
export type Regles = Record<string, string>;

export interface Simulation {
  t0: number; solde: number; coussin: number;
  avec: number[]; sans: number[]; entrees: number[]; sorties: number[];
  decouvert: number | null; sousCoussin: number | null;
  projets: Record<string, any>;
  mensuel: { revenus: number; fixes: number; courant: number; reste: number };
  mois: (k: number) => string;
}
export interface EtatSimulation { solde: number; coussin: number; courant: number; flux: Flux[]; projets: Projet[] }

export interface CategorieMois { id: string; nom: string; montant: number; habituel: number | null }
export interface Suivi {
  debut: string; fin: string; joursRestants: number; duree: number; ecoules: number;
  paie: { nom: string; montant: number; derniere: string; prochaine: string } | null;
  avecBanque: boolean; historique: number; soldeCourant: number; enCours: number; decouvertAutorise: number | null; soldeDispo: number | null; depense: number; entrees: number; misDeCote: number;
  categories: CategorieMois[]; aVenir: { nom: string; montant: number }[]; totalAVenir: number; reste: number;
  parJour: number | null; variableParJour: number | null;
  operations: { date: string; montant: number; libelle?: string; contrepartie?: string | null; enCours?: boolean; categorie: string; id?: string }[];
}
export interface Alerte { ton: Ton; type: 'plafond' | 'decouvert' | 'risque' | 'paie' | 'inhabituel'; titre: string; montant?: number; quand?: string; categorie?: string; actuel?: number; habituel?: number }
export interface VueComptes { comptes: (Compte & { genre: TypeCompte; solde: number })[]; total: number; parGenre: Record<TypeCompte, number>; histoire: { mois: string; total: number }[] | null; variation: number | null }

export interface Point { ton: Ton; titre: string; texte: string }
export interface Etape { titre: string; texte: string; gain: number }
export interface MoisBilan { i: number; mois: string; enCours: boolean; entrees: number; sorties: number; net: number; misDeCote: number; cats: Record<string, number>; ops: number }
export interface CategorieBilan { id: string; nom: string; groupe: Groupe; montant: number; part: number; avant: number | null; serie: number[] }
export interface Bilan {
  paie?: Paie | null; avecBanque: boolean; assez: boolean; mois: MoisBilan[]; aClasser: number;
  revenus?: number; depenses?: number; net?: number; taux?: number | null;
  categories?: CategorieBilan[]; besoins?: number; envies?: number;
  repartition?: { besoins: number; envies: number; epargne: number } | null;
  credits?: number; endettement?: number | null; epargneDispo?: number; placements?: number; moisSecurite?: number | null;
  joursRouge?: number; plusBas?: number | null; frais?: number;
  abonnements?: { nom: string; montant: number; parAn: number }[]; totalAbos?: number; totalAbosAn?: number;
  note?: number; niveau?: { ton: Ton; nom: string }; difficulte?: boolean;
  va?: Point[]; vaPas?: Point[]; plan?: Etape[]; gains?: number; nbMois?: number;
}
export interface OperationListee { id?: string; date: string; montant: number; libelle?: string; contrepartie?: string | null; mcc?: string | null; enCours?: boolean; compte_id?: string; interne: boolean; categorie: string; cle: string; hesite: boolean }

export const H: number;
export function n(v: unknown): number;
export function ym(d: Date): number;
export function lireYM(s?: string | null): number | null;
export function ecrireYM(i: number): string;
export function mensualite(capital: number, taux: number, mois: number): number;
export function parMois(f: Flux): number;
export function simuler(etat: EtatSimulation, maintenant?: Date): Simulation;
export function analyser(operations: Operation[], flux: Flux[], maintenant?: Date): { reguliers: any[]; suggestions: any[]; courant: number | null };
export function cle(libelle?: string | null): string;
export function categorie(o: Operation | string, regles?: Regles): string;
export function genre(c: Compte): TypeCompte;
export function suiviMois(d: { comptes: Compte[]; operations: Operation[]; flux: Flux[]; regles?: Regles }, maintenant?: Date): Suivi;
export function comptesVue(comptes: Compte[], operations: Operation[], maintenant?: Date): VueComptes;
export function alertes(suivi: Suivi, maintenant?: Date): Alerte[];
export function cleRegle(o: Operation): string;
export function aClasser(o: Operation, regles?: Regles): boolean;
export function bilan(d: { operations: Operation[]; comptes: Compte[]; flux: Flux[]; regles?: Regles; mensuel?: Simulation['mensuel'] }, maintenant?: Date): Bilan;
export function listeOperations(operations: Operation[], comptes: Compte[], regles?: Regles): OperationListee[];
export const NOM_CAT: Record<string, string>;
export const GROUPE: Record<string, Groupe>;
export const CHOIX_DEPENSE: string[];
export const CHOIX_RENTREE: string[];
export interface Paie { nom: string; jourHabituel: number; derniere: string; prochaine: string; moyenne: number; habituelle: number; mois: { mois: string; montant: number }[]; primes: { mois: string; montant: number; enPlus: number }[]; nbMois: number; evolution: number | null }
export function analysePaie(operations: Operation[], comptes: Compte[], maintenant?: Date): Paie | null;
export function parMcc(mcc: string | number): string | null;
export function marquerInternes(ops: Operation[], comptes: Compte[], regles?: Regles): any[];
