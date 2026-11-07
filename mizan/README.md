# Mizan

Mizan is a fork of [OpenAlice](https://github.com/TraderAlice/OpenAlice) for
Shariah-compliant trading on Bursa Malaysia. It keeps OpenAlice's "Trading as
Git" flow (the AI stages and commits a trade, a person approves the push) and
adds guards that enforce the rules in code.

## Rules

- Ordinary shares only. Forex, gold (XAUUSD), crypto, futures, options,
  warrants and CFDs are rejected.
- Buys must be on the Securities Commission Malaysia Shariah Advisory Council
  list. Stocks that drop off the list can still be sold.
- No short selling: never sell more shares than are held.
- Cash only: no margin.
- Paper trading on the built-in simulator. The AI explains and checks the
  user's own rules; it does not recommend what to buy or sell.

## Guards

Add these to an account under Settings → Trading → Guards:

| Guard | Options |
|---|---|
| `shariah-sc-list` | `listFile` (default `mizan/data/sc-shariah-list-2026-05-29.json`) or `symbols` |
| `no-short` | none |
| `cash-only` | none |

Source: `services/uta/src/domain/trading/guards/`. Tests:
`tests/integration/uta-simulation/mizan-guards.spec.ts`.

## Updating the SC list

The SC publishes the list on the last Friday of May and November.

```bash
pdftotext -raw "List of Shariah-compliant securities <Month Year>.pdf" list.txt
node mizan/scripts/import-sc-list.mjs list.txt <YYYY-MM-DD> > mizan/data/sc-shariah-list-<YYYY-MM-DD>.json
```

Then copy the new file to `default/skills/mizan-shariah/sc-shariah-list.json`
(the agent's copy) and point the `shariah-sc-list` guard's `listFile` at it.
The importer checks for duplicate codes; compare its `counts.stocks` with the
total in the SC's Table 3 before using a new file. The May 2026 list has 886
stocks plus 1 Islamic business trust.

## Running locally

```bash
OPENALICE_HOME=~/.openalice-mizan pnpm dev       # UI at http://localhost:47331
node mizan/scripts/sync-sim-prices.mjs           # load latest Bursa closes into the simulator
```

The simulator account lives in memory, so run the price sync after every
restart. Claude Code runs in accept-edits mode with only the OpenAlice CLIs and
read tools pre-approved; anything else asks first (upstream uses
bypass-permissions).

## Licence

AGPL-3.0, as upstream. This is a demo and research tool, not investment advice.
