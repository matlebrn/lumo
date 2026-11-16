// Lumi : on discute avec lui comme avec une IA, et il fouille dans les comptes pour répondre.
// Les recherches tournent ici, sur le téléphone ; le serveur ne reçoit que leurs résultats.
import * as O from '@outils';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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

type Bloc = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown } | { type: 'tool_result'; tool_use_id: string; content: string };
type Echange = { role: 'user' | 'assistant'; content: string | Bloc[] };
type Bulle = { qui: 'moi' | 'lumi'; texte: string; recherches?: number };
const IDEES = ['Regarde tous mes paiements pour ma voiture, ça fait combien ?', 'Quand était mon premier loyer ?', 'Où est-ce que je peux économiser ?', 'Combien je dépense en restos par mois ?'];
const TOURS = 8;
const LIBELLES_OUTILS: Record<string, string> = { chercher_operations: 'cherche dans tes opérations', regrouper: 'fait les totaux', libelles: 'regarde tes libellés', comptes: 'regarde tes comptes', budget: 'regarde ton budget' };

export default function Lumi() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { d, c, exemple } = usePret();
  const [bulles, setBulles] = useState<Bulle[]>([]);
  const [saisie, setSaisie] = useState('');
  const [etape, setEtape] = useState<string | null>(null);
  const echanges = useRef<Echange[]>([]);
  const bas = useSafeAreaInsets().bottom;
  const donnees = useMemo(() => O.preparer({ operations: d.operations, comptes: d.comptes, flux: d.flux, projets: d.projets, classements: d.classements, profil: d.profil }), [d]);

  const demander = async (question: string) => {
    question = question.trim(); if (!question || etape) return;
    setBulles((b) => [...b, { qui: 'moi', texte: question }]); setSaisie(''); setEtape(t('lumi.reflechit'));
    if (exemple) { setBulles((b) => [...b, { qui: 'lumi', texte: t('lumi.exemple') }]); setEtape(null); return; }
    const L = [...echanges.current, { role: 'user' as const, content: question }];
    let texte = '', recherches = 0;
    try {
      for (let tour = 0; tour < TOURS; tour++) {
        const r = await serveur<{ contenu?: Bloc[]; fin?: string; code?: string; message?: string }>('lumi', { messages: L.slice(-40), contexte: contexteLumi(d, c), style: d.profil.style_lumi });
        if (!r.ok) { texte = r.code === 'limite' ? t('lumi.limite', { n: limite(d.plan, 'lumiParJour') }) : (r.message ?? 'Lumi est indisponible pour le moment.'); break; }
        const blocs = r.contenu ?? [];
        texte = blocs.filter((x): x is Extract<Bloc, { type: 'text' }> => x.type === 'text').map((x) => x.text).join('');
        const appels = blocs.filter((x): x is Extract<Bloc, { type: 'tool_use' }> => x.type === 'tool_use');
        L.push({ role: 'assistant', content: blocs });
        if (r.fin !== 'tool_use' || !appels.length) break;
        setEtape(`Lumi ${LIBELLES_OUTILS[appels[0].name] ?? 'fouille'}…`);
        L.push({ role: 'user', content: appels.map((a) => ({ type: 'tool_result' as const, tool_use_id: a.id, content: JSON.stringify(O.executer(donnees, a.name, a.input)).slice(0, 20000) })) });
        recherches += appels.length;
      }
    } catch { texte = 'Pas de connexion. Réessaie dans un instant.'; }
    // on ne garde que la conversation lisible pour la suite, pas le détail des recherches
    echanges.current = [...echanges.current, { role: 'user', content: question }, ...(texte ? [{ role: 'assistant' as const, content: texte }] : [])];
    setBulles((b) => [...b, { qui: 'lumi', texte: texte || 'Lumi n’a pas su répondre. Reformule ta question.', recherches }]);
    setEtape(null);
  };

  const lance = useRef(false);
  useEffect(() => { if (q && !lance.current) { lance.current = true; demander(q); } }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Feuille titre={t('lumi.titre')} pied={
        <View style={{ flexDirection: 'row', gap: 8, margin: 14, marginBottom: bas + 10, backgroundColor: C.carte2, borderRadius: 24, borderWidth: 1, borderColor: C.trait, padding: 5, paddingLeft: 16 }}>
          <TextInput value={saisie} onChangeText={setSaisie} placeholder={t('lumi.placeholder')} placeholderTextColor={C.pale} onSubmitEditing={() => demander(saisie)} returnKeyType="send" multiline={false}
            style={{ flex: 1, color: C.texte, fontFamily: F.sans, fontSize: 16 }} accessibilityLabel={t('lumi.placeholder')} />
          <Pressable onPress={() => demander(saisie)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.or, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Envoyer" accessibilityRole="button">
            <Icone nom="envoyer" taille={18} couleur={C.surOr} />
          </Pressable>
        </View>
      }>
        <View style={{ gap: 10 }}>
          {!bulles.length && (
            <>
              <Text style={{ color: C.doux, fontFamily: F.sans, fontSize: 14.5, marginBottom: 4 }}>Pose ta question comme à quelqu’un qui connaît tes comptes par cœur. Lumi va chercher lui-même dans tes opérations{donnees.couverture ? `, depuis le ${donnees.couverture.du.split('-').reverse().join('/')}` : ''}.</Text>
              {IDEES.map((i) => (
                <Pressable key={i} onPress={() => demander(i)} style={{ backgroundColor: C.carte, borderRadius: 14, borderWidth: 1, borderColor: C.trait, padding: 13 }} accessibilityRole="button">
                  <Text style={{ color: C.texte, fontFamily: F.sans, fontSize: 14.5 }}>{i}</Text>
                </Pressable>
              ))}
            </>
          )}
          {bulles.map((m, i) => (
            <View key={i} style={m.qui === 'moi'
              ? { alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: C.or, borderRadius: 18, borderBottomRightRadius: 6, padding: 12 }
              : { alignSelf: 'flex-start', maxWidth: '90%', backgroundColor: C.carte, borderRadius: 18, borderBottomLeftRadius: 6, padding: 12, borderWidth: 1, borderColor: C.trait }}>
              <Text style={{ color: m.qui === 'moi' ? C.surOr : C.texte, fontFamily: F.sans, fontSize: 15.5, lineHeight: 22 }}>{m.texte}</Text>
              {!!m.recherches && <Text style={{ color: C.pale, fontFamily: F.sans, fontSize: 12, marginTop: 6 }}>{`${m.recherches} recherche${m.recherches > 1 ? 's' : ''} dans tes comptes`}</Text>}
            </View>
          ))}
          {etape && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icone nom="lumi" taille={15} couleur={C.or} /><Text style={{ color: C.doux, fontFamily: F.sans }}>{etape}</Text></View>}
        </View>
      </Feuille>
    </KeyboardAvoidingView>
  );
}
