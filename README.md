# Lumo

Ton argent, dans le temps. Appli web installable sur iPhone (écran d'accueil).

Lumo relie ta banque et prévoit tes revenus et tes dépenses sur 10 ans, pour savoir quand un projet devient possible et s'il est rentable.

- **Prévision** : ce que tu auras dans 1, 3, 5 ou 10 ans, avec et sans tes projets, et les alertes (découvert, coussin entamé)
- **Projets** : achat, investissement, changement de vie, crédit. Pour chacun : la date au plus tôt, ce qu'il manque, la mensualité, la rentabilité
- **Budget** : revenus et dépenses réguliers (repérés dans la banque ou saisis), dépenses courantes
- **Lumi** : l'assistant, qui répond à partir de la prévision

## Organisation
- `public/moteur.js` : le calcul (pur, testé) ; `public/app.js` : les écrans ; `public/app.css` : le style. Aucune étape de construction.
- `supabase/migrations/` : la base (`profils`, `comptes`, `operations`, `flux`, `projets`), chaque ligne lisible par son seul propriétaire
- `supabase/functions/bank` : connexion bancaire Enable Banking, actualisée 4 fois par jour
- `supabase/functions/coach` : Lumi

## Réglages serveur (secrets des fonctions Supabase)
- `EB_APP_ID`, `EB_PRIVATE_KEY` : connexion bancaire (application Enable Banking, adresse de retour `…/functions/v1/bank/callback`)
- `ANTHROPIC_API_KEY` : Lumi

## Tests
`node --test tests/` (le parcours des écrans demande Playwright et Chromium).

## Hypothèses de calcul
Mois par mois, en euros d'aujourd'hui, avant impôts. Mensualités hors assurance. Un projet est « possible » quand le solde ne passe jamais sous le coussin de sécurité ensuite.
