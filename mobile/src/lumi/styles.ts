// Les 4 façons dont Lumi peut parler. Le serveur ne connaît que ces identifiants : le texte des consignes
// reste côté serveur, l'appli n'envoie jamais d'instructions libres au modèle.
export const STYLES = [
  { id: 'coach', nom: 'Coach bienveillant', exemple: 'Tu t’en sors bien ce mois-ci. On regarde ensemble comment garder 50 € de plus ?' },
  { id: 'expert', nom: 'Expert sobre', exemple: 'Solde prévu le 28 : 312 €. Écart avec la moyenne : +48 €.' },
  { id: 'direct', nom: 'Direct', exemple: 'Tes restos te coûtent 180 € par mois. Divise par deux, tu gagnes 1 000 € par an.' },
  { id: 'ludique', nom: 'Ludique', exemple: 'Défi de la semaine : zéro livraison de repas. Ton portefeuille dit merci 🍕' },
] as const;
export type StyleLumi = (typeof STYLES)[number]['id'];
