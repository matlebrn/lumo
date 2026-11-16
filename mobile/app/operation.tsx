// Classer une opération : le choix vaut pour toutes les opérations du même nom, et pour les prochaines.
import { CHOIX_DEPENSE, CHOIX_RENTREE, GROUPE, NOM_CAT } from '@moteur';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { usePret } from '@/donnees/Donnees';
import { eur, leJour, t } from '@/i18n';
import { C, F } from '@/theme';
import { Carte, Doux, T } from '@/ui/base';
import { Feuille } from '@/ui/Feuille';

export default function Operation() {
  const { cle, id } = useLocalSearchParams<{ cle: string; id?: string }>();
  const { d, c, ranger } = usePret();
  const [erreur, setErreur] = useState('');
  const memes = c.ops.filter((o) => o.cle === cle);
  const o = memes.find((x) => x.id === id) ?? memes[0];
  if (!o) return <Feuille titre={t('analyse.aClasser')}><Doux>Tout est classé.</Doux></Feuille>;
  const choix = o.montant >= 0 ? CHOIX_RENTREE : CHOIX_DEPENSE, regle = d.classements[o.cle];
  const actuelle = o.hesite ? null : o.categorie;
  const total = memes.reduce((s, x) => s - x.montant, 0);

  const choisir = async (cat: string | null) => {
    try {
      await ranger(o.cle, cat);
      const suivant = c.aClasser.find((g) => g.cle !== o.cle);
      if (o.hesite && suivant) router.setParams({ cle: suivant.cle, id: '' }); else router.back();
    } catch { setErreur('Enregistrement impossible. Réessaie.'); }
  };

  return (
    <Feuille titre={o.hesite ? `${t('analyse.aClasser')} · ${c.aClasser.length}` : 'Opération'}>
      <Carte style={{ borderColor: 'rgba(217,181,108,0.22)' }}>
        <T style={{ fontFamily: F.serif, fontSize: 24 }} nb={2}>{o.libelle || 'Opération'}</T>
        <Doux>{memes.length > 1 ? `${memes.length} opérations, ${eur(Math.abs(total))} en tout` : `${eur(o.montant, true)} le ${leJour(o.date)}`}</Doux>
      </Carte>
      <Doux style={{ marginBottom: 10 }}>{o.hesite ? t('analyse.cestQuoi') : memes.length > 1 ? t('analyse.toutesMemes', { n: memes.length }) : 'Catégorie'}</Doux>
      {!!erreur && <Text style={{ color: C.moins, fontFamily: F.sans, marginBottom: 10 }}>{erreur}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {choix.map((cat) => (
          <Pressable key={cat} onPress={() => choisir(cat)} accessibilityRole="button" accessibilityState={{ selected: cat === actuelle }}
            style={{ width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.carte2, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: cat === actuelle ? C.or : C.trait }}>
            {o.montant < 0 && cat !== 'interne' && <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: GROUPE[cat] === 'besoin' ? C.besoin : C.envie }} />}
            <Text style={{ color: cat === actuelle ? C.orClair : C.texte, fontFamily: F.sans, fontSize: 14, flexShrink: 1 }}>{NOM_CAT[cat] ?? cat}</Text>
          </Pressable>
        ))}
      </View>
      {regle && <Pressable onPress={() => choisir(null)} style={{ padding: 14, alignItems: 'center' }}><Text style={{ color: C.doux, fontFamily: F.sansMoyen }}>Laisser Lumo choisir</Text></Pressable>}
    </Feuille>
  );
}
