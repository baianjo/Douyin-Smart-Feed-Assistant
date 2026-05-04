import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    userscript: 'src/entry/userscript.ts',
  },
  outDir: '.build',
  format: ['iife'],
  target: 'es2020',
  platform: 'browser',
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: false,
  minify: false,
  treeshake: false,
});
