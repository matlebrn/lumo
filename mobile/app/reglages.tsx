// Réglages : verrouillage Face ID, style de Lumi, et ce que Lumo fait (et ne fait pas) de tes données.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { usePret } from '@/donnees/Donnees';
import { t } from '@/i18n';
import { STYLES } from '@/lumi/styles';
import { useVerrou } from '@/securite/Verrou';
import { C, F } from '@/theme';
import { Bouton, Carte, Doux, T, Titre } from '@/ui/base';
import { Feuille } from '@/ui/Feuille';

export default function Reglages() {
  const { d, changerProfil, exemple, quitterExemple } = usePret();
  const verrou = useVerrou();
  const [erreur, setErreur] = useState('');
  return (
    <Feuille titre={t('reglages.titre')}>
      {verrou.disponible && (
        <Carte style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}><T>{t('reglages.verrou')}</T><Doux style={{ fontSize: 13 }}>{t('reglages.verrouAide')}</Doux></View>
          <Switch value={verrou.actif} onValueChange={(v) => { verrou.changer(v); }} trackColor={{ true: C.or, false: '#34322e' }} thumbColor={verrou.actif ? C.surOr : '#c9c5bc'} accessibilityLabel={t('reglages.verrou')} />
        </Carte>
      )}
      <Titre>Banque</Titre>
      <Bouton texte="Connecter une banque" second onPress={() => router.push('/banque')} />
      <Titre>{t('reglages.styleLumi')}</Titre>
      {!!erreur && <Text style={{ color: C.moins, fontFamily: F.sans, marginBottom: 8 }}>{erreur}</Text>}
      {STYLES.map((s) => {
        const actif = d.profil.style_lumi === s.id;
        return (
          <Pressable key={s.id} onPress={() => changerProfil({ style_lumi: s.id }).catch(() => setErreur('Enregistrement impossible. Réessaie.'))} accessibilityRole="radio" accessibilityState={{ selected: actif }}>
            <Carte style={{ borderColor: actif ? C.or : C.trait, marginBottom: 10 }}>
              <T style={{ fontFamily: F.sansGras, color: actif ? C.orClair : C.texte }}>{s.nom}</T>
              <Doux style={{ fontStyle: 'italic' }}>« {s.exemple} »</Doux>
            </Carte>
          </Pressable>
        );
      })}
      <Titre>{t('reglages.securite')}</Titre>
      <Carte><Doux>{t('reglages.securiteTexte')}</Doux></Carte>
      {exemple && <Bouton texte="Quitter l’exemple" second onPress={quitterExemple} />}
    </Feuille>
  );
}
