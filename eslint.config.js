import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'app/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser
    },
    rules: {
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error'
    }
  },
  {
    files: ['*.config.js', 'tests/**'],
    languageOptions: { globals: globals.node }
  }
];
