// Les quatre onglets. Sans espace ouvert, on passe par l'accueil.
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { CLE_PLUS_TARD, coffre } from '@/securite/stockage';
import { ActivityIndicator, Text, View } from 'react-native';
import { useDonnees } from '@/donnees/Donnees';
import { t } from '@/i18n';
import { C, F } from '@/theme';
import { Bouton } from '@/ui/base';
import { Icone, type NomIcone } from '@/ui/Icone';

const ONGLETS: [string, NomIcone][] = [['index', 'aujourdhui'], ['analyse', 'analyse'], ['prevision', 'prevision'], ['projets', 'projets']];

export default function Onglets() {
  const { etat, erreur, recharger, c, d, exemple } = useDonnees();
  // première ouverture : sans compte bancaire ni refus explicite, on propose d'abord de connecter sa banque
  const [plusTard, setPlusTard] = useState<boolean | null>(null);
  useEffect(() => { coffre.getItem(CLE_PLUS_TARD).then((v) => setPlusTard(v === 'oui')); }, [etat]);
  if (etat === 'demarrage') return <View style={{ flex: 1, backgroundColor: C.fond, justifyContent: 'center' }}><ActivityIndicator color={C.or} /></View>;
  if (etat === 'accueil') return <Redirect href="/accueil" />;
  if (etat === 'pret' && !exemple && plusTard === false && d && !d.comptes.length) return <Redirect href={{ pathname: '/banque', params: { premier: '1' } }} />;
  if (etat === 'erreur') return (
    <View style={{ flex: 1, backgroundColor: C.fond, justifyContent: 'center', padding: 24, gap: 16 }}>
      <Text style={{ color: C.texte, fontFamily: F.serif, fontSize: 32 }}>Lumo ne répond pas.</Text>
      <Text style={{ color: C.doux, fontFamily: F.sans }}>Vérifie ta connexion, puis réessaie. ({erreur})</Text>
      <Bouton texte="Réessayer" onPress={recharger} />
    </View>
  );
  const nAClasser = c?.aClasser.length ?? 0, nAlertes = c?.alertes.length ?? 0;
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: C.or, tabBarInactiveTintColor: C.pale,
      tabBarStyle: { backgroundColor: 'rgba(9,9,10,0.96)', borderTopColor: C.trait },
      tabBarLabelStyle: { fontFamily: F.sansMoyen, fontSize: 10.5 },
      tabBarBadgeStyle: { backgroundColor: C.or, color: C.surOr, fontSize: 10 },
    }}>
      {ONGLETS.map(([nom, icone]) => (
        <Tabs.Screen key={nom} name={nom} options={{
          title: t(`onglets.${icone}`),
          tabBarIcon: ({ color }) => <Icone nom={icone} couleur={String(color)} taille={23} />,
          tabBarBadge: nom === 'analyse' && nAClasser ? nAClasser : nom === 'index' && nAlertes ? nAlertes : undefined,
        }} />
      ))}
    </Tabs>
  );
}
