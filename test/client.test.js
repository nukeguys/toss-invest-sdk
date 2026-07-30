import assert from 'node:assert/strict';
import test from 'node:test';

import { createTossInvestClient, getHoldings, getPrices } from '../dist/index.js';

const json = (body, init) =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

test('reuses, refreshes, and invalidates access tokens', async (t) => {
  const originalNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  t.after(() => {
    Date.now = originalNow;
  });

  let tokenRequests = 0;
  let rejectNextApiRequest = false;
  const authorizationHeaders = [];
  const accountHeaders = [];

  const client = createTossInvestClient({ clientId: 'client-id', clientSecret: 'client-secret' });
  client.setConfig({
    fetch: async (request) => {
      const url = new URL(request.url);

      if (url.pathname === '/oauth2/token') {
        tokenRequests += 1;
        const body = new URLSearchParams(await request.text());
        assert.equal(body.get('grant_type'), 'client_credentials');
        assert.equal(body.get('client_id'), 'client-id');
        assert.equal(body.get('client_secret'), 'client-secret');
        return json({
          access_token: `token-${tokenRequests}`,
          expires_in: 3_600,
          token_type: 'Bearer',
        });
      }

      authorizationHeaders.push(request.headers.get('Authorization'));
      accountHeaders.push(request.headers.get('X-Tossinvest-Account'));

      if (rejectNextApiRequest) {
        rejectNextApiRequest = false;
        return json(
          { error: { code: 'expired-token', message: 'expired', requestId: 'request-id' } },
          { status: 401 },
        );
      }

      return json({ result: [] });
    },
  });

  await Promise.all([
    getPrices({ client, query: { symbols: '005930' } }),
    getPrices({ client, query: { symbols: '000660' } }),
  ]);
  assert.equal(tokenRequests, 1);

  await getHoldings({
    client,
    headers: { 'X-Tossinvest-Account': 1 },
  });
  assert.equal(tokenRequests, 1);
  assert.equal(accountHeaders.at(-1), '1');

  now += 3_570_000;
  await getPrices({ client, query: { symbols: '005930' } });
  assert.equal(tokenRequests, 2);

  rejectNextApiRequest = true;
  const expiredResponse = await getPrices({ client, query: { symbols: '005930' } });
  assert.equal(expiredResponse.response?.status, 401);

  await getPrices({ client, query: { symbols: '005930' } });
  assert.equal(tokenRequests, 3);
  assert.deepEqual(authorizationHeaders, [
    'Bearer token-1',
    'Bearer token-1',
    'Bearer token-1',
    'Bearer token-2',
    'Bearer token-2',
    'Bearer token-3',
  ]);
});

test('retries token issuance after a failure', async () => {
  let tokenRequests = 0;
  const client = createTossInvestClient({ clientId: 'client-id', clientSecret: 'client-secret' });

  client.setConfig({
    fetch: async (request) => {
      if (new URL(request.url).pathname !== '/oauth2/token') {
        return json({ result: [] });
      }

      tokenRequests += 1;
      return tokenRequests === 1
        ? json({ error: 'temporarily-unavailable' }, { status: 500 })
        : json({ access_token: 'token', expires_in: 3_600, token_type: 'Bearer' });
    },
  });

  await assert.rejects(getPrices({ client, query: { symbols: '005930' }, throwOnError: true }));
  await getPrices({ client, query: { symbols: '005930' } });
  assert.equal(tokenRequests, 2);
});
