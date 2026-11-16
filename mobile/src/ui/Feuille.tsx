// Fenêtre qui monte du bas (écrans « modal ») : titre, bouton fermer, contenu qui défile.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';
import { C, F } from '@/theme';
import { Icone } from './Icone';
import { s } from './base';

export function Feuille({ titre, children, pied }: { titre: string; children: ReactNode; pied?: ReactNode }) {
  const bas = useSafeAreaInsets().bottom;
  return (
    <View style={{ flex: 1, backgroundColor: '#0E0D10' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, paddingBottom: 6 }}>
        <Text style={{ color: C.texte, fontFamily: F.serif, fontSize: 28, flex: 1 }} numberOfLines={1}>{titre}</Text>
        <Pressable style={s.rond} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel={t('commun.fermer')} accessibilityRole="button">
          <Icone nom="fermer" taille={20} couleur={C.doux} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bas + 24 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      {pied}
    </View>
  );
}
