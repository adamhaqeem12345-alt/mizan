import { useEffect, useState } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { Button } from '../../components/ui/button'
import type { MizanQuote } from '../../pages/MizanHomePage'
import { findShariah } from '../scList'
import { useBars } from '../useBars'
import {
  BOARD_LOT,
  journalCsv,
  money,
  newAccount,
  parseAccount,
  placeOrder,
  type JournalEntry,
  type PaperAccount,
  type PaperOrder,
  type Side,
} from '../paper'

const ACCOUNT_KEY = 'mizan.paper.v1'
const isShariah = (code: string) => findShariah(code) != null

function loadAccount(): PaperAccount {
  try { return parseAccount(localStorage.getItem(ACCOUNT_KEY)) ?? newAccount() } catch { return newAccount() }
}

function saveAccount(account: PaperAccount) {
  try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account)) } catch { /* private mode: the account lasts for this visit */ }
}

/** Paper account kept in this browser: order ticket, holdings and trade journal. */
export function PaperDesk({ quote }: { quote: MizanQuote }) {
  const [account, setAccount] = useState<PaperAccount>(loadAccount)
  const [side, setSide] = useState<Side>('BUY')
  const [qty, setQty] = useState(String(BOARD_LOT))
  const [note, setNote] = useState('')
  const [last, setLast] = useState<JournalEntry | null>(null)

  useEffect(() => { setLast(null) }, [quote.code])

  const submit = (order: PaperOrder) => {
    const result = placeOrder(account, order, isShariah)
    setAccount(result.account)
    saveAccount(result.account)
    setLast(result.entry)
    if (result.entry.status === 'filled') setNote('')
  }

  const ticketOrder = (): PaperOrder => ({
    side, code: quote.code, name: quote.name, qty: Number(qty.replace(/,/g, '')), price: quote.close, priceDate: quote.date, note,
  })
  const held = account.positions[quote.code]?.qty ?? 0
  const estimate = Number(qty.replace(/,/g, '')) * quote.close

  return (
    <section aria-labelledby="paper-desk" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="paper-desk" className="text-[15px] font-semibold text-foreground">Paper trading desk</h2>
        <p className="text-[12px] text-muted-foreground">Practice money, kept in this browser only. Orders fill at the last close.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => { e.preventDefault(); submit(ticketOrder()) }}
        >
          <div className="flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Order side">
            {(['BUY', 'SELL'] as const).map(s => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={side === s}
                onClick={() => setSide(s)}
                className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium ${side === s ? (s === 'BUY' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive') : 'text-muted-foreground hover:bg-secondary'}`}
              >
                {s === 'BUY' ? 'Buy' : 'Sell'}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
            Shares (board lots of {BOARD_LOT})
            <input
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 font-mono text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
            Why this trade? (your own rule, saved in the journal)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="e.g. no more than 10% in one stock"
              className="h-9 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
            <dt className="text-muted-foreground">Price</dt>
            <dd className="text-right font-mono text-foreground">RM {quote.close.toFixed(3)} <span className="text-muted-foreground">({quote.date})</span></dd>
            <dt className="text-muted-foreground">Order value</dt>
            <dd className="text-right font-mono text-foreground">{Number.isFinite(estimate) ? money(estimate) : '—'}</dd>
            <dt className="text-muted-foreground">Cash</dt>
            <dd className="text-right font-mono text-foreground">{money(account.cash)}</dd>
            <dt className="text-muted-foreground">You hold</dt>
            <dd className="text-right font-mono text-foreground">{held.toLocaleString('en-MY')} shares</dd>
          </dl>
          <Button type="submit">{side === 'BUY' ? 'Buy' : 'Sell'} {quote.name.replace(/ (Bhd|Berhad)$/, '')}</Button>
          {last && <OrderResult entry={last} />}

          <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
            <p className="text-[12px] text-muted-foreground">Test the rules. Each of these should be refused:</p>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => submit({ side: 'BUY', code: '1155', name: 'MALAYAN BANKING BERHAD', qty: BOARD_LOT, price: 0, priceDate: quote.date, note: 'rule test' })}>
                Buy Maybank (not on the SC list)
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => submit({ side: 'SELL', code: quote.code, name: quote.name, qty: held + BOARD_LOT, price: quote.close, priceDate: quote.date, note: 'rule test' })}>
                Sell shares you don&apos;t own
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => submit({ side: 'BUY', code: quote.code, name: quote.name, qty: Math.ceil((account.cash * 2) / quote.close / BOARD_LOT) * BOARD_LOT, price: quote.close, priceDate: quote.date, note: 'rule test' })}>
                Buy with borrowed money
              </Button>
            </div>
          </div>
        </form>

        <div className="flex min-w-0 flex-col gap-4">
          <Holdings account={account} />
          <Journal
            account={account}
            onReset={() => {
              if (!window.confirm('Reset the paper account to RM 100,000 and clear the journal?')) return
              const fresh = newAccount()
              setAccount(fresh)
              saveAccount(fresh)
              setLast(null)
            }}
          />
        </div>
      </div>
    </section>
  )
}

function OrderResult({ entry }: { entry: JournalEntry }) {
  if (entry.status === 'filled') {
    return (
      <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-[12px] text-success">
        Filled: {entry.side === 'BUY' ? 'bought' : 'sold'} {entry.qty.toLocaleString('en-MY')} {entry.code} at RM {entry.price.toFixed(3)}.
      </p>
    )
  }
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
      Refused by <span className="font-mono">{entry.guard}</span>: {entry.reason}.
    </p>
  )
}

function Holdings({ account }: { account: PaperAccount }) {
  const codes = Object.keys(account.positions)
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-[13px] font-semibold text-foreground">Holdings</h3>
      {codes.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">No shares yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-[12px]">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-1 font-normal">Stock</th><th className="py-1 text-right font-normal">Shares</th><th className="py-1 text-right font-normal">Avg cost</th><th className="py-1 text-right font-normal">Last close</th><th className="py-1 text-right font-normal">Value</th></tr>
            </thead>
            <tbody>
              {codes.map(code => <HoldingRow key={code} code={code} qty={account.positions[code].qty} cost={account.positions[code].cost} />)}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[12px] text-muted-foreground">Cash {money(account.cash)} · started with {money(account.startingCash)}</p>
    </div>
  )
}

function HoldingRow({ code, qty, cost }: { code: string; qty: number; cost: number }) {
  const bars = useBars(code, 5)
  const close = bars.data?.at(-1)?.close
  const name = findShariah(code)?.name ?? code
  return (
    <tr className="border-t border-border/60">
      <td className="py-1.5"><span className="font-mono text-muted-foreground">{code}</span> <span className="text-foreground">{name.replace(/ (Bhd|Berhad)$/, '')}</span></td>
      <td className="py-1.5 text-right font-mono">{qty.toLocaleString('en-MY')}</td>
      <td className="py-1.5 text-right font-mono">{(cost / qty).toFixed(3)}</td>
      <td className="py-1.5 text-right font-mono">{close != null ? close.toFixed(3) : '…'}</td>
      <td className="py-1.5 text-right font-mono">{close != null ? money(close * qty) : '…'}</td>
    </tr>
  )
}

function Journal({ account, onReset }: { account: PaperAccount; onReset: () => void }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([journalCsv(account.journal)], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `mizan-journal-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-foreground">Trade journal</h3>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={download} disabled={account.journal.length === 0}><Download size={13} /> CSV</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onReset}><RotateCcw size={13} /> Reset</Button>
        </div>
      </div>
      {account.journal.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">Every order is recorded here, including the ones the rules refuse.</p>
      ) : (
        <ol className="flex max-h-72 flex-col overflow-y-auto">
          {account.journal.map(e => (
            <li key={e.id} className="border-t border-border/60 py-1.5 text-[12px]">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className={`font-medium ${e.status === 'rejected' ? 'text-destructive' : e.side === 'BUY' ? 'text-success' : 'text-foreground'}`}>
                  {e.status === 'rejected' ? 'Refused' : e.side === 'BUY' ? 'Bought' : 'Sold'}
                </span>
                <span className="font-mono text-foreground">{e.qty.toLocaleString('en-MY')} {e.code}</span>
                {e.price > 0 && <span className="font-mono text-muted-foreground">@ {e.price.toFixed(3)}</span>}
                <span className="ml-auto text-muted-foreground">{new Date(e.at).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              {e.reason && <p className="text-muted-foreground"><span className="font-mono">{e.guard}</span>: {e.reason}</p>}
              {e.note && <p className="text-muted-foreground">Note: {e.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
