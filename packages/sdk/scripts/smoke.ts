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

  const { data: listedStocks } = await client.listStocks({
    query: { market: 'KOSPI' },
    throwOnError: true,
  });
  console.log(`KOSPI 전체 종목: ${listedStocks.result?.length ?? 0}건, 첫 종목:`);
  console.dir(listedStocks.result?.[0], { depth: null });

  const { data: investorTrading } = await client.getStockInvestorTrading({
    path: { symbol: '005930' },
    query: { count: 2 },
    throwOnError: true,
  });
  console.log('투자자별 매매동향');
  console.dir(investorTrading.result, { depth: null });

  const { data: programTrades } = await client.getStockProgramTrades({
    path: { symbol: '005930' },
    query: { count: 2 },
    throwOnError: true,
  });
  console.log('프로그램매매 동향');
  console.dir(programTrades.result, { depth: null });

  const { data: shortSelling } = await client.getStockShortSelling({
    path: { symbol: '005930' },
    query: { count: 2 },
    throwOnError: true,
  });
  console.log('공매도 동향');
  console.dir(shortSelling.result, { depth: null });

  const { data: creditTrades } = await client.getStockCreditTrades({
    path: { symbol: '005930' },
    query: { count: 2 },
    throwOnError: true,
  });
  console.log('신용거래 동향');
  console.dir(creditTrades.result, { depth: null });

  const { data: securitiesLending } = await client.getStockSecuritiesLending({
    path: { symbol: '005930' },
    query: { count: 2 },
    throwOnError: true,
  });
  console.log('대차거래 동향');
  console.dir(securitiesLending.result, { depth: null });

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
