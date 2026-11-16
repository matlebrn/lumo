#!/bin/sh
# Le moteur de calcul existe en un seul exemplaire : packages/moteur/moteur.js.
# L'appli web le sert tel quel depuis public/ : on le recopie après chaque changement.
cd "$(dirname "$0")/.." && cp packages/moteur/moteur.js public/moteur.js && echo "moteur recopié dans public/"
