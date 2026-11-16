// Prévision : ce que la personne aura dans 1 à 10 ans, avec et sans ses projets.
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { usePret } from '@/donnees/Donnees';
import { limite } from '@/droits';
import { duree, eur, t } from '@/i18n';
import { BoutonLumi } from '@/lumi/BoutonLumi';
import { C, F } from '@/theme';
import { Avis, Carte, Doux, Ecran, Gros, Puces, Rail, T, Titre, Verrouille } from '@/ui/base';
import { Courbe } from '@/ui/graphiques';

const HORIZONS: ['12' | '36' | '60' | '120', string][] = [['12', '1 an'], ['36', '3 ans'], ['60', '5 ans'], ['120', '10 ans']];

export default function Prevision() {
  const { d, c } = usePret();
  const sim = c.sim, m = sim.mensuel, max = limite(d.plan, 'horizonMois');
  const [h, setH] = useState<'12' | '36' | '60' | '120'>('12');
  const k = +h, ouvert = k <= max;
  const fin = sim.avec[k], gain = fin - sim.solde, grand = Math.max(m.revenus, m.fixes + m.courant, 1);
  return (
    <Ecran titre={t('prevision.titre')}>
      <Carte>
        <Doux>{t('prevision.dansXTu', { d: duree(k) })}</Doux>
        {ouvert ? <Gros>{eur(fin)}</Gros> : <Gros style={{ color: C.pale }}>•••• €</Gros>}
        {ouvert && <T style={{ color: gain >= 0 ? C.plus : C.moins, fontSize: 14.5 }}>{t('prevision.parRapport', { v: eur(gain, true) })}</T>}
        <View style={{ marginTop: 16 }}><Puces choix={HORIZONS} valeur={h} onChange={setH} verrous={HORIZONS.filter(([x]) => +x > max).map(([x]) => x)} /></View>
        {ouvert ? <Courbe avec={sim.avec.slice(0, k + 1)} sans={sim.sans.slice(0, k + 1)} coussin={sim.coussin} mois={sim.mois} /> : <Verrouille texte={t('prevision.debloque')} />}
      </Carte>
      <BoutonLumi question="Qu’est-ce qui ferait le plus monter ma courbe ?" texte="Comment faire monter ma courbe ?" />
      {m.reste < 0 && <View style={{ marginTop: 14 }}><Avis ton="rouge">Chaque mois, tu dépenses {eur(-m.reste)} de plus que tu ne gagnes.</Avis></View>}
      {sim.decouvert != null && sim.decouvert <= max && <Avis ton="rouge">Tes comptes passent dans le rouge {duree(sim.decouvert) === '1 mois' ? 'le mois prochain' : `dans ${duree(sim.decouvert)}`}.</Avis>}

      <Titre>{t('prevision.chaqueMois')}</Titre>
      <Carte style={{ gap: 10 }}>
        {[[t('prevision.revenus'), m.revenus, C.or], [t('prevision.fixes'), m.fixes, '#55514a'], [t('prevision.courantes'), m.courant, '#55514a']].map(([nom, v, coul]) => (
          <View key={nom as string}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}><T style={{ fontSize: 14.5 }}>{nom}</T><T style={{ fontSize: 14.5 }}>{eur(v as number)}</T></View>
            <Rail part={(v as number) / grand} couleur={coul as string} />
          </View>
        ))}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderTopWidth: 1, borderTopColor: C.trait, paddingTop: 12, marginTop: 4 }}>
          <Doux>{t('prevision.reste')}</Doux>
          <T style={{ fontFamily: F.serif, fontSize: 28, color: m.reste >= 0 ? C.plus : C.moins }}>{eur(m.reste)}</T>
        </View>
      </Carte>
      <Doux style={{ fontSize: 12.5, color: C.pale, marginHorizontal: 4 }}>{t('prevision.note')}</Doux>
    </Ecran>
  );
}
