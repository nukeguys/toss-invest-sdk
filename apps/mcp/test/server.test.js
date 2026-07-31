import assert from 'node:assert/strict';
import test from 'node:test';

import { Client, InMemoryTransport } from '@modelcontextprotocol/client';

import { createTossInvestMcpServer } from '../dist/server.js';

test('lists only read tools and maps their arguments to the SDK', async (t) => {
  const calls = [];
  const tossClient = {
    getHoldings: async (options) => {
      calls.push(['getHoldings', options]);
      return { data: { result: { items: [] } } };
    },
    getPrices: async (options) => {
      calls.push(['getPrices', options]);
      return { data: { result: [{ symbol: '005930' }] } };
    },
  };

  const server = createTossInvestMcpServer(tossClient);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => {
    await client.close();
    await server.close();
  });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map(({ name }) => name),
    [
      'toss_get_prices',
      'toss_get_orderbook',
      'toss_get_candles',
      'toss_get_stocks',
      'toss_list_accounts',
      'toss_get_holdings',
      'toss_list_orders',
      'toss_get_buying_power',
    ],
  );
  assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint === true));

  const prices = await client.callTool({
    arguments: { symbols: ['005930', 'AAPL'] },
    name: 'toss_get_prices',
  });
  assert.deepEqual(JSON.parse(prices.content[0].text), [{ symbol: '005930' }]);

  await client.callTool({
    arguments: { accountSeq: 7, symbol: '005930' },
    name: 'toss_get_holdings',
  });
  assert.deepEqual(calls, [
    ['getPrices', { query: { symbols: '005930,AAPL' }, throwOnError: true }],
    [
      'getHoldings',
      {
        headers: { 'X-Tossinvest-Account': 7 },
        query: { symbol: '005930' },
        throwOnError: true,
      },
    ],
  ]);
});
