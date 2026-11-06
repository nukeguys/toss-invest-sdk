import { type CallToolResult, McpServer } from '@modelcontextprotocol/server';
import {
  type ConditionalOrderCreateRequest,
  type ConditionalOrderModifyRequest,
  type OrderCreateRequest,
  type OrderModifyRequest,
  type TossInvestClient,
  zConditionRequest,
  zCreateConditionalOrderBody,
  zCreateOrderBody,
  zGetBuyingPowerQuery,
  zGetCandlesQuery,
  zGetConditionalOrderPath,
  zGetConditionalOrdersQuery,
  zGetExchangeRateQuery,
  zGetHoldingsQuery,
  zGetInvestorTradingRankingsQuery,
  zGetKrMarketCalendarQuery,
  zGetMarketIndicatorCandlesPath,
  zGetMarketIndicatorCandlesQuery,
  zGetMarketIndicatorInvestorTradingPath,
  zGetMarketIndicatorInvestorTradingQuery,
  zGetOrderbookQuery,
  zGetOrderPath,
  zGetOrdersQuery,
  zGetPriceLimitQuery,
  zGetRankingsQuery,
  zGetSectorEtfsPath,
  zGetSectorEtfsQuery,
  zGetSectorPath,
  zGetSectorQuery,
  zGetSectorRankingsQuery,
  zGetSectorStocksPath,
  zGetSectorStocksQuery,
  zGetSellableQuantityQuery,
  zGetStockCreditTradesPath,
  zGetStockCreditTradesQuery,
  zGetStockInvestorTradingPath,
  zGetStockInvestorTradingQuery,
  zGetStockProgramTradesPath,
  zGetStockProgramTradesQuery,
  zGetStockSecuritiesLendingPath,
  zGetStockSecuritiesLendingQuery,
  zGetStockShortSellingPath,
  zGetStockShortSellingQuery,
  zGetStockWarningsPath,
  zGetTradesQuery,
  zGetTransactionsQuery,
  zGetUsMarketCalendarQuery,
  zListStocksQuery,
  zModifyConditionalOrderBody,
  zModifyOrderBody,
} from '@nukeguys/toss-invest-sdk';
import { z } from 'zod';

const [quantityOrderBody, amountOrderBody] = zCreateOrderBody.options;
const symbol = zGetOrderbookQuery.shape.symbol;
const symbols = z.array(symbol).min(1).max(200);
const indicatorSymbol = zGetMarketIndicatorCandlesPath.shape.symbol;
const indicatorSymbols = z.array(indicatorSymbol).min(1).max(200);
const accountSeq = z.number().int().positive();
const identifier = zGetOrderPath.shape.orderId.min(1);
const positiveDecimal = zConditionRequest.shape.triggerPrice.refine(
  (value) => Number(value) > 0,
  '0보다 큰 값이어야 합니다.',
);
const clientOrderId = quantityOrderBody.shape.clientOrderId.unwrap().min(1);
const readOnly = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  readOnlyHint: true,
} as const;
const trading = {
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
  readOnlyHint: false,
} as const;

const orderInput = z
  .object({
    accountSeq,
    clientOrderId,
    confirmHighValueOrder: quantityOrderBody.shape.confirmHighValueOrder.describe(
      '1억원 이상 주문 확인. --allow-high-value-orders 권한이 필요합니다.',
    ),
    orderAmount: amountOrderBody.shape.orderAmount
      .refine((value) => Number(value) > 0, '0보다 큰 값이어야 합니다.')
      .optional(),
    orderType: quantityOrderBody.shape.orderType,
    price: positiveDecimal.optional(),
    quantity: positiveDecimal.optional(),
    side: quantityOrderBody.shape.side,
    symbol,
    timeInForce: quantityOrderBody.shape.timeInForce,
  })
  .superRefine(({ orderAmount, orderType, price, quantity, timeInForce }, context) => {
    if ((quantity === undefined) === (orderAmount === undefined)) {
      context.addIssue({
        code: 'custom',
        message: 'quantity와 orderAmount 중 정확히 하나를 입력해야 합니다.',
        path: ['quantity'],
      });
    }
    if (orderType === 'LIMIT' && price === undefined) {
      context.addIssue({
        code: 'custom',
        message: '지정가 주문에는 price가 필요합니다.',
        path: ['price'],
      });
    }
    if (orderType === 'MARKET' && price !== undefined) {
      context.addIssue({
        code: 'custom',
        message: '시장가 주문에는 price를 입력할 수 없습니다.',
        path: ['price'],
      });
    }
    if (orderAmount !== undefined && (orderType !== 'MARKET' || timeInForce !== undefined)) {
      context.addIssue({
        code: 'custom',
        message: '금액 주문은 MARKET 주문이며 timeInForce를 사용할 수 없습니다.',
        path: ['orderAmount'],
      });
    }
  });

const modifyOrderInput = z
  .object({
    accountSeq,
    confirmHighValueOrder: zModifyOrderBody.shape.confirmHighValueOrder.describe(
      '1억원 이상 주문 확인. --allow-high-value-orders 권한이 필요합니다.',
    ),
    orderId: identifier,
    orderType: zModifyOrderBody.shape.orderType,
    price: positiveDecimal.optional(),
    quantity: zModifyOrderBody.shape.quantity
      .unwrap()
      .refine((value) => Number(value) > 0, '0보다 큰 값이어야 합니다.')
      .optional(),
  })
  .superRefine(({ orderType, price }, context) => {
    if (orderType === 'LIMIT' && price === undefined) {
      context.addIssue({
        code: 'custom',
        message: '지정가 정정에는 price가 필요합니다.',
        path: ['price'],
      });
    }
    if (orderType === 'MARKET' && price !== undefined) {
      context.addIssue({
        code: 'custom',
        message: '시장가 정정에는 price를 입력할 수 없습니다.',
        path: ['price'],
      });
    }
  });

const condition = zConditionRequest.extend({
  orderPrice: positiveDecimal.optional(),
  triggerPrice: positiveDecimal,
});

function validateConditionalOrder(
  value: {
    first: z.infer<typeof condition>;
    orderType: 'LIMIT' | 'MARKET';
    second?: z.infer<typeof condition>;
    type: 'SINGLE' | 'OCO' | 'OTO';
  },
  context: z.core.$RefinementCtx,
): void {
  if ((value.type === 'SINGLE') === (value.second !== undefined)) {
    context.addIssue({
      code: 'custom',
      message: 'SINGLE은 second를 생략하고 OCO/OTO는 second를 입력해야 합니다.',
      path: ['second'],
    });
  }
  if (value.orderType === 'MARKET' && value.type !== 'SINGLE') {
    context.addIssue({
      code: 'custom',
      message: 'OCO/OTO 조건주문은 LIMIT만 지원합니다.',
      path: ['orderType'],
    });
  }
  for (const [name, leg] of [
    ['first', value.first],
    ['second', value.second],
  ] as const) {
    if (value.orderType === 'LIMIT' && leg?.orderPrice === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'LIMIT 조건에는 orderPrice가 필요합니다.',
        path: [name, 'orderPrice'],
      });
    }
    if (value.orderType === 'MARKET' && leg?.orderPrice !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'MARKET 조건에는 orderPrice를 입력할 수 없습니다.',
        path: [name, 'orderPrice'],
      });
    }
  }
}

const createConditionalOrderInput = z
  .object({
    accountSeq,
    ...zCreateConditionalOrderBody.shape,
    clientOrderId,
    confirmHighValueOrder: zCreateConditionalOrderBody.shape.confirmHighValueOrder.describe(
      '1억원 이상 주문 확인. --allow-high-value-orders 권한이 필요합니다.',
    ),
    first: condition,
    quantity: positiveDecimal,
    second: condition.optional(),
  })
  .superRefine(validateConditionalOrder);
const modifyConditionalOrderInput = z
  .object({
    accountSeq,
    ...zModifyConditionalOrderBody.shape,
    conditionalOrderId: zGetConditionalOrderPath.shape.conditionalOrderId.min(1),
    confirmHighValueOrder: zModifyConditionalOrderBody.shape.confirmHighValueOrder.describe(
      '1억원 이상 주문 확인. --allow-high-value-orders 권한이 필요합니다.',
    ),
    first: condition,
    quantity: positiveDecimal,
    second: condition.optional(),
  })
  .superRefine(validateConditionalOrder);

export interface TossInvestMcpServerOptions {
  allowHighValueOrders?: boolean;
  allowTrading?: boolean;
}

function result(value: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(value ?? null, null, 2) }],
  };
}

async function call<T>(request: () => Promise<{ data: T }>): Promise<CallToolResult> {
  try {
    const { data } = await request();
    return result(data && typeof data === 'object' && 'result' in data ? data.result : data);
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

function assertHighValuePermission(allowed: boolean, requested?: boolean): void {
  if (requested && !allowed) {
    throw new Error('고액 주문은 --allow-high-value-orders 옵션으로 서버를 시작해야 합니다.');
  }
}

export function createTossInvestMcpServer(
  client: TossInvestClient,
  { allowHighValueOrders = false, allowTrading = false }: TossInvestMcpServerOptions = {},
): McpServer {
  if (allowHighValueOrders && !allowTrading) {
    throw new TypeError('allowHighValueOrders requires allowTrading');
  }

  const server = new McpServer(
    { name: 'toss-invest', version: '0.4.1' },
    {
      instructions: allowTrading
        ? '토스증권 조회 및 주문 서버입니다. 계좌 API를 호출하기 전에 toss_list_accounts로 accountSeq를 확인하고, 주문 도구는 사용자의 승인을 받은 경우에만 호출하세요.'
        : '토스증권 조회 전용 서버입니다. 계좌 API를 호출하기 전에 toss_list_accounts로 accountSeq를 확인하세요.',
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
    'toss_get_trades',
    {
      annotations: readOnly,
      description: '한 종목의 최근 체결 내역을 최대 50건까지 조회합니다.',
      inputSchema: zGetTradesQuery,
      title: '최근 체결 조회',
    },
    ({ count, symbol }) =>
      call(() => client.getTrades({ query: { count, symbol }, throwOnError: true })),
  );

  server.registerTool(
    'toss_get_price_limit',
    {
      annotations: readOnly,
      description: '한 종목의 당일 가격 제한 정보를 조회합니다.',
      inputSchema: zGetPriceLimitQuery,
      title: '가격 제한 조회',
    },
    ({ symbol }) => call(() => client.getPriceLimit({ query: { symbol }, throwOnError: true })),
  );

  server.registerTool(
    'toss_get_orderbook',
    {
      annotations: readOnly,
      description: '한 종목의 매수·매도 호가와 잔량을 조회합니다.',
      inputSchema: zGetOrderbookQuery,
      title: '종목 호가 조회',
    },
    ({ symbol }) => call(() => client.getOrderbook({ query: { symbol }, throwOnError: true })),
  );

  server.registerTool(
    'toss_get_candles',
    {
      annotations: readOnly,
      description:
        '한 종목의 분봉 또는 일봉 OHLCV 데이터를 최대 200개까지 조회합니다. 캔들은 최신순(timestamp 내림차순)으로 정렬되며, 1분봉의 timestamp는 봉 종료 시각, 일봉은 해당 거래일 자정입니다.',
      inputSchema: zGetCandlesQuery,
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
    'toss_list_stocks',
    {
      annotations: readOnly,
      description:
        '마켓(거래소)별 전체 종목 목록을 조회합니다. 유니버스 구성 용도이며 마켓당 최대 수천 건을 한 번에 반환하므로, 개별 종목 정보는 toss_get_stocks를 사용하세요.',
      inputSchema: zListStocksQuery,
      title: '마켓 전체 종목 조회',
    },
    ({ commonShare, market, securityType, status }) =>
      call(() =>
        client.listStocks({
          query: { commonShare, market, securityType, status },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_get_stock_warnings',
    {
      annotations: readOnly,
      description: '한 종목의 투자경고, 거래정지 등 투자 유의사항을 조회합니다.',
      inputSchema: zGetStockWarningsPath,
      title: '종목 유의사항 조회',
    },
    ({ symbol }) => call(() => client.getStockWarnings({ path: { symbol }, throwOnError: true })),
  );

  server.registerTool(
    'toss_get_stock_investor_trading',
    {
      annotations: readOnly,
      description:
        '국내 종목의 개인·외국인·기관·기타법인 투자자별 매매 거래량을 일별 시계열로 조회합니다.',
      inputSchema: z.object({
        ...zGetStockInvestorTradingPath.shape,
        ...zGetStockInvestorTradingQuery.shape,
      }),
      title: '투자자별 매매동향 조회',
    },
    ({ count, symbol, until }) =>
      call(() =>
        client.getStockInvestorTrading({
          path: { symbol },
          query: { count, until },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_get_stock_program_trades',
    {
      annotations: readOnly,
      description: '국내 종목의 차익·비차익 프로그램매매 거래량을 일별 시계열로 조회합니다.',
      inputSchema: z.object({
        ...zGetStockProgramTradesPath.shape,
        ...zGetStockProgramTradesQuery.shape,
      }),
      title: '프로그램매매 동향 조회',
    },
    ({ count, symbol, until }) =>
      call(() =>
        client.getStockProgramTrades({
          path: { symbol },
          query: { count, until },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_get_stock_short_selling',
    {
      annotations: readOnly,
      description:
        '국내 종목의 공매도 거래량·거래대금과 전체 거래 대비 비중을 일별 시계열로 조회합니다.',
      inputSchema: z.object({
        ...zGetStockShortSellingPath.shape,
        ...zGetStockShortSellingQuery.shape,
      }),
      title: '공매도 동향 조회',
    },
    ({ count, symbol, until }) =>
      call(() =>
        client.getStockShortSelling({
          path: { symbol },
          query: { count, until },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_get_stock_credit_trades',
    {
      annotations: readOnly,
      description: '국내 종목의 신용융자·신용대주 신규·상환·잔고 수량을 일별 시계열로 조회합니다.',
      inputSchema: z.object({
        ...zGetStockCreditTradesPath.shape,
        ...zGetStockCreditTradesQuery.shape,
      }),
      title: '신용거래 동향 조회',
    },
    ({ count, symbol, until }) =>
      call(() =>
        client.getStockCreditTrades({
          path: { symbol },
          query: { count, until },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_get_stock_securities_lending',
    {
      annotations: readOnly,
      description:
        '국내 종목의 대차거래 체결·상환·잔고 수량과 잔고 금액을 일별 시계열로 조회합니다.',
      inputSchema: z.object({
        ...zGetStockSecuritiesLendingPath.shape,
        ...zGetStockSecuritiesLendingQuery.shape,
      }),
      title: '대차거래 동향 조회',
    },
    ({ count, symbol, until }) =>
      call(() =>
        client.getStockSecuritiesLending({
          path: { symbol },
          query: { count, until },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_get_exchange_rate',
    {
      annotations: readOnly,
      description: '원화와 달러 사이의 참고 환율을 조회합니다.',
      inputSchema: zGetExchangeRateQuery,
      title: '환율 조회',
    },
    ({ baseCurrency, dateTime, quoteCurrency }) =>
      call(() =>
        client.getExchangeRate({
          query: { baseCurrency, dateTime, quoteCurrency },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_get_kr_market_calendar',
    {
      annotations: readOnly,
      description: '기준일의 국내 시장 운영 시간과 거래 가능 여부를 조회합니다.',
      inputSchema: zGetKrMarketCalendarQuery,
      title: '국내 장 운영 정보 조회',
    },
    ({ date }) => call(() => client.getKrMarketCalendar({ query: { date }, throwOnError: true })),
  );

  server.registerTool(
    'toss_get_us_market_calendar',
    {
      annotations: readOnly,
      description: '기준일의 미국 시장 운영 시간과 거래 가능 여부를 조회합니다.',
      inputSchema: zGetUsMarketCalendarQuery,
      title: '미국 장 운영 정보 조회',
    },
    ({ date }) => call(() => client.getUsMarketCalendar({ query: { date }, throwOnError: true })),
  );

  server.registerTool(
    'toss_get_rankings',
    {
      annotations: readOnly,
      description: '시장 또는 토스증권 기준 거래대금, 거래량, 등락률 순위를 조회합니다.',
      inputSchema: zGetRankingsQuery,
      title: '주식 랭킹 조회',
    },
    ({ count, duration, excludeInvestmentCaution, marketCountry, type }) =>
      call(() =>
        client.getRankings({
          query: { count, duration, excludeInvestmentCaution, marketCountry, type },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_get_investor_trading_rankings',
    {
      annotations: readOnly,
      description: '국내 종목의 투자자별 순매수·순매도 랭킹을 조회합니다.',
      inputSchema: zGetInvestorTradingRankingsQuery,
      title: '투자자별 매매 랭킹 조회',
    },
    (query) => call(() => client.getInvestorTradingRankings({ query, throwOnError: true })),
  );

  server.registerTool(
    'toss_list_sectors',
    {
      annotations: readOnly,
      description: '섹터 목록과 계층을 조회합니다.',
      inputSchema: z.object({}),
      title: '섹터 목록 조회',
    },
    () => call(() => client.listSectors({ throwOnError: true })),
  );

  server.registerTool(
    'toss_get_sector_rankings',
    {
      annotations: readOnly,
      description: '시장과 기간별 섹터 랭킹을 조회합니다.',
      inputSchema: zGetSectorRankingsQuery,
      title: '섹터 랭킹 조회',
    },
    (query) => call(() => client.getSectorRankings({ query, throwOnError: true })),
  );

  server.registerTool(
    'toss_get_sector',
    {
      annotations: readOnly,
      description:
        '섹터 정보와 기간별 등락률을 조회합니다. 섹터 ID는 toss_list_sectors에서 확인하세요.',
      inputSchema: z.object({ ...zGetSectorPath.shape, ...zGetSectorQuery.shape }),
      title: '섹터 상세 조회',
    },
    ({ sectorId, marketCountry }) =>
      call(() =>
        client.getSector({ path: { sectorId }, query: { marketCountry }, throwOnError: true }),
      ),
  );

  server.registerTool(
    'toss_get_sector_stocks',
    {
      annotations: readOnly,
      description:
        '하위 섹터를 포함한 구성 주식을 조회합니다. 섹터 ID는 toss_list_sectors에서 확인하세요.',
      inputSchema: z.object({ ...zGetSectorStocksPath.shape, ...zGetSectorStocksQuery.shape }),
      title: '섹터 구성 주식 조회',
    },
    ({ sectorId, marketCountry }) =>
      call(() =>
        client.getSectorStocks({
          path: { sectorId },
          query: { marketCountry },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_get_sector_etfs',
    {
      annotations: readOnly,
      description: '해당 섹터의 관련 ETF을 조회합니다. 섹터 ID는 toss_list_sectors에서 확인하세요.',
      inputSchema: z.object({ ...zGetSectorEtfsPath.shape, ...zGetSectorEtfsQuery.shape }),
      title: '섹터 관련 ETF 조회',
    },
    ({ sectorId, marketCountry }) =>
      call(() =>
        client.getSectorEtfs({ path: { sectorId }, query: { marketCountry }, throwOnError: true }),
      ),
  );

  server.registerTool(
    'toss_get_market_indicator_prices',
    {
      annotations: readOnly,
      description: '국내 지수와 국채 등 시장 지표의 현재가를 최대 200개까지 조회합니다.',
      inputSchema: z.object({ symbols: indicatorSymbols }),
      title: '시장 지표 현재가 조회',
    },
    ({ symbols }) =>
      call(() =>
        client.getMarketIndicatorPrices({
          query: { symbols: symbols.join(',') },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_get_market_indicator_candles',
    {
      annotations: readOnly,
      description:
        '한 시장 지표의 분봉 또는 일봉 데이터를 최대 200개까지 조회합니다. 캔들은 최신순(timestamp 내림차순)으로 정렬되며, 1분봉의 timestamp는 봉 종료 시각, 일봉은 해당 거래일 자정입니다.',
      inputSchema: z.object({
        ...zGetMarketIndicatorCandlesPath.shape,
        ...zGetMarketIndicatorCandlesQuery.shape,
      }),
      title: '시장 지표 캔들 조회',
    },
    ({ before, count, interval, symbol }) =>
      call(() =>
        client.getMarketIndicatorCandles({
          path: { symbol },
          query: { before, count, interval },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_get_market_indicator_investor_trading',
    {
      annotations: readOnly,
      description: '코스피 또는 코스닥의 투자자별 매매대금을 조회합니다.',
      inputSchema: z.object({
        ...zGetMarketIndicatorInvestorTradingPath.shape,
        ...zGetMarketIndicatorInvestorTradingQuery.shape,
      }),
      title: '투자자별 매매대금 조회',
    },
    ({ count, interval, symbol, until }) =>
      call(() =>
        client.getMarketIndicatorInvestorTrading({
          path: { symbol },
          query: { count, interval, until },
          throwOnError: true,
        }),
      ),
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
        ...zGetHoldingsQuery.shape,
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
    'toss_get_transactions',
    {
      annotations: readOnly,
      description:
        '계좌의 매매·입출금·환전·배당 등 거래내역을 조회합니다. 다음 페이지는 hasNext와 nextCursor로 확인하세요.',
      inputSchema: z.object({
        accountSeq: accountSeq.describe('toss_list_accounts가 반환한 accountSeq'),
        ...zGetTransactionsQuery.shape,
      }),
      title: '계좌 거래내역 조회',
    },
    ({ accountSeq, ...query }) =>
      call(() =>
        client.getTransactions({
          headers: { 'X-Tossinvest-Account': accountSeq },
          query,
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
        ...zGetOrdersQuery.shape,
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
    'toss_get_order',
    {
      annotations: readOnly,
      description: '선택한 계좌의 주문 한 건을 상세 조회합니다.',
      inputSchema: z.object({ accountSeq, ...zGetOrderPath.shape }),
      title: '주문 상세 조회',
    },
    ({ accountSeq, orderId }) =>
      call(() =>
        client.getOrder({
          headers: { 'X-Tossinvest-Account': accountSeq },
          path: { orderId },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_list_conditional_orders',
    {
      annotations: readOnly,
      description: '선택한 계좌의 진행 중이거나 종료된 조건주문 목록을 조회합니다.',
      inputSchema: z.object({
        accountSeq,
        ...zGetConditionalOrdersQuery.shape,
      }),
      title: '조건주문 목록 조회',
    },
    ({ accountSeq, cursor, limit, status, symbol }) =>
      call(() =>
        client.getConditionalOrders({
          headers: { 'X-Tossinvest-Account': accountSeq },
          query: { cursor, limit, status, symbol },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_get_conditional_order',
    {
      annotations: readOnly,
      description: '선택한 계좌의 조건주문 한 건을 상세 조회합니다.',
      inputSchema: z.object({ accountSeq, ...zGetConditionalOrderPath.shape }),
      title: '조건주문 상세 조회',
    },
    ({ accountSeq, conditionalOrderId }) =>
      call(() =>
        client.getConditionalOrder({
          headers: { 'X-Tossinvest-Account': accountSeq },
          path: { conditionalOrderId },
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
        ...zGetBuyingPowerQuery.shape,
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

  server.registerTool(
    'toss_get_sellable_quantity',
    {
      annotations: readOnly,
      description: '선택한 계좌에서 특정 종목을 매도할 수 있는 수량을 조회합니다.',
      inputSchema: z.object({ accountSeq, ...zGetSellableQuantityQuery.shape }),
      title: '매도 가능 수량 조회',
    },
    ({ accountSeq, symbol }) =>
      call(() =>
        client.getSellableQuantity({
          headers: { 'X-Tossinvest-Account': accountSeq },
          query: { symbol },
          throwOnError: true,
        }),
      ),
  );

  server.registerTool(
    'toss_get_commissions',
    {
      annotations: readOnly,
      description: '선택한 계좌의 국내·미국 주식 매매 수수료를 조회합니다.',
      inputSchema: z.object({ accountSeq }),
      title: '매매 수수료 조회',
    },
    ({ accountSeq }) =>
      call(() =>
        client.getCommissions({
          headers: { 'X-Tossinvest-Account': accountSeq },
          throwOnError: true,
        }),
      ),
  );

  if (allowTrading) {
    server.registerTool(
      'toss_create_order',
      {
        annotations: trading,
        description:
          '선택한 계좌에 매수 또는 매도 주문을 생성합니다. 호출 전에 주문 내용을 사용자에게 확인받아야 합니다.',
        inputSchema: orderInput,
        title: '주문 생성',
      },
      ({
        accountSeq,
        clientOrderId,
        confirmHighValueOrder,
        orderAmount,
        orderType,
        price,
        quantity,
        side,
        symbol,
        timeInForce,
      }) =>
        call(() => {
          assertHighValuePermission(allowHighValueOrders, confirmHighValueOrder);
          const body: OrderCreateRequest =
            orderAmount === undefined
              ? {
                  clientOrderId,
                  confirmHighValueOrder,
                  orderType,
                  price,
                  quantity: quantity as string,
                  side,
                  symbol,
                  timeInForce,
                }
              : {
                  clientOrderId,
                  confirmHighValueOrder,
                  orderAmount,
                  orderType: 'MARKET',
                  side,
                  symbol,
                };
          return client.createOrder({
            body,
            headers: { 'X-Tossinvest-Account': accountSeq },
            throwOnError: true,
          });
        }),
    );

    server.registerTool(
      'toss_modify_order',
      {
        annotations: trading,
        description:
          '선택한 계좌의 기존 주문 가격 또는 수량을 정정합니다. 호출 전에 변경 내용을 사용자에게 확인받아야 합니다.',
        inputSchema: modifyOrderInput,
        title: '주문 정정',
      },
      ({ accountSeq, confirmHighValueOrder, orderId, orderType, price, quantity }) =>
        call(() => {
          assertHighValuePermission(allowHighValueOrders, confirmHighValueOrder);
          const body: OrderModifyRequest = {
            confirmHighValueOrder,
            orderType,
            price,
            quantity,
          };
          return client.modifyOrder({
            body,
            headers: { 'X-Tossinvest-Account': accountSeq },
            path: { orderId },
            throwOnError: true,
          });
        }),
    );

    server.registerTool(
      'toss_cancel_order',
      {
        annotations: trading,
        description:
          '선택한 계좌의 미체결 주문을 취소합니다. 호출 전에 취소 대상을 사용자에게 확인받아야 합니다.',
        inputSchema: z.object({ accountSeq, orderId: identifier }),
        title: '주문 취소',
      },
      ({ accountSeq, orderId }) =>
        call(() =>
          client.cancelOrder({
            headers: { 'X-Tossinvest-Account': accountSeq },
            path: { orderId },
            throwOnError: true,
          }),
        ),
    );

    server.registerTool(
      'toss_create_conditional_order',
      {
        annotations: trading,
        description:
          '가격 조건 충족 시 주문을 실행하는 SINGLE, OCO 또는 OTO 조건주문을 등록합니다.',
        inputSchema: createConditionalOrderInput,
        title: '조건주문 생성',
      },
      ({
        accountSeq,
        clientOrderId,
        confirmHighValueOrder,
        expireDate,
        first,
        orderType,
        quantity,
        second,
        symbol,
        type,
      }) =>
        call(() => {
          assertHighValuePermission(allowHighValueOrders, confirmHighValueOrder);
          const body: ConditionalOrderCreateRequest = {
            clientOrderId,
            confirmHighValueOrder,
            expireDate,
            first,
            orderType,
            quantity,
            second,
            symbol,
            type,
          };
          return client.createConditionalOrder({
            body,
            headers: { 'X-Tossinvest-Account': accountSeq },
            throwOnError: true,
          });
        }),
    );

    server.registerTool(
      'toss_modify_conditional_order',
      {
        annotations: trading,
        description:
          '기존 조건주문을 취소하고 변경된 조건으로 다시 생성합니다. 응답의 새 ID를 사용해야 합니다.',
        inputSchema: modifyConditionalOrderInput,
        title: '조건주문 수정',
      },
      ({
        accountSeq,
        conditionalOrderId,
        confirmHighValueOrder,
        expireDate,
        first,
        orderType,
        quantity,
        second,
        type,
      }) =>
        call(() => {
          assertHighValuePermission(allowHighValueOrders, confirmHighValueOrder);
          const body: ConditionalOrderModifyRequest = {
            confirmHighValueOrder,
            expireDate,
            first,
            orderType,
            quantity,
            second,
            type,
          };
          return client.modifyConditionalOrder({
            body,
            headers: { 'X-Tossinvest-Account': accountSeq },
            path: { conditionalOrderId },
            throwOnError: true,
          });
        }),
    );

    server.registerTool(
      'toss_cancel_conditional_order',
      {
        annotations: trading,
        description: '선택한 계좌의 진행 중인 조건주문을 취소합니다.',
        inputSchema: z.object({ accountSeq, conditionalOrderId: identifier }),
        title: '조건주문 취소',
      },
      ({ accountSeq, conditionalOrderId }) =>
        call(() =>
          client.cancelConditionalOrder({
            headers: { 'X-Tossinvest-Account': accountSeq },
            path: { conditionalOrderId },
            throwOnError: true,
          }),
        ),
    );
  }

  return server;
}
