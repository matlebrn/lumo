// Projets : pour chacun, quand il devient possible. La version gratuite en suit un.
import { View } from 'react-native';
import { usePret } from '@/donnees/Donnees';
import { limite } from '@/droits';
import { eur, moisLong, t } from '@/i18n';
import { BoutonLumi } from '@/lumi/BoutonLumi';
import { C, F, ton as TON } from '@/theme';
import { Carte, Doux, Ecran, T, Verrouille } from '@/ui/base';

const TYPES = { achat: 'Un achat', investissement: 'Un investissement', changement: 'Un changement de vie', credit: 'Un crédit' } as const;

export default function Projets() {
  const { d, c } = usePret();
  const sim = c.sim, max = limite(d.plan, 'projets');
  const L = d.projets.slice(0, max === Infinity ? undefined : max), caches = d.projets.length - L.length;
  return (
    <Ecran titre={t('projets.titre')}>
      {!L.length && <Carte><Doux style={{ textAlign: 'center' }}>{t('projets.vide')}</Doux></Carte>}
      {L.map((p) => {
        const r = sim.projets[p.id] ?? {};
        const loin = r.k0 == null || r.k0 > 120, passe = r.k0 != null && r.k0 < 1;
        const [ton, verdict] = loin ? ['rouge', t('projets.horsPortee')] as const
          : passe ? ['bon', t('projets.enCours')] as const
          : r.ok ? ['bon', t('projets.possible', { mois: moisLong(sim.mois(r.k0)) })] as const
          : ['alerte', t('projets.tropJuste', { mois: moisLong(sim.mois(r.k0)) })] as const;
        return (
          <Carte key={p.id}>
            <T style={{ fontFamily: F.sansGras, fontSize: 17 }}>{p.nom}</T>
            <Doux style={{ fontSize: 13 }}>{TYPES[p.type]}</Doux>
            <T style={{ fontFamily: F.serif, fontSize: 24, marginTop: 10, color: ton === 'bon' ? C.texte : TON[ton] }}>{verdict}</T>
            {!r.ok && r.manque > 0 && <Doux>Il te manque {eur(r.manque)} pour garder ton coussin.</Doux>}
            {r.chiffres?.mensualite > 0 && <Doux>Crédit : {eur(r.chiffres.mensualite)} par mois.</Doux>}
            <View style={{ marginTop: 10 }}><BoutonLumi question={`Comment rendre « ${p.nom} » possible plus tôt ?`} texte="Plus tôt ?" /></View>
          </Carte>
        );
      })}
      {caches > 0 && <Verrouille texte={`${caches} autre${caches > 1 ? 's' : ''} projet${caches > 1 ? 's' : ''}. ${t('projets.unSeul')}`} />}
    </Ecran>
  );
}
