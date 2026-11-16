# Lumo · appli iPhone et Android

La vraie appli de Lumo, construite avec Expo (React Native) : un seul code pour iPhone, Android et le web.
L'appli web d'origine (`../public`) reste en ligne pendant la transition.

## Organisation
- `app/` : les écrans (Expo Router). `(onglets)/` : Aujourd'hui, Analyse, Prévision, Projets. Fenêtres : `lumi`, `operation` (classer), `reglages`, `plus`. Première ouverture : `accueil`.
- `src/donnees/` : chargement des données (serveur ou exemple) et calculs (`calcul.ts`, via le moteur partagé).
- `src/securite/` : coffre chiffré du téléphone (`stockage.ts`), verrouillage Face ID / empreinte (`Verrou.tsx`).
- `src/droits.ts` : ce que permet chaque formule (gratuit, Lumo Plus).
- `src/i18n/` : tous les textes (français d'abord) et les formats. Un pays de plus = un fichier de plus.
- `src/lumi/` : bouton Lumi présent sur chaque écran, styles de Lumi, résumé envoyé au serveur.
- `src/ui/` : briques d'écran, icônes, graphiques SVG.
- `../packages/moteur/` : le moteur de calcul, partagé avec l'appli web et testé (`node --test ../tests/`).

## Sécurité (règles à garder)
1. Aucune clé secrète dans l'appli : seulement la clé publiable Supabase. Tout ce qui est sensible passe par les fonctions serveur.
2. Chaque ligne de la base n'est lisible que par son propriétaire (règles d'accès). Toute nouvelle table : règles d'accès dans la même migration.
3. La session est gardée dans le coffre du téléphone (Trousseau iOS, Keystore Android), accessible seulement appareil déverrouillé, jamais sauvegardée ailleurs.
4. Verrouillage Face ID / empreinte à l'ouverture et après 1 minute en arrière-plan ; un voile cache les montants dans le sélecteur d'applis.
5. Le plan (gratuit / Plus) est lu dans la table `droits`, que l'appli ne peut pas modifier. Les limites qui coûtent (Lumi, banques) sont appliquées par le serveur.
6. Lumi fouille dans les comptes avec des outils en lecture seule (`../packages/moteur/outils.js`) qui tournent **sur le téléphone** : la fonction serveur `lumi` relaie seulement au modèle (clé, limites du plan, messages vérifiés) et ne lit jamais la banque. Les outils permis et leurs descriptions sont fixés par le serveur. Le ton est choisi par identifiant ; les consignes restent sur le serveur.
7. Android : sauvegarde automatique désactivée, permissions inutiles bloquées.

## Commandes
```bash
npm install
npx expo start            # développement (une version de développement est nécessaire pour Face ID)
npm run typecheck         # vérification des types
npm run web:export        # version web dans dist/
node tests/parcours-lumi.js   # Lumi qui fouille, avec un faux serveur
npx eas-cli@latest build --profile preview --platform all   # versions de test iPhone et Android
```
