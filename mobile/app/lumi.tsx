// Lumi : on lui pose une question, il répond avec les chiffres de la personne, sur le ton qu'elle a choisi.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePret } from '@/donnees/Donnees';
import { serveur } from '@/donnees/supabase';
import { limite } from '@/droits';
import { t } from '@/i18n';
import { contexteLumi } from '@/lumi/contexte';
import { C, F } from '@/theme';
import { Icone } from '@/ui/Icone';
import { Feuille } from '@/ui/Feuille';

type Message = { role: 'user' | 'assistant'; content: string };
const IDEES = ['Qu’est-ce qui ne va pas dans mon budget ?', 'Où est-ce que je peux économiser ?', 'Combien je peux mettre de côté chaque mois ?'];

export default function Lumi() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { d, c, exemple } = usePret();
  const [fil, setFil] = useState<Message[]>([]);
  const [saisie, setSaisie] = useState('');
  const [attente, setAttente] = useState(false);
  const bas = useSafeAreaInsets().bottom;

  const demander = async (question: string) => {
    question = question.trim(); if (!question || attente) return;
    const suite: Message[] = [...fil, { role: 'user', content: question }];
    setFil(suite); setSaisie(''); setAttente(true);
    let rep: string;
    if (exemple) rep = t('lumi.exemple');
    else {
      try {
        const r = await serveur<{ texte?: string; message?: string; code?: string }>('coach', { messages: suite.slice(-12), contexte: contexteLumi(d, c), style: d.profil.style_lumi });
        rep = r.ok ? (r.texte ?? '') : r.code === 'limite' ? t('lumi.limite', { n: limite(d.plan, 'lumiParJour') }) : (r.message ?? 'Lumi est indisponible pour le moment.');
      } catch { rep = 'Pas de connexion. Réessaie dans un instant.'; }
    }
    setFil([...suite, { role: 'assistant', content: rep || 'Lumi n’a pas su répondre. Reformule ta question.' }]);
    setAttente(false);
  };

  const lance = useRef(false);
  useEffect(() => { if (q && !lance.current) { lance.current = true; demander(q); } }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Feuille titre={t('lumi.titre')} pied={
        <View style={{ flexDirection: 'row', gap: 8, margin: 14, marginBottom: bas + 10, backgroundColor: C.carte2, borderRadius: 24, borderWidth: 1, borderColor: C.trait, padding: 5, paddingLeft: 16 }}>
          <TextInput value={saisie} onChangeText={setSaisie} placeholder={t('lumi.placeholder')} placeholderTextColor={C.pale} onSubmitEditing={() => demander(saisie)} returnKeyType="send"
            style={{ flex: 1, color: C.texte, fontFamily: F.sans, fontSize: 16 }} accessibilityLabel={t('lumi.placeholder')} />
          <Pressable onPress={() => demander(saisie)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.or, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Envoyer" accessibilityRole="button">
            <Icone nom="envoyer" taille={18} couleur={C.surOr} />
          </Pressable>
        </View>
      }>
        <View style={{ gap: 10 }}>
          {!fil.length && IDEES.map((i) => (
            <Pressable key={i} onPress={() => demander(i)} style={{ backgroundColor: C.carte, borderRadius: 14, borderWidth: 1, borderColor: C.trait, padding: 13 }} accessibilityRole="button">
              <Text style={{ color: C.texte, fontFamily: F.sans, fontSize: 14.5 }}>{i}</Text>
            </Pressable>
          ))}
          {fil.map((m, i) => (
            <View key={i} style={m.role === 'user'
              ? { alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: C.or, borderRadius: 18, borderBottomRightRadius: 6, padding: 12 }
              : { alignSelf: 'flex-start', maxWidth: '86%', backgroundColor: C.carte, borderRadius: 18, borderBottomLeftRadius: 6, padding: 12, borderWidth: 1, borderColor: C.trait }}>
              <Text style={{ color: m.role === 'user' ? C.surOr : C.texte, fontFamily: F.sans, fontSize: 15.5, lineHeight: 22 }}>{m.content}</Text>
            </View>
          ))}
          {attente && <Text style={{ color: C.doux, fontFamily: F.sans }}>{t('lumi.reflechit')}</Text>}
        </View>
      </Feuille>
    </KeyboardAvoidingView>
  );
}
