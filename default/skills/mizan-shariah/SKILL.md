---
name: mizan-shariah
description: >
  Load before any Bursa Malaysia stock research, forecast, or trade staging on
  the Mizan desk: Shariah status checks against the SC list, what the account
  guards enforce, how to present forecasts, and how to stay on the right side
  of Malaysian investment-advice rules.
---

# Mizan: Shariah-compliant Bursa trading

## Shariah status

- The source of truth is the list of Shariah-compliant securities published by
  the Shariah Advisory Council (SAC) of the Securities Commission Malaysia. It
  is updated on the last Friday of May and November. A copy ships with this
  skill as `sc-shariah-list.json` (same folder as this file): `effectiveDate`,
  `symbols` (stock codes) and `securities` (code, name, market). Read it with
  your file tools; do not search the rest of the computer for it.
- Bursa stocks are identified by their stock code (e.g. `5347` for Tenaga
  Nasional). Market data uses the Yahoo symbol `<code>.KL`; the paper account
  uses the bare code (`alice-uta` contract search accepts `5347` or `5347.KL`).
- Do not judge compliance yourself from ratios. If a stock is not on the SC
  list, say so and stop; do not suggest workarounds.
- A stock that drops off the list may still be sold. Mention that the SAC
  expects non-compliant holdings to be disposed of and gains above cost to be
  cleansed (given to charity), and that the user should confirm with a
  Shariah adviser.

## What the account guards enforce

Every push passes these guards, even after the user approves it:

| Guard | Rejects |
|---|---|
| `shariah-sc-list` | anything that is not an ordinary share; buys of stocks not on the SC list |
| `no-short` | selling more shares than are held |
| `cash-only` | buys that exceed cash on hand, or that cannot be priced (use a limit price) |

Stage orders as limit orders with a share quantity. If a guard rejects an
order, report its message plainly; never try to route around it.

## Presenting analysis

- Describe evidence: price history, volatility, fundamentals, news, and the
  user's own stated rules. Name the date of every figure.
- Forecasts are ranges, not directions. The Mizan dashboard shows a 20-day 80%
  range from a log-normal random walk on one year of daily returns, together
  with how often that range held the real price over the past year. Quote both.
- Do not tell the user to buy, sell or hold a specific stock, and never promise
  returns. Under the SC Guidance Note on Provision of Investment Advice, a
  disclaimer does not make a recommendation acceptable. You may check whether
  a trade the user proposes fits the rules and plan they gave you.
- Never research or stage forex, gold, crypto, futures, options, warrants,
  CFDs, margin, short selling or prediction markets.
