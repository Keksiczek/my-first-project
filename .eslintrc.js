module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: 'standard',
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    semi: ['error', 'always'],
    quotes: ['error', 'single'],
    indent: ['error', 2],
    'no-unused-vars': ['warn'],
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off'
  }
};
