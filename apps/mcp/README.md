# Toss Invest MCP

> Unofficial community project. This package is not affiliated with or endorsed by Toss Securities.

Local MCP server backed by the Toss Securities Open API SDK in this repository. It uses the
standard `stdio` transport, so any MCP-compatible host that can start a local process can use it.
The server is read-only unless trading is explicitly enabled.

Run it without cloning this repository:

```sh
TOSS_CLIENT_ID=... TOSS_CLIENT_SECRET=... npx -y @wi9ine/toss-invest-mcp
```

## Tools

- `toss_get_prices`: current prices for up to 200 symbols
- `toss_get_trades`: recent trades for one symbol
- `toss_get_price_limit`: daily price limits for one symbol
- `toss_get_orderbook`: bid and ask quotes for one symbol
- `toss_get_candles`: minute or daily OHLCV candles
- `toss_get_stocks`: basic information for up to 200 symbols
- `toss_list_stocks`: full stock universe for one market
- `toss_get_stock_warnings`: warnings and trading cautions for one symbol
- `toss_get_stock_investor_trading`: daily investor trading volumes for one Korean stock
- `toss_get_stock_program_trades`: daily program trading volumes for one Korean stock
- `toss_get_stock_short_selling`: daily short selling volumes and ratios for one Korean stock
- `toss_get_stock_credit_trades`: daily margin loan and stock loan balances for one Korean stock
- `toss_get_stock_securities_lending`: daily securities lending balances for one Korean stock
- `toss_get_exchange_rate`: KRW/USD reference exchange rate
- `toss_get_kr_market_calendar`: Korean market schedule
- `toss_get_us_market_calendar`: US market schedule
- `toss_get_rankings`: market and Toss Securities stock rankings
- `toss_get_market_indicator_prices`: market indicator prices
- `toss_get_market_indicator_candles`: market indicator candles
- `toss_get_market_indicator_investor_trading`: KOSPI/KOSDAQ investor trading amounts
- `toss_list_accounts`: supported brokerage accounts and their `accountSeq`
- `toss_get_holdings`: holdings for an account
- `toss_list_orders`: open or closed order history for an account
- `toss_get_order`: details for one order
- `toss_list_conditional_orders`: open or closed conditional orders
- `toss_get_conditional_order`: details for one conditional order
- `toss_get_buying_power`: cash-based buying power for an account and currency
- `toss_get_sellable_quantity`: sellable quantity for one holding
- `toss_get_commissions`: Korean and US trading commissions

With trading enabled, the server also exposes:

- `toss_create_order`, `toss_modify_order`, `toss_cancel_order`
- `toss_create_conditional_order`, `toss_modify_conditional_order`,
  `toss_cancel_conditional_order`

Account-specific tools require the `accountSeq` returned by `toss_list_accounts`.

## Trading permissions

The server starts in read-only mode. Add `--allow-trading` to the server arguments to register
order creation, modification, and cancellation tools:

```sh
npx -y @wi9ine/toss-invest-mcp --allow-trading
```

Orders worth at least KRW 100 million require Toss Securities' `confirmHighValueOrder` field. To
allow that field, add both permission flags:

```sh
npx -y @wi9ine/toss-invest-mcp \
  --allow-trading \
  --allow-high-value-orders
```

Append the same flags to the `args` array in any host configuration below. Trading tools are
marked as non-read-only and destructive so the host can apply its approval policy. Persistently
approving those tools allows unattended automated trading; only do this for a trusted setup.

## Codex app, CLI, and IDE extension

These Codex clients share `~/.codex/config.toml`:

```toml
[mcp_servers.toss-invest]
command = "npx"
args = ["-y", "@wi9ine/toss-invest-mcp"]
env = { TOSS_CLIENT_ID = "...", TOSS_CLIENT_SECRET = "..." }
```

Restart the client and use `/mcp` to verify the connection. See the
[Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp.md).

## Claude Desktop

Open **Settings → Developer → Edit Config**, or edit the platform configuration file directly:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "toss-invest": {
      "command": "npx",
      "args": ["-y", "@wi9ine/toss-invest-mcp"],
      "env": {
        "TOSS_CLIENT_ID": "...",
        "TOSS_CLIENT_SECRET": "..."
      }
    }
  }
}
```

Restart Claude Desktop after saving. See Anthropic's
[local MCP server guide](https://support.anthropic.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).

## Claude Code

Add the same server to the user scope:

```sh
claude mcp add-json --scope user toss-invest '{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@wi9ine/toss-invest-mcp"],
  "env": {
    "TOSS_CLIENT_ID": "...",
    "TOSS_CLIENT_SECRET": "..."
  }
}'
```

Verify it with `claude mcp get toss-invest`. See the
[Claude Code MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp).

## Cursor

Create `~/.cursor/mcp.json` for global use, or `.cursor/mcp.json` in a project:

```json
{
  "mcpServers": {
    "toss-invest": {
      "command": "npx",
      "args": ["-y", "@wi9ine/toss-invest-mcp"],
      "env": {
        "TOSS_CLIENT_ID": "...",
        "TOSS_CLIENT_SECRET": "..."
      }
    }
  }
}
```

See the [Cursor MCP documentation](https://docs.cursor.com/context/model-context-protocol).

## Visual Studio Code with GitHub Copilot

Create `.vscode/mcp.json` in a project, or run **MCP: Open User Configuration** for global use:

```json
{
  "servers": {
    "toss-invest": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@wi9ine/toss-invest-mcp"],
      "env": {
        "TOSS_CLIENT_ID": "...",
        "TOSS_CLIENT_SECRET": "..."
      }
    }
  }
}
```

See the [VS Code MCP server documentation](https://code.visualstudio.com/docs/agent-customization/mcp-servers).

## Windsurf

Open the MCP settings and select **View Raw Config**, or edit
`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "toss-invest": {
      "command": "npx",
      "args": ["-y", "@wi9ine/toss-invest-mcp"],
      "env": {
        "TOSS_CLIENT_ID": "...",
        "TOSS_CLIENT_SECRET": "..."
      }
    }
  }
}
```

Refresh the MCP list after saving. See the
[Windsurf MCP documentation](https://docs.windsurf.com/windsurf/cascade/mcp).

## Gemini CLI

Add the server to `~/.gemini/settings.json` for global use or `.gemini/settings.json` for a
project:

```json
{
  "mcpServers": {
    "toss-invest": {
      "command": "npx",
      "args": ["-y", "@wi9ine/toss-invest-mcp"],
      "env": {
        "TOSS_CLIENT_ID": "...",
        "TOSS_CLIENT_SECRET": "..."
      },
      "trust": false
    }
  }
}
```

Verify it with `gemini mcp list`. See the
[Gemini CLI MCP documentation](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md).

## Local development

Clone the repository, create `.env` from `.env.example`, and build both packages:

```sh
cp .env.example .env
pnpm mcp:build
pnpm mcp:inspect
```

The host examples above store credentials in their configuration files. Keep those files private
and do not commit project-level MCP configuration containing real credentials.

## Publishing

Publish the npm package first, then register the same version in the
[MCP Registry](https://registry.modelcontextprotocol.io) with
[`mcp-publisher`](https://github.com/modelcontextprotocol/registry). The registry publish reads
`apps/mcp/server.json` and requires a prior `mcp-publisher login github`.

```sh
pnpm --filter @wi9ine/toss-invest-mcp publish
pnpm mcp:publish
```

## Safety notes

- The MCP server is local-only and starts one authenticated Toss client per host process.
- Trading tools are absent unless `--allow-trading` is set.
- `confirmHighValueOrder: true` is rejected unless `--allow-high-value-orders` is also set.
- It does not log to stdout because stdout is reserved for MCP messages.
- Token issuance, caching, expiry refresh, and concurrent request deduplication remain handled by
  `createTossInvestClient`.
- MCP inputs reuse the SDK's generated Zod schemas; MCP-specific account mapping, trading
  permissions, and cross-field order rules are validated by the server.
- A `401` response is never retried automatically, including for order-history requests.
- Order creation, modification, and cancellation are never retried automatically.
- Local contributors must rebuild with `pnpm mcp:build` after changing either the SDK or MCP source.
