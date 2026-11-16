// Les briques de tous les écrans : écran qui défile, cartes, titres, lignes, boutons, avis.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDonnees } from '@/donnees/Donnees';
import { t } from '@/i18n';
import { C, E, F, R, ton as TON } from '@/theme';
import { Icone } from './Icone';

export function Ecran({ titre, sous, droite, children }: { titre: string; sous?: string; droite?: ReactNode; children: ReactNode }) {
  const haut = useSafeAreaInsets().top;
  const { exemple, quitterExemple } = useDonnees();
  return (
    <ScrollView style={s.fond} contentContainerStyle={{ paddingTop: haut + 14, paddingHorizontal: 18, paddingBottom: 40 }}>
      {exemple && (
        <View style={s.bandeau}>
          <Text style={s.bandeauTexte}>{t('commun.exemple')}</Text>
          <Pressable onPress={quitterExemple} accessibilityRole="button"><Text style={s.bandeauLien}>Commencer</Text></Pressable>
        </View>
      )}
      <View style={s.entete}>
        <View style={{ flex: 1 }}>
          <Text style={s.h1} accessibilityRole="header">{titre}</Text>
          {sous ? <Text style={s.sous}>{sous}</Text> : null}
        </View>
        {droite ?? (
          <Pressable style={s.rond} onPress={() => router.push('/reglages')} accessibilityLabel={t('reglages.titre')} accessibilityRole="button">
            <Icone nom="reglages" taille={20} couleur={C.doux} />
          </Pressable>
        )}
      </View>
      {children}
    </ScrollView>
  );
}

export const Carte = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[s.carte, style]}>{children}</View>;

export function Titre({ children, action }: { children: string; action?: ReactNode }) {
  return <View style={s.titre}><Text style={s.titreTexte}>{children.toUpperCase()}</Text>{action}</View>;
}

export const T = ({ children, style, nb }: { children: ReactNode; style?: StyleProp<TextStyle>; nb?: number }) => <Text style={[s.texte, style]} numberOfLines={nb}>{children}</Text>;
export const Doux = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text style={[s.doux, style]}>{children}</Text>;
export const Gros = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text style={[s.gros, style]} adjustsFontSizeToFit numberOfLines={1}>{children}</Text>;

export function Ligne({ nom, detail, somme, sommeStyle, onPress }: { nom: string; detail?: ReactNode; somme?: string; sommeStyle?: StyleProp<TextStyle>; onPress?: () => void }) {
  const corps = (
    <View style={s.ligne}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.ligneNom} numberOfLines={1}>{nom}</Text>
        {detail ? <Text style={s.ligneDetail} numberOfLines={1}>{detail}</Text> : null}
      </View>
      {somme ? <Text style={[s.somme, sommeStyle]}>{somme}</Text> : null}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{corps}</Pressable> : corps;
}

export function Rail({ part, couleur = C.or, repere }: { part: number; couleur?: string; repere?: number }) {
  return (
    <View style={s.rail}>
      <View style={{ width: `${Math.max(0, Math.min(1, part)) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: couleur }} />
      {repere != null && <View style={[s.repere, { left: `${Math.max(0, Math.min(1, repere)) * 100}%` }]} />}
    </View>
  );
}

export function Puces<K extends string>({ choix, valeur, onChange, verrous }: { choix: [K, string][]; valeur: K; onChange: (k: K) => void; verrous?: K[] }) {
  return (
    <View style={s.puces}>
      {choix.map(([k, nom]) => {
        const actif = k === valeur, ferme = verrous?.includes(k);
        return (
          <Pressable key={k} onPress={() => onChange(k)} style={[s.puce, actif && s.puceActive]} accessibilityRole="button" accessibilityState={{ selected: actif }}>
            <Text style={[s.puceTexte, actif && { color: C.surOr }]}>{nom}</Text>
            {ferme && !actif ? <Icone nom="cadenas" taille={12} couleur={C.pale} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Bouton({ texte, onPress, second, desactive }: { texte: string; onPress: () => void; second?: boolean; desactive?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={desactive} style={[s.bouton, second && s.boutonSecond, desactive && { opacity: 0.5 }]} accessibilityRole="button">
      <Text style={[s.boutonTexte, second && { color: C.texte }]}>{texte}</Text>
    </Pressable>
  );
}

export function Avis({ ton, children }: { ton: 'bon' | 'alerte' | 'rouge'; children: ReactNode }) {
  const c = TON[ton];
  return (
    <View style={[s.avis, { borderColor: c + '50', backgroundColor: c + '14' }]}>
      <Icone nom="alerte" taille={20} couleur={c} />
      <Text style={[s.texte, { flex: 1, fontSize: 14.5 }]}>{children}</Text>
    </View>
  );
}

/** Ce que la version gratuite ne montre pas : on le laisse deviner, avec une invitation à Lumo Plus. */
export function Verrouille({ texte }: { texte: string }) {
  return (
    <Pressable style={s.verrouille} onPress={() => router.push('/plus')} accessibilityRole="button">
      <Icone nom="cadenas" taille={18} couleur={C.or} />
      <Text style={[s.texte, { flex: 1, fontSize: 14 }]}>{texte}</Text>
      <Text style={s.plusTexte}>{t('commun.plus')}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  bandeau: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(217,181,108,0.25)', backgroundColor: 'rgba(217,181,108,0.1)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 16 },
  bandeauTexte: { color: C.orClair, fontFamily: F.sans, fontSize: 13.5, flex: 1 },
  bandeauLien: { color: C.or, fontFamily: F.sansGras, fontSize: 13.5 },
  entete: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, minHeight: 40 },
  h1: { color: C.texte, fontFamily: F.serif, fontSize: 32, letterSpacing: -0.3 },
  sous: { color: C.doux, fontFamily: F.sans, fontSize: 14 },
  rond: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.carte, borderWidth: 1, borderColor: C.trait, alignItems: 'center', justifyContent: 'center' },
  carte: { backgroundColor: C.carte, borderWidth: 1, borderColor: C.trait, borderRadius: R.carte, padding: 18, marginBottom: 14 },
  titre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10, marginHorizontal: 4 },
  titreTexte: { color: C.pale, fontFamily: F.sansGras, fontSize: 12, letterSpacing: 1.1 },
  texte: { color: C.texte, fontFamily: F.sans, fontSize: 15.5, lineHeight: 22 },
  doux: { color: C.doux, fontFamily: F.sans, fontSize: 14, lineHeight: 20 },
  gros: { color: C.texte, fontFamily: F.serif, fontSize: 54, letterSpacing: -1, marginVertical: 2 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.trait },
  ligneNom: { color: C.texte, fontFamily: F.sansMoyen, fontSize: 15.5 },
  ligneDetail: { color: C.doux, fontFamily: F.sans, fontSize: 13 },
  somme: { color: C.texte, fontFamily: F.sansMoyen, fontSize: 15.5, fontVariant: ['tabular-nums'] },
  rail: { height: 6, borderRadius: 3, backgroundColor: C.carte2, position: 'relative' },
  repere: { position: 'absolute', top: -3, width: 2, height: 12, marginLeft: -1, backgroundColor: C.texte, opacity: 0.55, borderRadius: 1 },
  puces: { flexDirection: 'row', gap: 6 },
  puce: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: R.puce, backgroundColor: C.carte2 },
  puceActive: { backgroundColor: C.or },
  puceTexte: { color: C.doux, fontFamily: F.sansMoyen, fontSize: 13.5 },
  bouton: { backgroundColor: C.or, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  boutonSecond: { backgroundColor: C.carte2, borderWidth: 1, borderColor: C.trait },
  boutonTexte: { color: C.surOr, fontFamily: F.sansGras, fontSize: 16 },
  avis: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14 },
  verrouille: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(217,181,108,0.3)', borderStyle: 'dashed', borderRadius: 14, padding: 12, marginTop: 10 },
  plusTexte: { color: C.or, fontFamily: F.sansGras, fontSize: 13 },
});
