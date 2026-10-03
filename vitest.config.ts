import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    // Testes de performance sao explicitos (test:perf / test:p -- <etapa>), nao
    // entram no `npm test` enquanto a meta ainda nao foi implementada.
    exclude: [...configDefaults.exclude, 'tests/**/perf/**'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
