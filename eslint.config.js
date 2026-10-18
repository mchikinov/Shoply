import js from '@eslint/js';
import vue from 'eslint-plugin-vue';
import ts from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Проверяем исходники фронтенда и конфигурацию; данные каталога и сборку не форматируем.
export default ts.config(
  { ignores: ['public/**', '.frontend-build/**', 'node_modules/**'] },
  {
    files: ['frontend/**/*.{ts,vue}', 'vite.config.ts'],
    extends: [js.configs.recommended, ...ts.configs.recommended],
  },
  ...vue.configs['flat/recommended'],
  {
    files: ['frontend/**/*.vue'],
    languageOptions: { parserOptions: { parser: ts.parser } },
    rules: {
      'vue/multi-word-component-names': ['error', { ignores: ['App'] }],
    },
  },
  prettier,
);
