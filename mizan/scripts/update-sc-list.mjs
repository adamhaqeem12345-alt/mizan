#!/usr/bin/env node
// Mizan: the twice-yearly SC Shariah list update in one step.
//
//   node mizan/scripts/update-sc-list.mjs <list.pdf | list.txt> <YYYY-MM-DD> [--expect-stocks N] [--dry-run] [--force]
//
// 1. Reads the SC PDF (through `pdftotext -raw`) or text already extracted.
// 2. Parses it and compares it with the current list: added, removed, renamed.
// 3. Stops if the result looks wrong (most of the list gone, or the total not
//    matching --expect-stocks, the "Total" in the SC's Table 3). --force skips this.
// 4. Writes mizan/data/sc-shariah-list-<date>.json and a change report beside it,
//    copies the list to the agent skill, repoints the guard, the web app, the
//    tests and the cloud API at the new file, and refreshes the cloud copy.
//
// --dry-run prints the report and writes nothing.

import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { diffLists, parseScList, renderReport, sanityProblems } from './sc-list-lib.mjs'

const repo = fileURLToPath(new URL('../../', import.meta.url))
const DATA = join(repo, 'mizan/data')
const LIST_FILE = /sc-shariah-list-\d{4}-\d{2}-\d{2}\.json/g

// Every file that names the current list. The skill keeps a fixed name and gets a copy.
const READERS = [
  'ui/src/mizan/scList.ts',
  'ui/src/components/guards.tsx',
  'mizan/cloud/scripts/sync.mjs',
  'tests/integration/uta-simulation/mizan-guards.spec.ts',
  'README.md',
]
const SKILL_COPY = 'default/skills/mizan-shariah/sc-shariah-list.json'

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const [input, effectiveDate] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--expect-stocks')
if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate ?? '')) {
  console.error('usage: update-sc-list.mjs <list.pdf | list.txt> <YYYY-MM-DD> [--expect-stocks N] [--dry-run] [--force]')
  process.exit(1)
}

function readText(path) {
  if (!path.toLowerCase().endsWith('.pdf')) return readFileSync(path, 'utf8')
  const out = join(mkdtempSync(join(tmpdir(), 'sc-list-')), 'list.txt')
  execFileSync('pdftotext', ['-raw', path, out])
  return readFileSync(out, 'utf8')
}

const currentFile = readdirSync(DATA).filter((f) => /^sc-shariah-list-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().at(-1)
if (!currentFile) throw new Error('No current list in mizan/data')
const previous = JSON.parse(readFileSync(join(DATA, currentFile), 'utf8'))
const next = parseScList(readText(input), effectiveDate)
const diff = diffLists(previous, next)
const report = renderReport(diff)
console.log(report)

const expectStocks = option('--expect-stocks')
const problems = sanityProblems(diff, { expectStocks: expectStocks == null ? undefined : Number(expectStocks) })
if (problems.length) {
  console.error(`\nStopped:\n- ${problems.join('\n- ')}`)
  if (!flag('--force')) process.exit(2)
}
if (flag('--dry-run')) {
  console.error('\nDry run: nothing written.')
  process.exit(0)
}

const newFile = `sc-shariah-list-${effectiveDate}.json`
writeFileSync(join(DATA, newFile), JSON.stringify(next, null, 2) + '\n')
writeFileSync(join(DATA, `sc-list-changes-${effectiveDate}.md`), report + '\n')
copyFileSync(join(DATA, newFile), join(repo, SKILL_COPY))
for (const rel of READERS) {
  const path = join(repo, rel)
  const text = readFileSync(path, 'utf8')
  writeFileSync(path, text.replace(LIST_FILE, newFile))
}
execFileSync(process.execPath, [join(repo, 'mizan/cloud/scripts/sync.mjs')], { stdio: 'inherit' })

console.error(`
Wrote mizan/data/${newFile} and sc-list-changes-${effectiveDate}.md, updated the skill copy and:
  ${READERS.join('\n  ')}
Next: run the tests, update "the next list is due" in README.md, commit, and push.
The web app and the cloud API redeploy from the mizan branch; restart the desktop app
so the guard reloads the list.`)
