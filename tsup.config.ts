import { codecovRollupPlugin } from '@codecov/rollup-plugin';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    error: 'src/error.ts',
    types: 'src/types.ts',
    auth: 'src/auth.ts',
    mock: 'src/mock.ts',
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
  esbuildPlugins: [],
  plugins: [
    codecovRollupPlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: 'valifetch',
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
    };
  },
});
