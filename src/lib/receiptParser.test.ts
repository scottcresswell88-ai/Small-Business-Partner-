import { describe, expect, it } from 'vitest'
import { parseDate, parseReceipt } from './receiptParser'

describe('parseReceipt', () => {
  it('extracts merchant, date, total and GST from a typical AU receipt', () => {
    const text = `TAX INVOICE
Bunnings Warehouse
ABN 26 008 672 179
Date: 14/09/2026 10:32
Timber 2.4m      3 @ 12.00   36.00
Screws                       13.50
SUBTOTAL                     49.50
TOTAL                       $49.50
GST included in total         4.50
EFTPOS                       49.50`
    expect(parseReceipt(text)).toEqual({
      merchant: 'Bunnings Warehouse',
      date: '2026-09-14',
      total: 49.5,
      gst: 4.5,
    })
  })

  it('handles thousands separators and "Total GST" lines', () => {
    const text = `Office Supplies Co\n02 Mar 2026\nTotal GST $118.18\nTotal inc GST $1,300.00`
    const r = parseReceipt(text)
    expect(r.total).toBe(1300)
    expect(r.gst).toBe(118.18)
    expect(r.date).toBe('2026-03-02')
  })

  it('falls back to the largest amount when there is no total label', () => {
    expect(parseReceipt('Cafe\n4.50\n12.00\n7.25').total).toBe(12)
  })

  it('returns nulls for unreadable text', () => {
    expect(parseReceipt('')).toEqual({ merchant: '', date: null, total: null, gst: null })
  })
})

describe('parseDate', () => {
  it.each([
    ['2026-10-23', '2026-10-23'],
    ['23/10/26', '2026-10-23'],
    ['23.10.2026', '2026-10-23'],
    ['Oct 23, 2026', '2026-10-23'],
    ['23 October 2026', '2026-10-23'],
  ])('%s', (input, expected) => expect(parseDate(input)).toBe(expected))
})
