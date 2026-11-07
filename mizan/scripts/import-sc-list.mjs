#!/usr/bin/env node
// Mizan: turn the SC Shariah Advisory Council list (PDF) into JSON for the
// shariah-sc-list guard.
//
// Usage:
//   pdftotext -raw "List of Shariah-compliant securities May 2026_final.pdf" list.txt
//   node mizan/scripts/import-sc-list.mjs list.txt 2026-05-29 > mizan/data/sc-shariah-list-2026-05-29.json
//
// The list is published on the last Friday of May and November:
// https://www.sc.com.my/development/icm/shariah-compliant-securities/list-of-shariah-compliant-securities

import { readFileSync } from 'node:fs'

const [textPath, effectiveDate] = process.argv.slice(2)
if (!textPath || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate ?? '')) {
  console.error('usage: import-sc-list.mjs <pdftotext -raw output> <effective date YYYY-MM-DD>')
  process.exit(1)
}

const lines = readFileSync(textPath, 'utf8').split(/\r?\n/).map(l => l.trim())
const start = lines.findIndex(l => /^LIST OF SHARIAH-COMPLIANT SECURITIES - /.test(l))
if (start < 0) throw new Error('Could not find the start of the securities list')

const ENTRY = /^(\d{1,3})\.?\s+(\d{4,5}[A-Z]{0,2})\s+(.+)$/
const MARKET = /^(MAIN|ACE|LEAP) MARKET/
const BUSINESS_TRUST = /^Islamic business trust$/i
// Lines that end a wrapped security name.
const BOUNDARY = /^(No\.|Bil\.|\*|Shariah Advisory Council|List of Shariah|[A-Z][A-Z ,&*]+$|\d+$|The list is updated)/

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

process.stdout.write(JSON.stringify({
  source: 'List of Shariah-compliant Securities by the Shariah Advisory Council of the Securities Commission Malaysia',
  sourceUrl: 'https://www.sc.com.my/development/icm/shariah-compliant-securities/list-of-shariah-compliant-securities',
  effectiveDate,
  counts: {
    stocks: securities.filter(s => s.kind === 'stock').length,
    islamicBusinessTrusts: securities.filter(s => s.kind === 'islamic-business-trust').length,
  },
  symbols: codes,
  securities,
}, null, 2) + '\n')
