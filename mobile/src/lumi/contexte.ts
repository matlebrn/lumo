// Le résumé envoyé à Lumi avec une question : des chiffres calculés, jamais les opérations une par une.
import type { Calcul } from '@/donnees/calcul';
import type { Donnees } from '@/donnees/types';
import { eur, moisLong } from '@/i18n';

export function contexteLumi(d: Donnees, c: Calcul): string {
  const { sim, suivi, bilan: b, cv } = c, L: string[] = [], m = sim.mensuel;
  L.push(`Date : ${moisLong(sim.mois(0))}. Situation : ${d.profil.situation ?? 'non dite'}. Objectif : ${d.profil.objectif ?? 'non dit'}.`);
  L.push(`Tous les comptes : ${eur(cv.total)} (disponible ${eur(cv.parGenre.courant)}, épargne ${eur(cv.parGenre.epargne)}, placements ${eur(cv.parGenre.placement)}). Coussin voulu : ${eur(sim.coussin)}.`);
  if (suivi.avecBanque) L.push(`Mois en cours jusqu'au ${suivi.fin} : dépensé ${eur(suivi.depense)}, rentré ${eur(suivi.entrees)}, encore dépensable ${eur(suivi.reste)}.`);
  if (c.alertes.length) L.push('Alertes : ' + c.alertes.map((a) => a.titre).join(' ; ') + '.');
  if (b.assez) {
    L.push(`Bilan : note ${b.note}/100 (${b.niveau?.nom}). Rentrées ${eur(b.revenus)}/mois, sorties ${eur(b.depenses)}/mois, reste ${eur(b.net)}/mois. Épargne de secours ${eur(b.epargneDispo)}.`);
    L.push('Dépenses par catégorie et par mois : ' + (b.categories ?? []).map((x) => `${x.nom} ${eur(x.montant)}${x.avant != null ? ` (avant ${eur(x.avant)})` : ''}`).join(', ') + '.');
    if (b.abonnements?.length) L.push('Abonnements : ' + b.abonnements.map((a) => `${a.nom} ${eur(a.montant)}/mois`).join(', ') + '.');
    L.push('Ce qui ne va pas : ' + ((b.vaPas ?? []).map((p) => p.titre).join(' ; ') || 'rien') + '. Plan : ' + (b.plan ?? []).map((a, i) => `${i + 1}. ${a.titre}`).join(' ') + '.');
  }
  L.push(`Chaque mois : revenus ${eur(m.revenus)}, fixes ${eur(m.fixes)}, courantes ${eur(m.courant)}, reste ${eur(m.reste)}.`);
  L.push(`Prévision : ${[12, 36, 60, 120].map((k) => `${k / 12} an(s) → ${eur(sim.avec[k])}`).join(', ')}.`);
  for (const p of d.projets) { const r = sim.projets[p.id]; L.push(`Projet « ${p.nom} » (${p.type}) : ${r?.k0 != null ? `possible vers ${moisLong(sim.mois(r.k0))}` : 'hors de portée sur 10 ans'}.`); }
  return L.join('\n').slice(0, 11000);
}
