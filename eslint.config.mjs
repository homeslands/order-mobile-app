import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactNative from 'eslint-plugin-react-native'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'node_modules',
      '.expo',
      'android',
      'ios',
      'dist',
      'build',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.es2021,
        __DEV__: 'readonly',
      },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-native': reactNative,
    },
    rules: {
      /* React */
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',

      /* Hooks */
      ...reactHooks.configs.recommended.rules,

      /* React Native */
      'react-native/no-unused-styles': 'warn',
      'react-native/split-platform-components': 'warn',

      /* TypeScript */
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
      ],

      /* Ban any */
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',

      /* Console */
      'no-console':
        process.env.NODE_ENV === 'production' ? 'error' : 'warn',

      /* Performance: prevent regressions to slower primitives */
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: 'react-native',
            importNames: ['Image'],
            message: 'Use expo-image instead: import { Image } from "expo-image". See CLAUDE.md performance rules.',
          },
          // Note: FlatList is intentionally not restricted — it is acceptable for small
          // carousels, data-tables, and horizontal lists where FlashList overhead is not needed.
          // For vertical scrolling lists > 20 items, prefer FlashList (see CLAUDE.md).
        ],
      }],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
)


