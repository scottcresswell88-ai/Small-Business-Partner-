import { describe, expect, it } from 'vitest'
import { summarise, toCsv } from './expenses'
import type { Receipt } from './storage'

const receipt = (over: Partial<Receipt>): Receipt => ({
  id: '1',
  createdAt: '',
  date: '2026-10-01',
  merchant: 'Bunnings',
  description: 'Timber',
  category: 'Materials',
  client: 'Smith',
  total: 110,
  gst: 10,
  billable: true,
  invoiced: false,
  ...over,
})

describe('summarise', () => {
  it('rebills at cost excl. GST plus markup, with GST on top', () => {
    const s = summarise([receipt({}), receipt({ id: '2', total: 55, gst: 5 })], 10, 0.1)
    expect(s.cost).toBe(150)
    expect(s.markup).toBe(15)
    expect(s.subtotal).toBe(165)
    expect(s.gst).toBe(16.5)
    expect(s.total).toBe(181.5)
  })

  it('bills exactly the receipt amount when there is no markup', () => {
    const s = summarise([receipt({ total: 49.5, gst: 4.5 })], 0, 0.1)
    expect(s.subtotal).toBe(45)
    expect(s.gst).toBe(4.5)
    expect(s.total).toBe(49.5)
  })

  it('bills the full amount paid, with no GST, when not registered', () => {
    const s = summarise([receipt({})], 0, 0)
    expect(s.cost).toBe(110)
    expect(s.gst).toBe(0)
    expect(s.total).toBe(110)
  })
})

describe('toCsv', () => {
  it('quotes cells containing commas and quotes', () => {
    const csv = toCsv(summarise([receipt({ description: 'Screws, "big"' })], 0, 0.1))
    expect(csv.split('\n')[1]).toContain('"Screws, ""big"""')
    expect(csv.split('\n')).toHaveLength(3)
  })
})
