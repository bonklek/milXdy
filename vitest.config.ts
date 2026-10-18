import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Temporary checkouts and generated fixtures must not join workspace tests.
    exclude: [...configDefaults.exclude, 'tmp/**'],
  },
});
