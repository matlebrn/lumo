// Lumo · noir profond et or champagne. Une seule source pour les couleurs, les polices et les espacements.
export const C = {
  fond: '#09090A', carte: '#131215', carte2: '#1A191D', trait: 'rgba(255,255,255,0.07)',
  texte: '#F3EFE6', doux: '#A39E93', pale: '#6F6B63',
  or: '#D9B56C', orClair: '#F6E3B0', orFonce: '#9C7A3C', surOr: '#1A1408',
  plus: '#8FCFA8', moins: '#E79382', alerte: '#E9B872',
  // catégories : palette vérifiée sur fond sombre (contraste, daltonisme)
  besoin: '#B08734', envie: '#5E83D1', epargne: '#2E9D6B', sorties: '#77716A',
} as const;

export const ton = { bon: C.plus, alerte: C.alerte, rouge: C.moins } as const;

export const F = {
  serif: 'InstrumentSerif_400Regular',
  sans: 'Geist_400Regular',
  sansMoyen: 'Geist_500Medium',
  sansGras: 'Geist_600SemiBold',
} as const;

export const E = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 28 } as const;
export const R = { carte: 20, champ: 14, puce: 999 } as const;
