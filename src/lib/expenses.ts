import type { Receipt } from './storage'
import { round2 } from './format'

export interface ExpenseLine {
  receipt: Receipt
  exGst: number
  markup: number
  /** Amount charged to the client, excl. GST. */
  charge: number
  chargeGst: number
  chargeTotal: number
}

export interface ExpenseSummary {
  lines: ExpenseLine[]
  cost: number
  markup: number
  subtotal: number
  gst: number
  total: number
}

/**
 * Turn receipts into rebillable lines.
 *
 * GST registered (gstRate > 0): the GST on the receipt is claimed back as a credit,
 * so the expense is rebilled at its GST-exclusive cost (plus markup) and GST is
 * charged on that. With no markup the client pays exactly what the receipt shows.
 *
 * Not registered (gstRate = 0): no credit can be claimed and no GST can be charged,
 * so the full amount paid is the cost.
 */
export function summarise(receipts: Receipt[], markupPct: number, gstRate: number): ExpenseSummary {
  const lines = receipts.map((receipt) => {
    const exGst = gstRate > 0 ? receipt.total - receipt.gst : receipt.total
    const markup = round2((exGst * markupPct) / 100)
    const charge = round2(exGst + markup)
    const chargeGst = round2(charge * gstRate)
    return { receipt, exGst, markup, charge, chargeGst, chargeTotal: round2(charge + chargeGst) }
  })
  const sum = (f: (l: ExpenseLine) => number) => round2(lines.reduce((s, l) => s + f(l), 0))
  return {
    lines,
    cost: sum((l) => l.exGst),
    markup: sum((l) => l.markup),
    subtotal: sum((l) => l.charge),
    gst: sum((l) => l.chargeGst),
    total: sum((l) => l.chargeTotal),
  }
}

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(summary: ExpenseSummary): string {
  const header = [
    'Date',
    'Supplier',
    'Description',
    'Category',
    'Client',
    'Paid (incl GST)',
    'GST paid',
    'Cost (excl GST)',
    'Markup',
    'Charge (excl GST)',
    'GST charged',
    'Charge (incl GST)',
  ]
  const rows = summary.lines.map((l) => [
    l.receipt.date,
    l.receipt.merchant,
    l.receipt.description,
    l.receipt.category,
    l.receipt.client,
    l.receipt.total.toFixed(2),
    l.receipt.gst.toFixed(2),
    l.exGst.toFixed(2),
    l.markup.toFixed(2),
    l.charge.toFixed(2),
    l.chargeGst.toFixed(2),
    l.chargeTotal.toFixed(2),
  ])
  const totals = [summary.cost, summary.markup, summary.subtotal, summary.gst, summary.total]
  rows.push(['', 'TOTAL', '', '', '', '', '', ...totals.map((n) => n.toFixed(2))])
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
}
