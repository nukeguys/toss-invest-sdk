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
  plugins: [
    '@hey-api/client-fetch',
    {
      name: '@hey-api/sdk',
      operations: {
        containerName: 'TossInvestApi',
        strategy: 'single',
      },
    },
    {
      name: 'zod',
      dates: {
        offset: true,
      },
      metadata: true,
      requests: true,
      responses: false,
    },
  ],
});
