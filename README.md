# Lumo

Ton argent, en pleine lumière. Appli web installable (PWA), chiffrée de bout en bout, 100 % perso.

- **Accueil** : où tu en es, reste à vivre jusqu'à la paie
- **Tableau** : comme sur Excel — tu saisis tes dépenses et rentrées, les opérations de ta banque arrivent toutes seules, classées automatiquement ; quand Lumo hésite, une alerte te demande de choisir
- **Objectifs** : avec une date → combien mettre par mois ; avec un montant par mois → en combien de temps
- **Comptes** : comptes courants et épargne
- **Lumi** : l'assistant IA

## Organisation
- `lumo/` : la couche Lumo (`lumo.js`, `lumo.css`, animation d'ouverture, logo, polices) et `lumo/base/` (moteur d'origine)
- `lumo/patch.py` : construit `public/` à partir de `lumo/base/` + `lumo/` → `python3 lumo/patch.py`
- `public/` : l'appli publiée (générée, ne pas modifier à la main)
- `supabase/functions/` : banque chiffrée et assistant IA ; `supabase/migrations/` : actualisation bancaire 4 fois par jour

Les données de Lumo sont rangées à part (préfixe `lumo/`) dans le coffre chiffré.

## Tests
```
pip install -r tests/requirements.txt && python -m playwright install chromium
python -m pytest tests -q
```
