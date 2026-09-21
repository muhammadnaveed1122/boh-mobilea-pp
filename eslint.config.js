const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const sonarjs = require('eslint-plugin-sonarjs');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'build/**',
      'ios/**',
      'android/**',
      'coverage/**',
      'expo-env.d.ts',
      'nativewind-env.d.ts',
      'babel.config.js',
      'metro.config.js',
      'tailwind.config.js',
    ],
  },

  // Expo preset (bundles eslint:recommended, @typescript-eslint,
  // react, react-hooks, react-native, import). Owns all RN rules.
  expoConfig,

  // SonarJS code-smell rules. Recommended set targets quality
  // (cognitive complexity, dup code, dead code) — does not redefine
  // any rule already owned by Expo's RN/React/TS plugins.
  sonarjs.configs.recommended,

  {
    rules: {
      // Tune Sonar defaults for an RN/Expo codebase.
      'sonarjs/cognitive-complexity': ['warn', 20],
      'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
      // Sonar flags TODO/FIXME — keep as warning, not error.
      'sonarjs/todo-tag': 'warn',
      'sonarjs/fixme-tag': 'warn',
      // Disable rules that fight idiomatic RN/React patterns.
      'sonarjs/no-nested-conditional': 'off', // ternaries common in JSX
      'sonarjs/prefer-read-only-props': 'off', // noisy on RN component props
    },
  },

  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // TS handles undefined symbols; turning off avoids false positives
      // with type-only imports and ambient JSX globals.
      'no-undef': 'off',
    },
  },

  // MUST be last: turns off every formatting rule that would conflict
  // with Prettier (and by extension, Sonar's stylistic rules).
  prettierConfig,
]);
