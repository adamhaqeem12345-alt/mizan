import Decimal from 'decimal.js'
import { UNSET_DECIMAL } from '@traderalice/ibkr'
import type { OperationGuard, GuardContext } from './types.js'

/**
 * Mizan: never sell what you do not own (no short selling).
 *
 * A SELL placeOrder must have a known quantity no larger than the long
 * position held in that symbol. Cash-quantity sells are rejected because
 * the share count cannot be checked.
 */
export class NoShortGuard implements OperationGuard {
  readonly name = 'no-short'

  check(ctx: GuardContext): string | null {
    const op = ctx.operation
    if (op.action !== 'placeOrder' || op.order.action !== 'SELL') return null

    const symbol = op.contract.symbol
    const held = ctx.positions
      .filter(p => p.contract.symbol === symbol && p.side === 'long')
      .reduce((sum, p) => sum.plus(p.quantity), new Decimal(0))

    const qty = op.order.totalQuantity
    if (qty.equals(UNSET_DECIMAL) || qty.lte(0)) {
      return `Sell orders must state a share quantity so short selling can be ruled out`
    }
    if (qty.gt(held)) {
      return `Selling ${qty.toString()} ${symbol} but only ${held.toString()} held; short selling is not allowed`
    }
    return null
  }
}
