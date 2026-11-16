// t('aujourdhui.bonjour', { prenom }) et les formats (euros, mois, jours) selon la langue.
import { fr } from './fr';

const langues = { fr } as const;
type Dico = typeof fr;
let langue: keyof typeof langues = 'fr';
export const locale = () => ({ fr: 'fr-FR' })[langue];

export function t(chemin: string, vars?: Record<string, string | number>): string {
  const v = chemin.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), langues[langue] as Dico);
  if (typeof v !== 'string') return chemin;
  if (!vars) return v;
  // « (s) » devient « s » au pluriel, disparaît au singulier, d'après la variable n
  const texte = 'n' in vars ? v.replace(/\(s\)/g, +vars.n > 1 ? 's' : '') : v;
  return texte.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

const NB = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
// « 1 234 € », « −50 € », « +207 € » avec signe
export const eur = (v: number | null | undefined, signe = false) => {
  const x = Math.round(Number(v) || 0);
  return (signe && x > 0 ? '+' : '') + NB.format(x).replace('-', '−').replace(/ | /g, ' ') + ' €';
};
export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const moisLong = (ym?: string) => (ym ? `${MOIS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}` : '');
export const leJour = (iso: string) => { const j = +iso.slice(8, 10); return `${j === 1 ? '1er' : j} ${MOIS[+iso.slice(5, 7) - 1]}`; };
export const duree = (k: number) => {
  if (k <= 1) return '1 mois';
  const a = Math.floor(k / 12), m = k % 12;
  if (!a) return `${k} mois`;
  return `${a} an${a > 1 ? 's' : ''}${m ? ` et ${m} mois` : ''}`;
};
export const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
