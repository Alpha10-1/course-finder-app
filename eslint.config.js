import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dist-ssr', 'y', 'yes']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // `const { dropped, ...rest } = obj` is the idiomatic way to omit a key.
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  // Node-side code: Vercel functions, build/maintenance scripts.
  {
    files: ['api/**/*.js', 'scripts/**/*.mjs', '*.mjs', '*.js'],
    languageOptions: { globals: globals.node },
  },
  // Firebase Cloud Functions are CommonJS.
  {
    files: ['functions/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    files: ['**/*.test.{js,jsx}'],
    languageOptions: { globals: globals.node },
  },
])
