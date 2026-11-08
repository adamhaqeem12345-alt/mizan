// node --test mizan/scripts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { diffLists, parseScList, renderReport, sanityProblems } from './sc-list-lib.mjs'

const PDF_TEXT = `Shariah Advisory Council
LIST OF SHARIAH-COMPLIANT SECURITIES - NOVEMBER 2026
MAIN MARKET
No. Code Name
1 5347 TENAGA NASIONAL
Berhad
2 7153 KOSSAN RUBBER INDUSTRIES BHD
ACE MARKET
1. 0166 INARI AMERTRON BERHAD
Islamic business trust
1 5180 CAPITALAND MALAYSIA TRUST`

test('parses markets, wrapped names and business trusts', () => {
  const list = parseScList(PDF_TEXT, '2026-11-27')
  assert.deepEqual(list.symbols, ['5347', '7153', '0166', '5180'])
  assert.equal(list.securities[0].name, 'TENAGA NASIONAL Berhad')
  assert.equal(list.securities[2].market, 'ACE')
  assert.deepEqual(list.securities[3], { code: '5180', name: 'CAPITALAND MALAYSIA TRUST', market: null, kind: 'islamic-business-trust' })
  assert.deepEqual(list.counts, { stocks: 3, islamicBusinessTrusts: 1 })
})

test('refuses a bad date and duplicate codes', () => {
  assert.throws(() => parseScList(PDF_TEXT, '27-11-2026'), /YYYY-MM-DD/)
  assert.throws(() => parseScList(`${PDF_TEXT}\nMAIN MARKET\n3 5347 TENAGA AGAIN`, '2026-11-27'), /Duplicate/)
})

const list = (date, entries) => ({
  effectiveDate: date,
  counts: { stocks: entries.length, islamicBusinessTrusts: 0 },
  securities: entries.map(([code, name]) => ({ code, name, market: 'MAIN', kind: 'stock' })),
})

test('diffs added, removed and renamed securities', () => {
  const before = list('2026-05-29', [['5347', 'TENAGA'], ['7153', 'KOSSAN'], ['1155', 'OLD NAME']])
  const after = list('2026-11-27', [['5347', 'TENAGA'], ['1155', 'NEW NAME'], ['0166', 'INARI']])
  const diff = diffLists(before, after)
  assert.deepEqual(diff.added.map((s) => s.code), ['0166'])
  assert.deepEqual(diff.removed.map((s) => s.code), ['7153'])
  assert.deepEqual(diff.renamed, [{ code: '1155', from: 'OLD NAME', to: 'NEW NAME' }])
  const report = renderReport(diff)
  assert.match(report, /1 added, 1 removed, 1 renamed/)
  assert.match(report, /\| 7153 \| KOSSAN \| MAIN \|/)
  assert.match(report, /Sells stay allowed/)
})

test('stops when the parse lost most of the list or the total is off', () => {
  const current = JSON.parse(readFileSync(new URL('../data/sc-shariah-list-2026-05-29.json', import.meta.url), 'utf8'))
  const broken = { ...current, effectiveDate: '2026-11-27', securities: current.securities.slice(0, 100), counts: { stocks: 100, islamicBusinessTrusts: 0 } }
  assert.match(sanityProblems(diffLists(current, broken)).join(' '), /would be removed/)

  const same = { ...current, effectiveDate: '2026-11-27' }
  assert.deepEqual(sanityProblems(diffLists(current, same), { expectStocks: current.counts.stocks }), [])
  assert.match(sanityProblems(diffLists(current, same), { expectStocks: 900 }).join(' '), /Table 3 says 900/)
  assert.match(sanityProblems(diffLists(current, current)).join(' '), /not after/)
})
