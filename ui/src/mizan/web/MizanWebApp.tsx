import { MizanHomePage } from '../../pages/MizanHomePage'
import { SC_LIST_DATE, SC_LIST_STOCKS } from '../scList'
import { PaperDesk } from './PaperDesk'

const SOURCE_URL = 'https://github.com/adamhaqeem12345-alt/mizan'

/** Public web build: the Bursa Shariah dashboard plus a paper account in the browser. */
export function MizanWebApp() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 md:px-8">
        <a href="/" className="flex items-center gap-2">
          <img src="/mizan.svg" alt="" className="size-8 rounded-lg" />
          <span className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">Mizan</span>
        </a>
        <p className="order-last w-full text-[12px] leading-4 text-muted-foreground sm:order-none sm:w-auto sm:min-w-0 sm:flex-1">
          Bursa Malaysia, Shariah-compliant shares only: the SC Shariah Advisory Council list of {SC_LIST_DATE} ({SC_LIST_STOCKS} stocks).
          Paper trading, cash only, no short selling.
        </p>
        <span className="ml-auto rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-medium text-warning sm:ml-0">Paper trading · no real money</span>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <MizanHomePage standalone renderTrade={(quote) => <PaperDesk quote={quote} />} />
      </main>

      <footer className="flex flex-col gap-1 border-t border-border px-4 py-4 text-[11px] leading-4 text-muted-foreground md:px-8">
        <p>
          Mizan is a demo and learning tool. Nothing here is a recommendation to buy, sell or hold any security, and it is not
          investment advice. Check Shariah status with the latest SC list and a qualified adviser.
        </p>
        <p>
          Prices: Yahoo Finance daily closes (delayed, unofficial). Shariah list: Securities Commission Malaysia, updated on the
          last Friday of May and November. The AI trading-desk agent runs in the desktop version on your own computer.
        </p>
        <p>
          Free software under the AGPL-3.0, built on <a className="underline" href="https://github.com/TraderAlice/OpenAlice">OpenAlice</a>.{' '}
          <a className="underline" href={SOURCE_URL}>Source code</a> · A <a className="underline" href="https://cuddleia.com">Cuddleia</a> project.
        </p>
      </footer>
    </div>
  )
}
