// Connecter sa banque : l'étape qui donne vie à Lumo. Proposée à la première ouverture, puis dans les réglages.
// L'accord se donne sur le site de la banque (Enable Banking, prestataire agréé) ; Lumo ne voit jamais les identifiants.
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useDonnees } from '@/donnees/Donnees';
import { sb, serveur } from '@/donnees/supabase';
import { CLE_PLUS_TARD, coffre } from '@/securite/stockage';
import { C, F } from '@/theme';
import { Bouton, Carte, Doux, T } from '@/ui/base';
import { Feuille } from '@/ui/Feuille';
import { Icone } from '@/ui/Icone';

const GARANTIES = [
  'Lecture seule : Lumo ne peut ni payer ni faire de virement.',
  'Tu te connectes sur le site de ta banque : Lumo ne voit jamais tes identifiants.',
  'Connexion par Enable Banking, prestataire agréé en Europe (DSP2).',
  'Tu peux retirer l’accès quand tu veux : tes données sont alors effacées.',
];

export default function Banque() {
  const { premier, nom } = useLocalSearchParams<{ premier?: string; nom?: string }>();
  const { recharger, exemple } = useDonnees();
  const [banques, setBanques] = useState<{ name: string }[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [inactive, setInactive] = useState(false);
  const [q, setQ] = useState('');
  const [attente, setAttente] = useState<string | null>(null);

  useEffect(() => {
    if (exemple) { setInactive(true); return; }
    (async () => {
      const r = await serveur<{ code?: string }>('bank/u/banques').catch(() => ({ ok: false, code: 'reseau' } as any));
      if (!r.ok) { setInactive(r.code === 'pas_activee'); if (r.code !== 'pas_activee') setErreur('Impossible de charger les banques. Réessaie plus tard.'); setBanques([]); return; }
      const { data } = await sb.from('eb_banks').select('name').eq('country', 'FR').order('name');
      setBanques(data ?? []);
    })();
  }, [exemple]);

  const liste = useMemo(() => {
    const m = q.trim().toLowerCase();
    return (banques ?? []).filter((b) => b.name.toLowerCase().includes(m)).slice(0, 60);
  }, [banques, q]);

  const plusTard = async () => { await coffre.setItem(CLE_PLUS_TARD, 'oui'); router.replace('/'); };

  const choisir = async (nom: string) => {
    setErreur(''); setAttente(nom);
    const r = await serveur<{ url?: string; code?: string }>('bank/u/connecter', { banque: nom, retour: 'appli' }).catch(() => ({ ok: false } as any));
    if (!r.ok || !r.url) {
      setAttente(null);
      if (r.code === 'limite') { router.push('/plus'); return; }
      setErreur(r.code === 'pas_activee' ? 'La connexion bancaire n’est pas encore activée sur Lumo.' : 'Cette banque ne répond pas. Réessaie plus tard.');
      return;
    }
    const res = await WebBrowser.openAuthSessionAsync(r.url, 'lumo://banque');
    const etat = res.type === 'success' ? new URL(res.url).searchParams.get('etat') : 'annulee';
    if (etat === 'ok') { setAttente('Lecture de tes comptes…'); await recharger(); router.replace('/'); return; }
    setAttente(null);
    setErreur(etat === 'annulee' ? 'Connexion annulée. Tu peux réessayer.' : etat === 'expiree' ? 'Le lien a expiré. Réessaie.' : 'La connexion à ta banque a échoué. Réessaie.');
  };

  // renouvellement depuis l'alerte : on rouvre directement la même banque
  useEffect(() => { if (nom && !exemple) choisir(nom); }, [nom]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Feuille titre={premier ? 'Ta banque' : 'Connecter une banque'}>
      <Text style={{ color: C.texte, fontFamily: F.serif, fontSize: 30, lineHeight: 34, marginBottom: 8 }}>Connecte ta banque, <Text style={{ color: C.or, fontStyle: 'italic' }}>Lumo fait le reste.</Text></Text>
      <Doux style={{ marginBottom: 16 }}>Tes comptes, tes opérations classées, ton bilan et Lumi qui fouille pour toi : tout part de là. Mise à jour à chaque ouverture et plusieurs fois par jour.</Doux>
      <Carte style={{ gap: 10 }}>
        {GARANTIES.map((g) => (
          <View key={g} style={{ flexDirection: 'row', gap: 10 }}>
            <Text style={{ color: C.plus, fontFamily: F.sansGras }}>✓</Text>
            <T style={{ flex: 1, fontSize: 14.5 }}>{g}</T>
          </View>
        ))}
      </Carte>

      {!!erreur && <Text style={{ color: C.moins, fontFamily: F.sans, marginBottom: 12 }}>{erreur}</Text>}
      {attente && <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 12 }}><ActivityIndicator color={C.or} /><Doux>{attente.includes('…') ? attente : `Ouverture de ${attente}…`}</Doux></View>}

      {inactive ? (
        <Carte><Doux>{exemple ? 'Dans l’exemple, la connexion bancaire est désactivée.' : 'La connexion bancaire n’est pas encore activée sur Lumo. Elle arrive très vite.'}</Doux></Carte>
      ) : banques == null ? (
        <ActivityIndicator color={C.or} style={{ marginVertical: 20 }} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.carte2, borderRadius: 14, borderWidth: 1, borderColor: C.trait, paddingHorizontal: 14, marginBottom: 10 }}>
            <Icone nom="loupe" taille={18} couleur={C.pale} />
            <TextInput value={q} onChangeText={setQ} placeholder="Chercher ma banque" placeholderTextColor={C.pale} autoCorrect={false}
              style={{ flex: 1, color: C.texte, fontFamily: F.sans, fontSize: 16, paddingVertical: 14 }} accessibilityLabel="Chercher ma banque" />
          </View>
          <Carte style={{ paddingVertical: 2 }}>
            {liste.map((b) => (
              <Pressable key={b.name} onPress={() => choisir(b.name)} disabled={!!attente} accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.trait }}>
                <T style={{ flex: 1 }} nb={1}>{b.name}</T>
                <Icone nom="suite" taille={18} couleur={C.pale} />
              </Pressable>
            ))}
            {!liste.length && <Doux style={{ textAlign: 'center', paddingVertical: 18 }}>Aucune banque à ce nom.</Doux>}
          </Carte>
        </>
      )}
      <View style={{ marginTop: 6 }}><Bouton texte={premier ? 'Plus tard' : 'Fermer'} second onPress={premier ? plusTard : () => router.back()} /></View>
      {premier && <Doux style={{ textAlign: 'center', marginTop: 10, fontSize: 13 }}>Sans banque, Lumo marche avec tes chiffres saisis à la main.</Doux>}
    </Feuille>
  );
}
