import Big from 'big.js'

/**
 * ETH amounts travel as decimal strings ("1.19") and are only ever combined
 * through big.js, never through JS numbers, to keep exact precision.
 */
export type EthAmount = string

Big.DP = 18
Big.RM = Big.roundHalfUp

export const ETH_DECIMALS = 18
export const ETH_PATTERN = /^\d+(\.\d{1,18})?$/

export const eth = (value: EthAmount | number | Big) => new Big(value)

export function toEth(value: Big): EthAmount {
  // toFixed avoids exponential notation for very small/large values.
  const fixed = value.round(ETH_DECIMALS, Big.roundHalfUp).toFixed(ETH_DECIMALS)
  return fixed.replace(/\.?0+$/, '') || '0'
}

export const addEth = (...values: EthAmount[]) => toEth(values.reduce((acc, v) => acc.plus(v), eth(0)))

export const mulEth = (value: EthAmount, factor: number | EthAmount) => toEth(eth(value).times(factor))

export const subEth = (a: EthAmount, b: EthAmount) => toEth(eth(a).minus(b))

export const compareEth = (a: EthAmount, b: EthAmount) => eth(a).cmp(b)

/**
 * Display format used by the layout: at least two decimals, trailing zeros
 * beyond that trimmed ("1.19", "0.016", "26.846").
 */
export function formatEth(value: EthAmount, { suffix = true }: { suffix?: boolean } = {}) {
  const [int = '0', frac = ''] = toEth(eth(value)).split('.')
  const decimals = frac.replace(/0+$/, '').padEnd(2, '0')
  const intFormatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const out = `${intFormatted}.${decimals}`
  return suffix ? `${out} ETH` : out
}
