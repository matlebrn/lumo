// Le bouton Lumi, présent sur chaque écran : il ouvre Lumi avec une question sur ce qu'on regarde.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { C, F } from '@/theme';
import { Icone } from '@/ui/Icone';

export function BoutonLumi({ question, texte }: { question: string; texte?: string }) {
  return (
    <Pressable style={s.b} onPress={() => router.push({ pathname: '/lumi', params: { q: question } })} accessibilityRole="button" accessibilityLabel={`Demander à Lumi : ${question}`} hitSlop={8}>
      <Icone nom="lumi" taille={15} couleur={C.or} />
      {texte ? <Text style={s.t}>{texte}</Text> : null}
    </Pressable>
  );
}
const s = StyleSheet.create({
  b: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(217,181,108,0.1)', borderWidth: 1, borderColor: 'rgba(217,181,108,0.22)', alignSelf: 'flex-start' },
  t: { color: C.or, fontFamily: F.sansMoyen, fontSize: 12.5 },
});
