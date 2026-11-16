// Tous les textes de l'appli, en français. Pour un nouveau pays : un fichier de plus, même forme.
export const fr = {
  onglets: { aujourdhui: 'Aujourd’hui', analyse: 'Analyse', prevision: 'Prévision', projets: 'Projets' },
  commun: { exemple: 'Exemple : rien n’est enregistré.', fermer: 'Fermer', plus: 'Lumo Plus', bientot: 'Bientôt disponible', parMois: 'par mois' },
  aujourdhui: {
    bonjour: 'Bonjour {prenom}', titre: 'Aujourd’hui', surComptes: 'Sur tous tes comptes', enSixMois: '{v} en 6 mois',
    depuisPaie: 'Depuis ta paie du {jour}', depuisDebut: 'Depuis le 1er {mois}', peuxDepenser: 'Tu peux encore dépenser',
    jusquau: 'jusqu’au {jour}', parJour: '{v} par jour', depense: 'Dépensé', rentre: 'Rentré', deCote: 'Mis de côté',
    ouPart: 'Où part ton argent', tesComptes: 'Tes comptes', tonBilan: 'Ton bilan', aAmeliorer: '{n} point(s) à améliorer', rienInquietant: 'Rien d’inquiétant',
    genres: { courant: 'Disponible', epargne: 'Épargne', placement: 'Placements' },
  },
  analyse: {
    titre: 'Analyse', bilan: 'Bilan', operations: 'Opérations', sante: 'Ta santé financière',
    reste: 'Il te reste en moyenne {v} par mois, {p} % de tes revenus.', manque: 'Chaque mois, il te manque en moyenne {v}.',
    rentreSort: 'Ce qui rentre, ce qui sort', rentrees: 'Rentrées', sorties: 'Sorties', vaPas: 'Ce qui ne va pas', va: 'Ce qui va bien',
    sEnSortir: 'Comment t’en sortir', faireMieux: 'Pour faire encore mieux', garderEnPlus: 'Ce que tu pourrais garder en plus',
    planVerrouille: '{n} autre(s) étape(s) chiffrée(s) dans ton plan', abonnements: 'Tes abonnements', parAn: '{v} par an',
    hesite: 'Lumo hésite sur {n} dépense(s). Dis-lui où les ranger.', aClasser: 'À classer', pasAssez: 'Lumo a besoin d’au moins un mois complet d’opérations pour faire ton bilan.',
    cestQuoi: 'C’est quoi ?', toutesMemes: 'S’applique aux {n} opérations de ce nom, et aux prochaines.',
  },
  prevision: { titre: 'Prévision', dansXTu: 'Dans {d}, tu auras environ', parRapport: '{v} par rapport à aujourd’hui', chaqueMois: 'Chaque mois', revenus: 'Revenus', fixes: 'Dépenses fixes', courantes: 'Dépenses courantes', reste: 'Il te reste', note: 'Estimation en euros d’aujourd’hui, avant impôts. Pas une promesse.', debloque: 'Vois ton argent jusqu’à 10 ans' },
  projets: { titre: 'Projets', vide: 'Une voiture, un appartement, un crédit ? Lumo te dit quand c’est possible.', possible: 'Possible dès {mois}', tropJuste: 'Trop juste en {mois}', horsPortee: 'Hors de portée avant 10 ans', enCours: 'Déjà lancé', unSeul: 'La version gratuite suit un projet. Lumo Plus les suit tous.' },
  lumi: { titre: 'Lumi', demander: 'Demander à Lumi', placeholder: 'Écris ta question', reflechit: 'Lumi réfléchit…', exemple: 'Dans l’exemple, Lumi est en veille. Avec ton compte, il répond avec tes vrais chiffres.', limite: 'Tu as posé tes {n} questions du jour. Lumo Plus les rend illimitées.' },
  accueil: {
    bienvenue: 'Bienvenue sur Lumo', situation: 'Ta situation', objectif: 'Ce qui t’amène', style: 'Comment Lumi te parle', commencer: 'Commencer', voirExemple: 'Voir un exemple',
    situations: { etudiant: 'Étudiant', salarie: 'Salarié', famille: 'En famille', independant: 'Indépendant', retraite: 'Retraité' },
    objectifs: { finDeMois: 'Finir le mois sereinement', projet: 'Financer un projet', grossir: 'Faire grossir mon argent', sortir: 'Sortir d’une passe difficile' },
  },
  reglages: { titre: 'Réglages', verrou: 'Verrouiller avec Face ID', verrouAide: 'Demandé à chaque ouverture et après une minute en arrière-plan.', styleLumi: 'Style de Lumi', securite: 'Sécurité', securiteTexte: 'Lumo lit tes comptes, il ne peut ni payer ni virer. Tes identifiants bancaires ne passent jamais par Lumo. Ta session est gardée dans le coffre chiffré du téléphone.' },
  verrou: { titre: 'Lumo est verrouillé', deverrouiller: 'Déverrouiller', raison: 'Déverrouille Lumo' },
} as const;
