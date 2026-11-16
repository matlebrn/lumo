// Tout ce que les écrans affichent, calculé d'un coup par le moteur partagé à partir des données.
import * as M from '@moteur';
import type { Donnees } from './types';

export function calculer(d: Donnees, maintenant = new Date()) {
  const regles = d.classements;
  const analyse = M.analyser(d.operations, d.flux, maintenant);
  const sim = M.simuler({
    solde: d.comptes.filter((c) => c.inclus !== false).reduce((s, c) => s + M.n(c.solde), 0),
    coussin: d.profil.coussin, courant: d.profil.courant_manuel ?? analyse.courant ?? 0,
    flux: d.flux, projets: d.projets,
  }, maintenant);
  const suivi = M.suiviMois({ comptes: d.comptes, operations: d.operations, flux: d.flux, regles }, maintenant);
  const cv = M.comptesVue(d.comptes, d.operations, maintenant);
  const alertes = M.alertes(suivi, maintenant);
  const bilan = M.bilan({ comptes: d.comptes, operations: d.operations, flux: d.flux, regles, mensuel: sim.mensuel }, maintenant);
  const ops = M.listeOperations(d.operations, d.comptes, regles);
  const groupes = new Map<string, { cle: string; ops: typeof ops; total: number }>();
  for (const o of ops) if (o.hesite) {
    const g = groupes.get(o.cle) ?? { cle: o.cle, ops: [], total: 0 };
    g.ops.push(o); g.total -= o.montant; groupes.set(o.cle, g);
  }
  const aClasser = [...groupes.values()].sort((a, b) => b.total - a.total);
  return { sim, suivi, cv, alertes, bilan, ops, aClasser, analyse };
}
export type Calcul = ReturnType<typeof calculer>;
