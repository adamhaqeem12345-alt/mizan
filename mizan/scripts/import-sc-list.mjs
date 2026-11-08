#!/usr/bin/env node
// Mizan: turn the SC Shariah Advisory Council list (PDF) into JSON for the
// shariah-sc-list guard. For the twice-yearly update use update-sc-list.mjs,
// which also diffs against the current list and repoints every reader.
//
// Usage:
//   pdftotext -raw "List of Shariah-compliant securities May 2026_final.pdf" list.txt
//   node mizan/scripts/import-sc-list.mjs list.txt 2026-05-29 > mizan/data/sc-shariah-list-2026-05-29.json
//
// The list is published on the last Friday of May and November:
// https://www.sc.com.my/development/icm/shariah-compliant-securities/list-of-shariah-compliant-securities

import { readFileSync } from 'node:fs'
import { parseScList } from './sc-list-lib.mjs'

const [textPath, effectiveDate] = process.argv.slice(2)
if (!textPath || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate ?? '')) {
  console.error('usage: import-sc-list.mjs <pdftotext -raw output> <effective date YYYY-MM-DD>')
  process.exit(1)
}

process.stdout.write(JSON.stringify(parseScList(readFileSync(textPath, 'utf8'), effectiveDate), null, 2) + '\n')
