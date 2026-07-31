# Toss Securities Open API

pnpm workspace for a TypeScript SDK and a local MCP server for the Toss Securities Open API. The
MCP server is read-only unless trading is explicitly enabled.

## Packages

- [`packages/sdk`](packages/sdk): TypeScript SDK with automatic access-token caching and refresh
- [`apps/mcp`](apps/mcp): local MCP server built on the SDK, with opt-in trading permissions

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

The live test only performs read operations, and the MCP server defaults to read-only. See the
[SDK guide](packages/sdk/README.md) and [MCP setup guide](apps/mcp/README.md) for usage details.
