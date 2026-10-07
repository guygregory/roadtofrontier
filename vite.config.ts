import { defineConfig } from 'vite';

// base './' produces relative asset URLs so the build works on GitHub Pages
// regardless of the repository name (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    target: 'es2020',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
} as never);
