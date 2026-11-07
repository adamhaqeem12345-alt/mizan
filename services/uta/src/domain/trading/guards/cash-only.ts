import Decimal from 'decimal.js'
import { UNSET_DECIMAL } from '@traderalice/ibkr'
import type { OperationGuard, GuardContext } from './types.js'

/**
 * Mizan: buy only with cash on hand (no margin, no borrowing).
 *
 * A BUY placeOrder is priced from its cash quantity, or quantity × limit
 * price, or quantity × the held position's market price. If the cost cannot
 * be estimated the order is rejected rather than risk using margin.
 */
export class CashOnlyGuard implements OperationGuard {
  readonly name = 'cash-only'

  check(ctx: GuardContext): string | null {
    const op = ctx.operation
    if (op.action !== 'placeOrder' || op.order.action !== 'BUY') return null

    const cost = estimateCost(ctx)
    if (!cost) {
      return `Cannot price this order; set a limit price or a cash amount so it stays within cash on hand`
    }

    const cash = new Decimal(ctx.account.totalCashValue || '0')
    if (cost.gt(cash)) {
      return `Order costs about ${cost.toFixed(2)} but only ${cash.toFixed(2)} cash is available; margin is not allowed`
    }
    return null
  }
}

function estimateCost(ctx: GuardContext): Decimal | null {
  if (ctx.operation.action !== 'placeOrder') return null
  const { order, contract } = ctx.operation

  if (!order.cashQty.equals(UNSET_DECIMAL) && order.cashQty.gt(0)) return order.cashQty

  const qty = order.totalQuantity
  if (qty.equals(UNSET_DECIMAL) || qty.lte(0)) return null

  if (!order.lmtPrice.equals(UNSET_DECIMAL) && order.lmtPrice.gt(0)) return qty.mul(order.lmtPrice)

  const held = ctx.positions.find(p => p.contract.symbol === contract.symbol)
  if (held) return qty.mul(held.marketPrice)

  return null
}
