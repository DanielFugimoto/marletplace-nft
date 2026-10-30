// Versioned Lighthouse audit configuration (see lighthouse/run.mjs).
export const PAGES = [
  { name: 'inicio', path: '/' },
  { name: 'detalhe', path: '/nft/emerald-ape-042' },
]

export const RUNS = 3

export const TARGETS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }

/** Lighthouse defaults: mobile = Moto G Power emulation + simulated slow 4G; desktop = desktop preset. */
export const PROFILES = {
  mobile: {
    extends: 'lighthouse:default',
    settings: { formFactor: 'mobile', throttlingMethod: 'simulate', onlyCategories: Object.keys(TARGETS) },
  },
  desktop: {
    extends: 'lighthouse:default',
    settings: {
      formFactor: 'desktop',
      throttlingMethod: 'simulate',
      screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
      emulatedUserAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
      onlyCategories: Object.keys(TARGETS),
    },
  },
}
