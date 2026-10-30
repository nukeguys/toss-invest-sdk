import assert from 'node:assert/strict';
import test from 'node:test';

import { Client, InMemoryTransport } from '@modelcontextprotocol/client';

import { createTossInvestMcpServer } from '../dist/server.js';

const readTools = [
  'toss_get_prices',
  'toss_get_trades',
  'toss_get_price_limit',
  'toss_get_orderbook',
  'toss_get_candles',
  'toss_get_stocks',
  'toss_list_stocks',
  'toss_get_stock_warnings',
  'toss_get_stock_investor_trading',
  'toss_get_stock_program_trades',
  'toss_get_stock_short_selling',
  'toss_get_stock_credit_trades',
  'toss_get_stock_securities_lending',
  'toss_get_exchange_rate',
  'toss_get_kr_market_calendar',
  'toss_get_us_market_calendar',
  'toss_get_rankings',
  'toss_get_investor_trading_rankings',
  'toss_list_sectors',
  'toss_get_sector_rankings',
  'toss_get_sector',
  'toss_get_sector_stocks',
  'toss_get_sector_etfs',
  'toss_get_market_indicator_prices',
  'toss_get_market_indicator_candles',
  'toss_get_market_indicator_investor_trading',
  'toss_list_accounts',
  'toss_get_holdings',
  'toss_list_orders',
  'toss_get_order',
  'toss_list_conditional_orders',
  'toss_get_conditional_order',
  'toss_get_buying_power',
  'toss_get_sellable_quantity',
  'toss_get_commissions',
];

const tradingTools = [
  'toss_create_order',
  'toss_modify_order',
  'toss_cancel_order',
  'toss_create_conditional_order',
  'toss_modify_conditional_order',
  'toss_cancel_conditional_order',
];

async function connect(t, tossClient, options) {
  const server = createTossInvestMcpServer(tossClient, options);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => {
    await client.close();
    await server.close();
  });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

test('exposes read tools by default and maps their arguments to the SDK', async (t) => {
  const calls = [];
  const client = await connect(t, {
    getHoldings: async (options) => {
      calls.push(['getHoldings', options]);
      return { data: { result: { items: [] } } };
    },
    getPrices: async (options) => {
      calls.push(['getPrices', options]);
      return { data: { result: [{ symbol: '005930' }] } };
    },
  });

  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map(({ name }) => name),
    readTools,
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

test('maps sector and investor ranking tools to the SDK', async (t) => {
  const calls = [];
  const sdk = new Proxy(
    {},
    {
      get: (_, method) => async (options) => {
        calls.push([method, options]);
        return { data: { result: [] } };
      },
    },
  );
  const client = await connect(t, sdk);
  const cases = [
    [
      'toss_get_investor_trading_rankings',
      { count: 5 },
      'getInvestorTradingRankings',
      { query: { count: 5 }, throwOnError: true },
    ],
    ['toss_list_sectors', {}, 'listSectors', { throwOnError: true }],
    [
      'toss_get_sector_rankings',
      { type: 'TOP_GAINERS', marketCountry: 'KR', duration: '1d' },
      'getSectorRankings',
      { query: { type: 'TOP_GAINERS', marketCountry: 'KR', duration: '1d' }, throwOnError: true },
    ],
    ...[
      ['sector', 'getSector'],
      ['sector_stocks', 'getSectorStocks'],
      ['sector_etfs', 'getSectorEtfs'],
    ].map(([tool, method]) => [
      `toss_get_${tool}`,
      { sectorId: '123', marketCountry: 'KR' },
      method,
      { path: { sectorId: '123' }, query: { marketCountry: 'KR' }, throwOnError: true },
    ]),
  ];
  for (const [name, args, method, options] of cases) {
    const result = await client.callTool({ name, arguments: args });
    assert.notEqual(result.isError, true);
    assert.deepEqual(calls.at(-1), [method, options]);
  }
  const invalid = await client.callTool({
    name: 'toss_get_sector',
    arguments: { sectorId: '../', marketCountry: 'KR' },
  });
  assert.equal(invalid.isError, true);
  assert.equal(calls.length, cases.length);
});

test('exposes trading tools only when enabled and validates order input', async (t) => {
  const calls = [];
  const client = await connect(
    t,
    {
      createConditionalOrder: async (options) => {
        calls.push(['createConditionalOrder', options]);
        return { data: { result: { conditionalOrderId: 'conditional-1' } } };
      },
      createOrder: async (options) => {
        calls.push(['createOrder', options]);
        return { data: { result: { orderId: 'order-1' } } };
      },
    },
    { allowTrading: true },
  );

  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map(({ name }) => name),
    [...readTools, ...tradingTools],
  );
  const mutations = tools.filter((tool) => tradingTools.includes(tool.name));
  assert.ok(
    mutations.every(
      (tool) =>
        tool.annotations?.readOnlyHint === false && tool.annotations.destructiveHint === true,
    ),
  );

  const invalid = await client.callTool({
    arguments: {
      accountSeq: 7,
      clientOrderId: 'test-order-1',
      orderType: 'MARKET',
      quantity: '1',
      side: 'BUY',
      symbol: '005930',
      price: '70000',
    },
    name: 'toss_create_order',
  });
  assert.equal(invalid.isError, true);

  await client.callTool({
    arguments: {
      accountSeq: 7,
      clientOrderId: 'test-order-1',
      orderType: 'LIMIT',
      price: '70000',
      quantity: '1',
      side: 'BUY',
      symbol: '005930',
    },
    name: 'toss_create_order',
  });
  assert.deepEqual(calls, [
    [
      'createOrder',
      {
        body: {
          clientOrderId: 'test-order-1',
          confirmHighValueOrder: false,
          orderType: 'LIMIT',
          price: '70000',
          quantity: '1',
          side: 'BUY',
          symbol: '005930',
          timeInForce: 'DAY',
        },
        headers: { 'X-Tossinvest-Account': 7 },
        throwOnError: true,
      },
    ],
  ]);

  const conditionalOrder = {
    accountSeq: 7,
    clientOrderId: 'conditional-order-1',
    expireDate: '2026-12-31',
    first: { orderPrice: '69000', orderSide: 'BUY', triggerPrice: '70000' },
    orderType: 'LIMIT',
    quantity: '1',
    second: { orderPrice: '75000', orderSide: 'SELL', triggerPrice: '75000' },
    symbol: '005930',
    type: 'OCO',
  };
  const invalidConditional = await client.callTool({
    arguments: { ...conditionalOrder, type: 'SINGLE' },
    name: 'toss_create_conditional_order',
  });
  assert.equal(invalidConditional.isError, true);

  await client.callTool({
    arguments: conditionalOrder,
    name: 'toss_create_conditional_order',
  });
  assert.deepEqual(calls[1], [
    'createConditionalOrder',
    {
      body: {
        clientOrderId: 'conditional-order-1',
        confirmHighValueOrder: false,
        expireDate: '2026-12-31',
        first: { orderPrice: '69000', orderSide: 'BUY', triggerPrice: '70000' },
        orderType: 'LIMIT',
        quantity: '1',
        second: { orderPrice: '75000', orderSide: 'SELL', triggerPrice: '75000' },
        symbol: '005930',
        type: 'OCO',
      },
      headers: { 'X-Tossinvest-Account': 7 },
      throwOnError: true,
    },
  ]);
});

test('requires a separate permission for high-value orders', async (t) => {
  const calls = [];
  const tossClient = {
    createOrder: async (options) => {
      calls.push(options);
      return { data: { result: { orderId: 'order-1' } } };
    },
  };
  const deniedClient = await connect(t, tossClient, { allowTrading: true });
  const order = {
    accountSeq: 7,
    clientOrderId: 'high-value-order-1',
    confirmHighValueOrder: true,
    orderType: 'LIMIT',
    price: '100000000',
    quantity: '1',
    side: 'BUY',
    symbol: '005930',
  };

  const denied = await deniedClient.callTool({ arguments: order, name: 'toss_create_order' });
  assert.equal(denied.isError, true);
  assert.match(denied.content[0].text, /allow-high-value-orders/);
  assert.equal(calls.length, 0);

  const allowedClient = await connect(t, tossClient, {
    allowHighValueOrders: true,
    allowTrading: true,
  });
  const allowed = await allowedClient.callTool({ arguments: order, name: 'toss_create_order' });
  assert.equal(allowed.isError, undefined);
  assert.equal(calls.length, 1);
});

test('rejects high-value permission without trading permission', () => {
  assert.throws(
    () => createTossInvestMcpServer({}, { allowHighValueOrders: true }),
    /requires allowTrading/,
  );
});
