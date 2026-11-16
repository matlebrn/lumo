// Lumo Plus : ce que l'abonnement ajoute. Le paiement arrivera plus tard (stores et web).
import { View } from 'react-native';
import { t } from '@/i18n';
import { C, F } from '@/theme';
import { Bouton, Carte, Doux, T } from '@/ui/base';
import { Feuille } from '@/ui/Feuille';

const AVANTAGES = [
  ['Ton argent jusqu’à 10 ans', 'Prévision longue, scénarios « et si… »'],
  ['Tous tes projets', 'Voiture, appart, crédit, investissement : chacun chiffré'],
  ['Ton plan complet', 'Toutes les étapes chiffrées pour t’en sortir ou faire mieux'],
  ['Lumi sans limite', 'Toutes tes questions, à n’importe quelle heure'],
  ['Tout ton patrimoine', 'Épargne, placements, immobilier, crypto, biens de valeur'],
  ['Lumo agit pour toi', 'Épargne automatique selon tes règles'],
];

export default function Plus() {
  return (
    <Feuille titre={t('commun.plus')}>
      <Doux style={{ marginBottom: 16 }}>La version gratuite te montre où tu en es. Lumo Plus te montre où tu vas, et t’aide à y arriver.</Doux>
      <Carte style={{ gap: 14 }}>
        {AVANTAGES.map(([titre, texte]) => (
          <View key={titre} style={{ flexDirection: 'row', gap: 12 }}>
            <T style={{ color: C.or, fontFamily: F.sansGras }}>✓</T>
            <View style={{ flex: 1 }}><T style={{ fontFamily: F.sansGras }}>{titre}</T><Doux>{texte}</Doux></View>
          </View>
        ))}
      </Carte>
      <Bouton texte={t('commun.bientot')} desactive onPress={() => {}} />
    </Feuille>
  );
}
