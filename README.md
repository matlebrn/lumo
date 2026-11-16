# Lumo

Ton argent, dans le temps. Appli web installable sur iPhone (écran d'accueil).

Lumo relie ta banque et t'aide à gérer ton argent : il classe chaque opération, fait ton bilan (ce qui va, ce qui ne va pas, quoi faire), et prévoit tes revenus et tes dépenses sur 10 ans pour savoir quand un projet devient possible.

- **Aujourd'hui** : tous tes comptes, le mois en cours depuis la paie, les alertes
- **Analyse** : *Bilan* (note sur 100, rentrées et sorties sur 12 mois, ce qui va / ce qui ne va pas, plan pour s'en sortir ou faire mieux, répartition 50/30/20, abonnements) ; *Opérations* (chaque opération classée, Lumo demande quand il hésite, une règle par libellé) ; *Budget* (revenus et dépenses réguliers pour la prévision)
- **Prévision** : ce que tu auras dans 1, 3, 5 ou 10 ans, avec et sans tes projets, et les alertes (découvert, coussin entamé)
- **Projets** : achat, investissement, changement de vie, crédit. Pour chacun : la date au plus tôt, ce qu'il manque, la mensualité, la rentabilité
- **Lumi** : l'assistant, qui répond à partir de la prévision

## Organisation
- `public/moteur.js` : le calcul (pur, testé) ; `public/app.js` : les écrans ; `public/app.css` : le style. Aucune étape de construction.
- `supabase/migrations/` : la base (`profils`, `comptes`, `operations`, `flux`, `projets`, `classements`), chaque ligne lisible par son seul propriétaire
- `supabase/functions/bank` : connexion bancaire Enable Banking, actualisée 4 fois par jour
- `supabase/functions/coach` : Lumi

## Réglages serveur (secrets des fonctions Supabase)
- `EB_APP_ID`, `EB_PRIVATE_KEY` : connexion bancaire (application Enable Banking, adresse de retour `…/functions/v1/bank/callback`)
- `ANTHROPIC_API_KEY` : Lumi

## Tests
`node --test tests/` (le parcours des écrans demande Playwright et Chromium).

## Hypothèses de calcul
Mois par mois, en euros d'aujourd'hui, avant impôts. Mensualités hors assurance. Un projet est « possible » quand le solde ne passe jamais sous le coussin de sécurité ensuite.

## Accès : une personne pour l'instant, grand public ensuite
`CONNEXION_PUBLIQUE = false` (en haut de `public/app.js`) : pas de page de connexion. Au premier lancement, Lumo crée un espace sans e-mail ni mot de passe (connexion anonyme Supabase, à activer dans Authentication → Sign In / Providers → « Allow anonymous sign-ins »). L'espace est lié à l'appareil.
Pour le grand public : passer `CONNEXION_PUBLIQUE` à `true` (la page de connexion et la création de compte reviennent). Les données sont déjà séparées par personne (règles d'accès par ligne) ; un espace anonyme pourra être rattaché à un e-mail sans perdre ses données (`auth.updateUser({ email })`).
