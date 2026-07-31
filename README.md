# Toss Securities Open API

pnpm workspace for a TypeScript SDK and a local, read-only MCP server for the Toss Securities
Open API.

## Packages

- [`packages/sdk`](packages/sdk): TypeScript SDK with automatic access-token caching and refresh
- [`apps/mcp`](apps/mcp): local MCP server built on the SDK

## Requirements

- Node.js 22.18 or later
- pnpm

## Setup

```sh
pnpm install
cp .env.example .env
```

Set `TOSS_CLIENT_ID` and `TOSS_CLIENT_SECRET` in `.env`, then run:

```sh
pnpm check
pnpm test
pnpm test:live
```

The live test and MCP server only expose read operations. See the [SDK guide](packages/sdk/README.md)
and [MCP setup guide](apps/mcp/README.md) for usage details.
