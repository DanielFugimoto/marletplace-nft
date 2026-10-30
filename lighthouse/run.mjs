// Lighthouse audit: optimized build + default mock scenario, 3 runs per page and
// profile, median per category. Writes HTML/JSON reports and a summary to
// lighthouse/reports. Usage: npm run build && npm run lighthouse
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from '@playwright/test'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { PAGES, PROFILES, RUNS, TARGETS } from './config.mjs'

const PORT = 4174
const BASE = `http://localhost:${PORT}`
const OUT = path.resolve('lighthouse/reports')

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`server did not start: ${url}`)
}

await mkdir(OUT, { recursive: true })
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'ignore' })
const chromePath = process.env.CHROME_PATH ?? chromium.executablePath()
let chrome
try {
  await waitForServer(BASE)
  chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox'] })

  const results = []
  for (const [profile, config] of Object.entries(PROFILES)) {
    for (const page of PAGES) {
      const runs = []
      for (let i = 1; i <= RUNS; i++) {
        const result = await lighthouse(
          BASE + page.path,
          { port: chrome.port, output: ['html', 'json'], logLevel: 'error' },
          config,
        )
        const [html, json] = result.report
        const base = `${page.name}-${profile}-run${i}`
        await writeFile(path.join(OUT, `${base}.html`), html)
        await writeFile(path.join(OUT, `${base}.json`), json)
        const lhr = result.lhr
        runs.push({
          scores: Object.fromEntries(Object.keys(TARGETS).map((c) => [c, Math.round(lhr.categories[c].score * 100)])),
          lcp: lhr.audits['largest-contentful-paint'].numericValue,
          cls: lhr.audits['cumulative-layout-shift'].numericValue,
          tbt: lhr.audits['total-blocking-time'].numericValue,
          lighthouseVersion: lhr.lighthouseVersion,
          userAgent: lhr.environment.hostUserAgent,
        })
        console.log(`${profile} ${page.name} run ${i}:`, runs.at(-1).scores)
      }
      results.push({
        profile,
        page: page.name,
        path: page.path,
        median: Object.fromEntries(Object.keys(TARGETS).map((c) => [c, median(runs.map((r) => r.scores[c]))])),
        lcpMs: Math.round(median(runs.map((r) => r.lcp))),
        cls: Number(median(runs.map((r) => r.cls)).toFixed(3)),
        tbtMs: Math.round(median(runs.map((r) => r.tbt))),
        runs,
      })
    }
  }

  const environment = {
    date: new Date().toISOString(),
    lighthouse: results[0]?.runs[0]?.lighthouseVersion,
    chrome: results[0]?.runs[0]?.userAgent,
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: os.cpus()[0]?.model,
    build: 'vite build (production) served by vite preview',
    mocks: 'MSW enabled, default scenario (latency 120–350 ms)',
    runsPerPage: RUNS,
  }
  await writeFile(path.join(OUT, 'summary.json'), JSON.stringify({ environment, targets: TARGETS, results }, null, 2))

  const rows = results.map(
    (r) =>
      `| ${r.page} | ${r.profile} | ${Object.keys(TARGETS)
        .map((c) => `${r.median[c]}${r.median[c] < TARGETS[c] ? ' ⚠️' : ''}`)
        .join(' | ')} | ${r.lcpMs} | ${r.cls} | ${r.tbtMs} |`,
  )
  const md = [
    '# Lighthouse — resumo (mediana de 3 execuções)',
    '',
    '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Ambiente',
    '',
    ...Object.entries(environment).map(([k, v]) => `- **${k}**: ${v}`),
    '',
  ].join('\n')
  await writeFile(path.join(OUT, 'summary.md'), md)
  console.log(md)
} finally {
  await chrome?.kill()
  server.kill()
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true })
}
