import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'https://openapi.tossinvest.com/openapi-docs/latest/openapi.json',
  output: {
    module: {
      extension: '.js',
    },
    path: 'src/generated',
    postProcess: ['biome:format'],
    source: {
      fileName: 'spec',
    },
  },
  plugins: ['@hey-api/client-fetch', '@hey-api/sdk'],
});
