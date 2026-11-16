// Première ouverture : la situation, ce qui amène, et comment Lumi doit parler. Lumo s'adapte à ces réponses.
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDonnees } from '@/donnees/Donnees';
import type { Objectif, Situation } from '@/donnees/types';
import { t } from '@/i18n';
import { STYLES, type StyleLumi } from '@/lumi/styles';
import { C, F } from '@/theme';
import { Bouton, Doux } from '@/ui/base';

const SITUATIONS: Situation[] = ['etudiant', 'salarie', 'famille', 'independant', 'retraite'];
const OBJECTIFS: Objectif[] = ['finDeMois', 'projet', 'grossir', 'sortir'];

function Choix<K extends string>({ titre, options, valeur, onChange }: { titre: string; options: [K, string][]; valeur: K | null; onChange: (k: K) => void }) {
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={{ color: C.pale, fontFamily: F.sansGras, fontSize: 12, letterSpacing: 1.1, marginBottom: 10 }}>{titre.toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map(([k, nom]) => (
          <Pressable key={k} onPress={() => onChange(k)} accessibilityRole="radio" accessibilityState={{ selected: valeur === k }}
            style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: valeur === k ? C.or : C.trait, backgroundColor: valeur === k ? 'rgba(217,181,108,0.14)' : C.carte }}>
            <Text style={{ color: valeur === k ? C.orClair : C.texte, fontFamily: F.sansMoyen, fontSize: 14.5 }}>{nom}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function Accueil() {
  const { etat, erreur, commencer, voirExemple } = useDonnees();
  const ins = useSafeAreaInsets();
  const [situation, setSituation] = useState<Situation | null>(null);
  const [objectif, setObjectif] = useState<Objectif | null>(null);
  const [style, setStyle] = useState<StyleLumi>('coach');
  const [attente, setAttente] = useState(false);
  if (etat === 'pret') return <Redirect href="/" />;
  const pret = situation && objectif;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.fond }} contentContainerStyle={{ padding: 24, paddingTop: ins.top + 30, paddingBottom: ins.bottom + 30 }}>
      <Image source={require('../assets/images/splash-icon.png')} style={{ width: 110, height: 55, marginBottom: 20 }} resizeMode="contain" />
      <Text style={{ color: C.texte, fontFamily: F.serif, fontSize: 40, lineHeight: 44 }}>Ton argent, <Text style={{ color: C.or, fontStyle: 'italic' }}>dans le temps.</Text></Text>
      <Doux style={{ marginTop: 12, fontSize: 16 }}>Lumo classe tes dépenses, te dit ce qui va et ce qui ne va pas, et te montre où tu en seras dans 10 ans.</Doux>
      <Choix titre={t('accueil.situation')} options={SITUATIONS.map((k) => [k, t(`accueil.situations.${k}`)])} valeur={situation} onChange={setSituation} />
      <Choix titre={t('accueil.objectif')} options={OBJECTIFS.map((k) => [k, t(`accueil.objectifs.${k}`)])} valeur={objectif} onChange={setObjectif} />
      <Choix titre={t('accueil.style')} options={STYLES.map((s) => [s.id, s.nom])} valeur={style} onChange={setStyle} />
      <Doux style={{ marginTop: 10, fontStyle: 'italic' }}>« {STYLES.find((s) => s.id === style)!.exemple} »</Doux>
      {!!erreur && <Text style={{ color: C.moins, fontFamily: F.sans, marginTop: 16 }}>{erreur}</Text>}
      <View style={{ marginTop: 28, gap: 10 }}>
        <Bouton texte={attente ? '…' : t('accueil.commencer')} desactive={!pret || attente} onPress={async () => { setAttente(true); await commencer({ situation: situation!, objectif: objectif!, style }); setAttente(false); }} />
        <Bouton texte={t('accueil.voirExemple')} second onPress={voirExemple} />
      </View>
    </ScrollView>
  );
}
