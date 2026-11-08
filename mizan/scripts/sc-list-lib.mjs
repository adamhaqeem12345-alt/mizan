// Mizan: pure helpers for the SC Shariah list. Used by import-sc-list.mjs and
// update-sc-list.mjs; tested in sc-list-lib.test.mjs.

const SOURCE = 'List of Shariah-compliant Securities by the Shariah Advisory Council of the Securities Commission Malaysia'
const SOURCE_URL = 'https://www.sc.com.my/development/icm/shariah-compliant-securities/list-of-shariah-compliant-securities'

const ENTRY = /^(\d{1,3})\.?\s+(\d{4,5}[A-Z]{0,2})\s+(.+)$/
const MARKET = /^(MAIN|ACE|LEAP) MARKET/
const BUSINESS_TRUST = /^Islamic business trust$/i
// Lines that end a wrapped security name.
const BOUNDARY = /^(No\.|Bil\.|\*|Shariah Advisory Council|List of Shariah|[A-Z][A-Z ,&*]+$|\d+$|The list is updated)/

/** `pdftotext -raw` output of the SC PDF → the list JSON the guard, UI and cloud read. */
export function parseScList(text, effectiveDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate ?? '')) throw new Error('effective date must be YYYY-MM-DD')
  const lines = text.split(/\r?\n/).map(l => l.trim())
  const start = lines.findIndex(l => /^LIST OF SHARIAH-COMPLIANT SECURITIES - /.test(l))
  if (start < 0) throw new Error('Could not find the start of the securities list')

  const securities = []
  let market = 'MAIN'
  let kind = 'stock'
  let current = null

  for (const line of lines.slice(start)) {
    const m = MARKET.exec(line)
    if (m) { market = m[1]; current = null; continue }
    // The business-trust table has no market heading of its own.
    if (BUSINESS_TRUST.test(line)) { kind = 'islamic-business-trust'; market = null; current = null; continue }

    const e = ENTRY.exec(line)
    if (e) {
      current = { code: e[2], name: e[3], market, kind }
      securities.push(current)
      continue
    }
    if (current && line && !BOUNDARY.test(line)) current.name += ` ${line}`
    else current = null
  }

  const codes = securities.map(s => s.code)
  if (new Set(codes).size !== codes.length) throw new Error('Duplicate stock codes found')

  return {
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    effectiveDate,
    counts: {
      stocks: securities.filter(s => s.kind === 'stock').length,
      islamicBusinessTrusts: securities.filter(s => s.kind === 'islamic-business-trust').length,
    },
    symbols: codes,
    securities,
  }
}

/** What changed between two lists: added, removed, and renamed (same code). */
export function diffLists(previous, next) {
  const before = new Map(previous.securities.map(s => [s.code, s]))
  const after = new Map(next.securities.map(s => [s.code, s]))
  const byCode = (a, b) => a.code.localeCompare(b.code)
  return {
    from: previous.effectiveDate,
    to: next.effectiveDate,
    added: next.securities.filter(s => !before.has(s.code)).sort(byCode),
    removed: previous.securities.filter(s => !after.has(s.code)).sort(byCode),
    renamed: next.securities
      .filter(s => before.has(s.code) && before.get(s.code).name !== s.name)
      .map(s => ({ code: s.code, from: before.get(s.code).name, to: s.name }))
      .sort(byCode),
    counts: { before: previous.counts, after: next.counts },
  }
}

/**
 * Reasons to stop before writing anything: a parse that lost most of the list,
 * or a total that doesn't match the SC's own Table 3 count.
 */
export function sanityProblems(diff, { expectStocks } = {}) {
  const problems = []
  const before = diff.counts.before.stocks
  if (diff.removed.length > before * 0.2) {
    problems.push(`${diff.removed.length} of ${before} securities would be removed; a list change is usually under 10%. Check the PDF text.`)
  }
  if (expectStocks != null && diff.counts.after.stocks !== expectStocks) {
    problems.push(`Parsed ${diff.counts.after.stocks} stocks but the SC's Table 3 says ${expectStocks}.`)
  }
  if (diff.to <= diff.from) problems.push(`New list date ${diff.to} is not after the current ${diff.from}.`)
  return problems
}

const row = s => `| ${s.code} | ${s.name} | ${s.market ?? 'business trust'} |`

/** A short Markdown report for the commit and for Adam. */
export function renderReport(diff) {
  const { before, after } = diff.counts
  const out = [
    `# SC Shariah list: ${diff.from} → ${diff.to}`,
    '',
    `Stocks: ${before.stocks} → ${after.stocks} · Islamic business trusts: ${before.islamicBusinessTrusts} → ${after.islamicBusinessTrusts}`,
    '',
    `**${diff.added.length} added, ${diff.removed.length} removed, ${diff.renamed.length} renamed.**`,
    '',
  ]
  if (diff.added.length) out.push('## Added (now Shariah-compliant)', '', '| Code | Name | Market |', '|---|---|---|', ...diff.added.map(row), '')
  if (diff.removed.length) {
    out.push(
      '## Removed (no longer Shariah-compliant)',
      '',
      'Buys are now refused by the `shariah-sc-list` guard. Sells stay allowed, so anyone holding these can dispose of them.',
      '',
      '| Code | Name | Market |',
      '|---|---|---|',
      ...diff.removed.map(row),
      '',
    )
  }
  if (diff.renamed.length) {
    out.push('## Renamed', '', '| Code | Was | Now |', '|---|---|---|', ...diff.renamed.map(r => `| ${r.code} | ${r.from} | ${r.to} |`), '')
  }
  return out.join('\n')
}
