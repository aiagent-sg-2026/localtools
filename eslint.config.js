import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
export default [{ ignores:['dist','node_modules'], files:['**/*.{ts,js}'], languageOptions:{parser}, plugins:{'@typescript-eslint':tseslint}, rules:{'no-eval':'error','no-implied-eval':'error','no-inner-declarations':'error','@typescript-eslint/no-explicit-any':'warn'}}];
