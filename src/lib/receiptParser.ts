// Best-effort extraction of key fields from OCR'd receipt text.
// OCR is noisy, so every field is a suggestion the user can correct.

export interface ParsedReceipt {
  merchant: string
  date: string | null // ISO yyyy-mm-dd
  total: number | null
  gst: number | null
}

const AMOUNT = /\$?\s*(\d{1,3}(?:[,\s]\d{3})*|\d+)[.,](\d{2})\b/g

function amountsIn(line: string): number[] {
  return [...line.matchAll(AMOUNT)].map((m) => parseFloat(`${m[1].replace(/[,\s]/g, '')}.${m[2]}`))
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function parseDate(text: string): string | null {
  // 2026-10-23
  let m = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  if (m) return iso(+m[1], +m[2], +m[3])
  // 23/10/2026 or 23-10-26 (day first, as used in AU/NZ)
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/)
  if (m) return iso(+m[3], +m[2], +m[1])
  // 23 Oct 2026 / 23 October 26
  m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{2,4})\b/)
  if (m && MONTHS.includes(m[2].toLowerCase())) return iso(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1])
  // Oct 23, 2026
  m = text.match(/\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/)
  if (m && MONTHS.includes(m[1].toLowerCase())) return iso(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2])
  return null
}

export function parseReceipt(text: string): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  // Merchant: emailed receipts often say "Your Uber receipt" or "Receipt from Apple";
  // otherwise take the first line with a few letters that isn't a header like "TAX INVOICE".
  let merchant = ''
  for (const line of lines.slice(0, 8)) {
    const m =
      line.match(/^(?:your\s+)?(.+?)\s+(?:receipt|tax invoice|invoice|order)\b/i) ??
      line.match(/^(?:receipt|tax invoice|invoice|order)\s+from\s+(.+)$/i)
    const name = m?.[1] ?? ''
    // Skip phrases like "Thank you for your order".
    const plausible = /[A-Za-z]{2,}/.test(name) && name.split(/\s+/).length <= 4
    if (plausible && !/^(tax|your|a|the)$|thank|\byour\b/i.test(name)) {
      merchant = name.trim()
      break
    }
  }
  merchant ||=
    lines.find(
      (l) => /[A-Za-z]{2,}/.test(l) && !amountsIn(l).length && !/tax\s*invoice|receipt|abn|gst\s*no|thank/i.test(l),
    ) ?? ''

  // Total: prefer lines labelled total / amount due / balance, ignoring subtotals.
  let total: number | null = null
  for (const line of lines) {
    if (/sub\s*-?\s*total/i.test(line)) continue
    // "Total GST", "GST included in total", "Incl. GST" are the tax line, not the total.
    if (/^(total\s+)?(gst|tax)\b|^inc[a-z.]*\s+(gst|tax)/i.test(line)) continue
    if (/\b(total|amount\s*due|balance|amount\s*paid|eftpos|card)\b/i.test(line)) {
      const amounts = amountsIn(line)
      if (amounts.length) {
        const candidate = amounts[amounts.length - 1]
        // Labelled "total" wins; otherwise keep the largest labelled payment amount.
        if (/total/i.test(line) || total === null || candidate > total) total = candidate
        if (/total/i.test(line)) break
      }
    }
  }
  if (total === null) {
    const all = lines.flatMap(amountsIn)
    total = all.length ? Math.max(...all) : null
  }

  // GST: a line mentioning GST/tax with an amount (skip GST registration numbers).
  let gst: number | null = null
  for (const line of lines) {
    if (/\b(gst|tax)\b/i.test(line) && !/(abn|gst\s*(no|number|reg)|tax\s*invoice)/i.test(line)) {
      const amounts = amountsIn(line).filter((a) => total === null || a < total)
      if (amounts.length) {
        gst = amounts[amounts.length - 1]
        break
      }
    }
  }

  return { merchant, date: parseDate(text), total, gst }
}
