module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import', 'jsx-a11y', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript'
  ],
  settings: { react: { version: 'detect' } },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'import/no-cycle': 'error',
    'import/no-internal-modules': ['error', { forbid: ['**/src/**'] }],
    'react/prop-types': 'off',
    'react/jsx-no-constructed-context-values': 'warn'
  },
  overrides: [
    { files: ['**/*.js'], rules: { '@typescript-eslint/no-var-requires': 'off' } }
  ]
};


