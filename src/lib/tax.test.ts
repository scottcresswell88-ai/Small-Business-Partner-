import { describe, expect, it } from 'vitest'
import { RULES, estimate, gstFromInclusive, incomeTax } from './tax'

describe('incomeTax', () => {
  const au = RULES.AU.individualBrackets
  it('is zero under the tax-free threshold', () => expect(incomeTax(18_000, au)).toBe(0))
  it('applies progressive brackets', () => {
    // (45,000 - 18,200) * 15% + (80,000 - 45,000) * 30%
    expect(incomeTax(80_000, au)).toBeCloseTo(4_020 + 10_500)
  })
})

describe('gstFromInclusive', () => {
  it('extracts 1/11th for 10% GST', () => expect(gstFromInclusive(110, 0.1)).toBeCloseTo(10))
  it('extracts 3/23rds for 15% GST', () => expect(gstFromInclusive(115, 0.15)).toBeCloseTo(15))
})

describe('estimate', () => {
  it('sole trader in AU, GST registered, income excl. GST', () => {
    const r = estimate({
      region: 'AU',
      structure: 'sole_trader',
      income: 100_000,
      incomeIncludesGst: false,
      expenses: 11_000,
      gstRegistered: true,
      otherIncome: 0,
    })
    expect(r.gstCollected).toBeCloseTo(10_000)
    expect(r.gstCredits).toBeCloseTo(1_000)
    expect(r.gstPayable).toBeCloseTo(9_000)
    expect(r.profit).toBeCloseTo(90_000)
    expect(r.incomeTax).toBeCloseTo(incomeTax(90_000, RULES.AU.individualBrackets))
    expect(r.levies[0].amount).toBeCloseTo(1_800)
    expect(r.totalToSetAside).toBeCloseTo(9_000 + r.incomeTax + 1_800)
    expect(r.takeHome).toBeCloseTo(110_000 - 11_000 - r.totalToSetAside)
  })

  it('not GST registered collects no GST and claims no credits', () => {
    const r = estimate({
      region: 'AU',
      structure: 'sole_trader',
      income: 50_000,
      incomeIncludesGst: false,
      expenses: 5_000,
      gstRegistered: false,
      otherIncome: 0,
    })
    expect(r.gstCollected).toBe(0)
    expect(r.gstCredits).toBe(0)
    expect(r.profit).toBe(45_000)
  })

  it('attributes only the extra tax from business profit when there is other income', () => {
    const r = estimate({
      region: 'AU',
      structure: 'sole_trader',
      income: 20_000,
      incomeIncludesGst: true,
      expenses: 0,
      gstRegistered: false,
      otherIncome: 60_000,
    })
    expect(r.incomeTax).toBeCloseTo(20_000 * 0.3)
  })

  it('company pays flat rate on profit', () => {
    const r = estimate({
      region: 'NZ',
      structure: 'company',
      income: 115_000,
      incomeIncludesGst: true,
      expenses: 0,
      gstRegistered: true,
      otherIncome: 0,
    })
    expect(r.gstPayable).toBeCloseTo(15_000)
    expect(r.incomeTax).toBeCloseTo(100_000 * 0.28)
    expect(r.setAsideRate).toBeCloseTo((15_000 + 28_000) / 115_000)
  })

  it('a loss produces no income tax and a GST refund adds to take-home', () => {
    const r = estimate({
      region: 'AU',
      structure: 'sole_trader',
      income: 1_100,
      incomeIncludesGst: true,
      expenses: 2_200,
      gstRegistered: true,
      otherIncome: 0,
    })
    expect(r.totalIncomeTax).toBe(0)
    expect(r.gstPayable).toBeCloseTo(-100)
    expect(r.takeHome).toBeCloseTo(1_100 - 2_200 + 100)
  })
})
