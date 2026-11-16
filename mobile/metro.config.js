// Metro doit voir le moteur de calcul partagé, qui vit hors de ce dossier (../packages/moteur).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../packages')];
module.exports = config;
