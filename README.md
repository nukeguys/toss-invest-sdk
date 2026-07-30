# Toss Securities Open API SDK

TypeScript SDK generated from the Toss Securities Open API specification with Hey API. Access
tokens are issued lazily, cached until 30 seconds before expiry, and shared by concurrent requests.

## Requirements

- Node.js 22.18 or later
- pnpm

## Usage

Keep credentials in your application's environment and pass them to the SDK.

```ts
import { createTossInvestClient } from 'toss-sdk';

const clientId = process.env.TOSS_CLIENT_ID;
const clientSecret = process.env.TOSS_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  throw new Error('TOSS_CLIENT_ID and TOSS_CLIENT_SECRET are required');
}

const client = createTossInvestClient({ clientId, clientSecret });
const prices = await client.getPrices({
  query: { symbols: '005930,000660' },
});
```

The SDK does not retry an API call that returns `401`. It clears the cached token so the next call
issues a new one. This avoids automatically repeating order requests.

### Account APIs

`accountSeq` does not expire. Fetch it once, select the intended account, and reuse the header for
holdings and order calls. The SDK does not choose an account automatically.

```ts
const { data } = await client.getAccounts({ throwOnError: true });
const account = data.result?.[0];

if (!account) {
  throw new Error('No supported Toss Securities account found');
}

const accountHeaders = {
  'X-Tossinvest-Account': account.accountSeq,
};

const holdings = await client.getHoldings({
  headers: accountHeaders,
});
```

See the [Toss Securities account API documentation](https://developers.tossinvest.com/docs/account)
for account selection details.

## Live smoke test

Register your current public IP in Toss Securities WTS, then copy the environment template and fill
in your credentials.

```sh
cp .env.example .env
pnpm test:live
```

The smoke test only reads the Samsung Electronics price, account list, and holdings. It never
creates, modifies, or cancels an order. Do not commit `.env` or share its contents.

## Development

```sh
pnpm generate
pnpm check
pnpm test
```

- `pnpm generate` regenerates `src/generated` from the official Toss Securities OAS and formats it
  with Biome. The downloaded specification is saved as `src/generated/spec.json`.
- `pnpm check` runs Biome and TypeScript checks.
- `pnpm test` builds the package and runs the Node.js tests.
