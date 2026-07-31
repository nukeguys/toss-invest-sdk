import { type CallToolResult, McpServer } from '@modelcontextprotocol/server';
import type { TossInvestClient } from 'toss-sdk';
import { z } from 'zod';

const symbol = z
  .string()
  .regex(/^[A-Za-z0-9.-]+$/, '영문, 숫자, 마침표, 하이픈만 사용할 수 있습니다.');
const symbols = z.array(symbol).min(1).max(200);
const accountSeq = z.number().int().positive();
const readOnly = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  readOnlyHint: true,
} as const;

function result(value: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(value ?? null, null, 2) }],
  };
}

async function call(
  request: () => Promise<{ data: { result?: unknown } }>,
): Promise<CallToolResult> {
  try {
    const { data } = await request();
    return result(data.result);
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: error instanceof Error ? error.message : JSON.stringify(error) || 'Unknown error',
        },
      ],
      isError: true,
    };
  }
}

export function createTossInvestMcpServer(client: TossInvestClient): McpServer {
  const server = new McpServer(
    { name: 'toss-invest', version: '0.1.0' },
    {
      instructions:
        '토스증권 조회 전용 서버입니다. 계좌 API를 호출하기 전에 toss_list_accounts로 accountSeq를 확인하세요. 주문 생성, 정정, 취소 기능은 제공하지 않습니다.',
    },
  );

  server.registerTool(
    'toss_get_prices',
    {
      annotations: readOnly,
      description: '국내 또는 미국 종목의 현재가를 최대 200개까지 조회합니다.',
      inputSchema: z.object({
        symbols: symbols.describe('종목 심볼 목록. 예: ["005930", "AAPL"]'),
      }),
      title: '종목 현재가 조회',
    },
    ({ symbols }) =>
      call(() => client.getPrices({ query: { symbols: symbols.join(',') }, throwOnError: true })),
  );

  server.registerTool(
    'toss_get_orderbook',
    {
      annotations: readOnly,
      description: '한 종목의 매수·매도 호가와 잔량을 조회합니다.',
      inputSchema: z.object({ symbol: symbol.describe('종목 심볼. 예: 005930 또는 AAPL') }),
      title: '종목 호가 조회',
    },
    ({ symbol }) => call(() => client.getOrderbook({ query: { symbol }, throwOnError: true })),
  );

  server.registerTool(
    'toss_get_candles',
    {
      annotations: readOnly,
      description: '한 종목의 분봉 또는 일봉 OHLCV 데이터를 최대 200개까지 조회합니다.',
      inputSchema: z.object({
        adjusted: z.boolean().optional().describe('수정주가 적용 여부. 기본값은 true입니다.'),
        before: z.iso.datetime({ offset: true }).optional().describe('조회 상한 시각(ISO 8601)'),
        count: z.number().int().min(1).max(200).optional().describe('조회할 봉 수'),
        interval: z.enum(['1m', '1d']).describe('1분봉 또는 일봉'),
        symbol: symbol.describe('종목 심볼. 예: 005930 또는 AAPL'),
      }),
      title: '종목 캔들 조회',
    },
    ({ adjusted, before, count, interval, symbol }) =>
      call(() =>
        client.getCandles({
          query: { adjusted, before, count, interval, symbol },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_get_stocks',
    {
      annotations: readOnly,
      description: '국내 또는 미국 종목의 이름, 시장, 통화, 거래 상태 등 기본 정보를 조회합니다.',
      inputSchema: z.object({
        symbols: symbols.describe('종목 심볼 목록. 예: ["005930", "AAPL"]'),
      }),
      title: '종목 기본 정보 조회',
    },
    ({ symbols }) =>
      call(() => client.getStocks({ query: { symbols: symbols.join(',') }, throwOnError: true })),
  );

  server.registerTool(
    'toss_list_accounts',
    {
      annotations: readOnly,
      description: '사용 가능한 토스증권 종합매매 계좌와 accountSeq를 조회합니다.',
      inputSchema: z.object({}),
      title: '계좌 목록 조회',
    },
    () => call(() => client.getAccounts({ throwOnError: true })),
  );

  server.registerTool(
    'toss_get_holdings',
    {
      annotations: readOnly,
      description: '선택한 계좌의 국내·미국 보유 주식과 평가 정보를 조회합니다.',
      inputSchema: z.object({
        accountSeq: accountSeq.describe('toss_list_accounts가 반환한 accountSeq'),
        symbol: symbol.optional().describe('특정 종목만 조회할 때 지정합니다.'),
      }),
      title: '보유 주식 조회',
    },
    ({ accountSeq, symbol }) =>
      call(() =>
        client.getHoldings({
          headers: { 'X-Tossinvest-Account': accountSeq },
          query: { symbol },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_list_orders',
    {
      annotations: readOnly,
      description: '선택한 계좌의 진행 중이거나 종료된 주문 내역을 조회합니다.',
      inputSchema: z.object({
        accountSeq: accountSeq.describe('toss_list_accounts가 반환한 accountSeq'),
        cursor: z.string().optional().describe('종료 주문 다음 페이지 커서'),
        from: z.iso.date().optional().describe('조회 시작일(YYYY-MM-DD, KST)'),
        limit: z.number().int().min(1).max(100).optional(),
        status: z.enum(['OPEN', 'CLOSED']),
        symbol: symbol.optional(),
        to: z.iso.date().optional().describe('조회 종료일(YYYY-MM-DD, KST)'),
      }),
      title: '주문 내역 조회',
    },
    ({ accountSeq, cursor, from, limit, status, symbol, to }) =>
      call(() =>
        client.getOrders({
          headers: { 'X-Tossinvest-Account': accountSeq },
          query: { cursor, from, limit, status, symbol, to },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_get_buying_power',
    {
      annotations: readOnly,
      description: '선택한 계좌에서 원화 또는 달러로 주문 가능한 현금 기반 금액을 조회합니다.',
      inputSchema: z.object({
        accountSeq: accountSeq.describe('toss_list_accounts가 반환한 accountSeq'),
        currency: z.enum(['KRW', 'USD']),
      }),
      title: '매수 가능 금액 조회',
    },
    ({ accountSeq, currency }) =>
      call(() =>
        client.getBuyingPower({
          headers: { 'X-Tossinvest-Account': accountSeq },
          query: { currency },
          throwOnError: true,
        }),
      ),
  );

  return server;
}
