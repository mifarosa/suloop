// Metro for an app that shares the game's plain JavaScript (../src) with the website.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const root = path.resolve(__dirname, '..');
const config = getDefaultConfig(__dirname);

// Files of the game that sit outside this folder are watched and bundled too.
config.watchFolders = [path.join(root, 'src')];
// Packages are looked up here first, so a module in ../src never reaches for ../node_modules.
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules')];

module.exports = config;
