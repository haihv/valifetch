import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    error: 'src/error.ts',
    types: 'src/types.ts',
    auth: 'src/auth.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: true,
  target: 'es2022',
  outDir: 'dist',
  treeshake: true,
  splitting: true,
  external: ['valibot'],
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
    };
  },
});
