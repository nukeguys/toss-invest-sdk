import { createTossInvestClient } from '../dist/index.js';

function requiredEnv(name: 'TOSS_CLIENT_ID' | 'TOSS_CLIENT_SECRET'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required in .env`);
  }
  return value;
}

async function main(): Promise<void> {
  const client = createTossInvestClient({
    clientId: requiredEnv('TOSS_CLIENT_ID'),
    clientSecret: requiredEnv('TOSS_CLIENT_SECRET'),
  });

  const { data: prices } = await client.getPrices({
    query: { symbols: '005930' },
    throwOnError: true,
  });
  console.log('현재가');
  console.dir(prices.result, { depth: null });

  const { data: accounts } = await client.getAccounts({ throwOnError: true });
  console.log('계좌');
  console.dir(accounts.result, { depth: null });

  const account = accounts.result?.[0];
  if (!account) {
    console.log('조회 가능한 계좌가 없어 보유 종목 조회를 건너뜁니다.');
    return;
  }

  const { data: holdings } = await client.getHoldings({
    headers: { 'X-Tossinvest-Account': account.accountSeq },
    throwOnError: true,
  });
  console.log('보유 종목');
  console.dir(holdings.result, { depth: null });
}

try {
  await main();
} catch (error) {
  console.error('실제 API 테스트 실패:', error);
  process.exitCode = 1;
}
