import { defineConfig } from 'rolldown';

export default defineConfig([
  // ESM build
  {
    input: {
      index:           'src/index.ts',
      types:           'src/types.ts',
      'route-matcher': 'src/route-matcher.ts',
      router:          'src/router.ts',
      outlet:          'src/outlet.ts',
      link:            'src/link.ts',
      components:      'src/components.ts',
    },
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].js',
      sourcemap: true,
    },
    external: ['@forge/core', '@forge/core/dom'],
  },
  // CJS build
  {
    input: {
      index:           'src/index.ts',
      types:           'src/types.ts',
      'route-matcher': 'src/route-matcher.ts',
      router:          'src/router.ts',
      outlet:          'src/outlet.ts',
      link:            'src/link.ts',
      components:      'src/components.ts',
    },
    output: {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: '[name].cjs',
      sourcemap: true,
    },
    external: ['@forge/core', '@forge/core/dom'],
  },
]);
