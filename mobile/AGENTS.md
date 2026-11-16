Appli Expo SDK 58 (React Native 0.88). Avant de toucher une API Expo, vérifier la doc de la version 58 : https://docs.expo.dev/versions/v58.0.0/
- Ajouter une dépendance avec `npx expo install`, jamais `npm install <paquet>`.
- Lancer `npm run typecheck` et `node --test ../tests/moteur.test.js` avant de livrer.
- Le moteur de calcul vit dans `../packages/moteur/moteur.js` ; après une modification, lancer `../scripts/copier-moteur.sh`.
- Respecter les règles de sécurité du README.
