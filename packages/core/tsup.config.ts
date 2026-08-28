import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  target: 'node18',
  clean: true,
  dts: true,
  outDir: 'dist',
  outExtension: (context) => (context.format === 'esm' ? { js: '.mjs' } : {}),
  splitting: false,
  treeshake: true,
});
