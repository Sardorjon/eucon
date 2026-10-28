import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // DevExtreme ships ESM with directory imports that Node's resolver rejects; let Vite transform it.
    server: { deps: { inline: [/devextreme/] } },
  },
});
