import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    // Classic, high-value hook rules only. eslint-plugin-react-hooks v7's bundled
    // `recommended` preset also enables experimental React-Compiler purity rules
    // (set-state-in-effect, refs-during-render, immutability) that flag idiomatic
    // hand-written React (the "latest ref" pattern, fetch/timer effects). We keep
    // the stable rules and leave the experimental ones off.
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Vite config runs in Node.
    files: ['vite.config.js'],
    languageOptions: { globals: globals.node },
  },
])
