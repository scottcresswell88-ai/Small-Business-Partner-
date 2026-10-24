export function money(n: number, currency = 'AUD'): string {
  return new Intl.NumberFormat(currency === 'NZD' ? 'en-NZ' : 'en-AU', {
    style: 'currency',
    currency,
  }).format(Number.isFinite(n) ? n : 0)
}

export function percent(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
