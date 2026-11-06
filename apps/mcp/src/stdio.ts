#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createTossInvestClient } from '@nukeguys/toss-invest-sdk';

import { createTossInvestMcpServer } from './server.js';

function requiredEnv(name: 'TOSS_CLIENT_ID' | 'TOSS_CLIENT_SECRET'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const client = createTossInvestClient({
  clientId: requiredEnv('TOSS_CLIENT_ID'),
  clientSecret: requiredEnv('TOSS_CLIENT_SECRET'),
});
const server = createTossInvestMcpServer(client, {
  allowHighValueOrders: process.argv.includes('--allow-high-value-orders'),
  allowTrading: process.argv.includes('--allow-trading'),
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void server.close().finally(() => process.exit());
  });
}

await server.connect(new StdioServerTransport());
