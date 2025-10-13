import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: [],
    setupFiles: ['./test/setup.ts'],
    server: {
      deps: {
        inline: [/@phoTool\/shared/]
      }
    },
    hookTimeout: 10000,
    testTimeout: 10000,
  },
});


