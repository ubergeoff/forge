import { defineConfig } from 'rolldown';

export default defineConfig({
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
  external: ['@vorra/core', '@vorra/core/dom'],
});
