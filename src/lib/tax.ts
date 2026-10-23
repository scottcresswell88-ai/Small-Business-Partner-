// Tax and GST estimation rules. These are estimates only — rates change each
// financial year, so keep this table up to date and confirm with an accountant.

export type Region = 'AU' | 'NZ'
export type Structure = 'sole_trader' | 'company'

export interface Bracket {
  /** Income above this threshold is taxed at `rate` (up to the next bracket). */
  from: number
  rate: number
}

export interface RegionRules {
  label: string
  currency: string
  financialYear: string
  gstRate: number
  gstName: string
  gstRegistrationThreshold: number
  individualBrackets: Bracket[]
  /** Flat levies on taxable income for individuals, e.g. AU Medicare levy, NZ ACC earners' levy. */
  levies: { name: string; rate: number }[]
  companyRate: number
  companyRateNote: string
}

export const RULES: Record<Region, RegionRules> = {
  AU: {
    label: 'Australia',
    currency: 'AUD',
    financialYear: '2026–27',
    gstRate: 0.1,
    gstName: 'GST',
    gstRegistrationThreshold: 75_000,
    individualBrackets: [
      { from: 0, rate: 0 },
      { from: 18_200, rate: 0.15 },
      { from: 45_000, rate: 0.3 },
      { from: 135_000, rate: 0.37 },
      { from: 190_000, rate: 0.45 },
    ],
    levies: [{ name: 'Medicare levy', rate: 0.02 }],
    companyRate: 0.25,
    companyRateNote: 'Base rate entity (turnover under $50m). Other companies pay 30%.',
  },
  NZ: {
    label: 'New Zealand',
    currency: 'NZD',
    financialYear: '2026–27',
    gstRate: 0.15,
    gstName: 'GST',
    gstRegistrationThreshold: 60_000,
    individualBrackets: [
      { from: 0, rate: 0.105 },
      { from: 15_600, rate: 0.175 },
      { from: 53_500, rate: 0.3 },
      { from: 78_100, rate: 0.33 },
      { from: 180_000, rate: 0.39 },
    ],
    levies: [{ name: 'ACC earners’ levy (approx.)', rate: 0.0175 }],
    companyRate: 0.28,
    companyRateNote: 'Flat company rate.',
  },
}

/** Progressive income tax for an individual. */
export function incomeTax(taxable: number, brackets: Bracket[]): number {
  if (taxable <= 0) return 0
  let tax = 0
  for (let i = 0; i < brackets.length; i++) {
    const { from, rate } = brackets[i]
    const to = brackets[i + 1]?.from ?? Infinity
    if (taxable <= from) break
    tax += (Math.min(taxable, to) - from) * rate
  }
  return tax
}

/** GST component of a GST-inclusive amount. */
export function gstFromInclusive(amount: number, rate: number): number {
  return (amount * rate) / (1 + rate)
}

export interface TaxInput {
  region: Region
  structure: Structure
  /** Business income for the year. */
  income: number
  incomeIncludesGst: boolean
  /** Deductible business expenses for the year, GST-inclusive. */
  expenses: number
  gstRegistered: boolean
  /** Other taxable income (wages etc.) — affects which bracket business profit falls in. */
  otherIncome: number
}

export interface TaxResult {
  rules: RegionRules
  incomeExGst: number
  gstCollected: number
  gstCredits: number
  gstPayable: number
  expensesExGst: number
  profit: number
  incomeTax: number
  levies: { name: string; amount: number }[]
  totalIncomeTax: number
  totalToSetAside: number
  /** Share of every dollar received (as received, incl. GST) to put aside. */
  setAsideRate: number
  gstSetAsideRate: number
  taxSetAsideRate: number
  takeHome: number
  marginalRate: number
  overGstThreshold: boolean
}

export function estimate(input: TaxInput): TaxResult {
  const rules = RULES[input.region]
  const rate = input.gstRegistered ? rules.gstRate : 0
  const income = Math.max(0, input.income)
  const expenses = Math.max(0, input.expenses)
  const otherIncome = input.structure === 'sole_trader' ? Math.max(0, input.otherIncome) : 0

  // What the customer actually pays (cash received).
  const received = input.incomeIncludesGst || !input.gstRegistered ? income : income * (1 + rate)
  const gstCollected = gstFromInclusive(received, rate)
  const incomeExGst = received - gstCollected
  const gstCredits = gstFromInclusive(expenses, rate)
  const expensesExGst = expenses - gstCredits
  const gstPayable = gstCollected - gstCredits
  const profit = incomeExGst - expensesExGst

  let tax: number
  let levies: { name: string; amount: number }[]
  let marginalRate: number
  if (input.structure === 'company') {
    tax = Math.max(0, profit) * rules.companyRate
    levies = []
    marginalRate = rules.companyRate
  } else {
    // Only the extra tax caused by business profit is attributed to the business.
    const brackets = rules.individualBrackets
    const total = Math.max(0, otherIncome + profit)
    tax = incomeTax(total, brackets) - incomeTax(otherIncome, brackets)
    const levyBase = Math.max(0, total) - otherIncome
    levies = rules.levies.map((l) => ({ name: l.name, amount: Math.max(0, levyBase) * l.rate }))
    const top = [...brackets].reverse().find((b) => total > b.from) ?? brackets[0]
    marginalRate = top.rate + rules.levies.reduce((s, l) => s + l.rate, 0)
  }
  tax = Math.max(0, tax)
  const totalIncomeTax = tax + levies.reduce((s, l) => s + l.amount, 0)
  const gstToSetAside = Math.max(0, gstPayable)
  const totalToSetAside = gstToSetAside + totalIncomeTax

  const pct = (n: number) => (received > 0 ? n / received : 0)
  return {
    rules,
    incomeExGst,
    gstCollected,
    gstCredits,
    gstPayable,
    expensesExGst,
    profit,
    incomeTax: tax,
    levies,
    totalIncomeTax,
    totalToSetAside,
    setAsideRate: pct(totalToSetAside),
    gstSetAsideRate: pct(gstToSetAside),
    taxSetAsideRate: pct(totalIncomeTax),
    // A GST refund (credits exceeding GST collected) comes back as cash.
    takeHome: received - expenses - totalToSetAside + Math.max(0, -gstPayable),
    marginalRate,
    overGstThreshold: incomeExGst >= rules.gstRegistrationThreshold,
  }
}
