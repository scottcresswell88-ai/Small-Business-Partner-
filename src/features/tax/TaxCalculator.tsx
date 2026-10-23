import { useEffect, useMemo, useState } from 'react'
import { RULES, estimate, type Region, type Structure, type TaxInput } from '../../lib/tax'
import { money, percent } from '../../lib/format'
import { loadJson, saveJson } from '../../lib/storage'

type Period = 'year' | 'quarter' | 'month' | 'week'
const PERIODS: Record<Period, { label: string; perYear: number }> = {
  year: { label: 'Year', perYear: 1 },
  quarter: { label: 'Quarter', perYear: 4 },
  month: { label: 'Month', perYear: 12 },
  week: { label: 'Week', perYear: 52 },
}

interface Form extends Omit<TaxInput, 'income' | 'expenses' | 'otherIncome'> {
  period: Period
  income: string
  expenses: string
  otherIncome: string
  payment: string
}

const DEFAULTS: Form = {
  region: 'AU',
  structure: 'sole_trader',
  period: 'year',
  income: '',
  incomeIncludesGst: false,
  expenses: '',
  gstRegistered: true,
  otherIncome: '',
  payment: '',
}

const num = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, '')) || 0

export function TaxCalculator() {
  const [form, setForm] = useState<Form>(() => loadJson('taxCalculator', DEFAULTS))
  useEffect(() => saveJson('taxCalculator', form), [form])
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))

  const rules = RULES[form.region]
  const perYear = PERIODS[form.period].perYear
  const result = useMemo(
    () =>
      estimate({
        ...form,
        // Tax brackets are annual, so project the entered period to a full year.
        income: num(form.income) * perYear,
        expenses: num(form.expenses) * perYear,
        otherIncome: num(form.otherIncome),
      }),
    [form, perYear],
  )
  const $ = (n: number) => money(n / perYear, rules.currency)
  const $yr = (n: number) => money(n, rules.currency)
  const payment = num(form.payment)

  return (
    <div className="feature">
      <header className="feature-head">
        <h2>Tax &amp; GST calculator</h2>
        <p className="muted">
          Work out how much of the money coming in should be put aside for {rules.gstName} and income tax.
        </p>
      </header>

      <div className="grid-2">
        <section className="card">
          <h3>Your business</h3>
          <div className="row">
            <label>
              Country
              <select value={form.region} onChange={(e) => set('region', e.target.value as Region)}>
                {Object.entries(RULES).map(([k, r]) => (
                  <option key={k} value={k}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Structure
              <select value={form.structure} onChange={(e) => set('structure', e.target.value as Structure)}>
                <option value="sole_trader">Sole trader</option>
                <option value="company">Company</option>
              </select>
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={form.gstRegistered}
              onChange={(e) => set('gstRegistered', e.target.checked)}
            />
            Registered for {rules.gstName} ({percent(rules.gstRate, 0)})
          </label>

          <h3>Money in &amp; out</h3>
          <div className="segmented" role="group" aria-label="Period">
            {(Object.keys(PERIODS) as Period[]).map((p) => (
              <button key={p} className={form.period === p ? 'active' : ''} onClick={() => set('period', p)}>
                Per {PERIODS[p].label.toLowerCase()}
              </button>
            ))}
          </div>
          <label>
            Business income this {form.period}
            <input inputMode="decimal" placeholder="0.00" value={form.income} onChange={(e) => set('income', e.target.value)} />
          </label>
          {form.gstRegistered && (
            <label className="check">
              <input
                type="checkbox"
                checked={form.incomeIncludesGst}
                onChange={(e) => set('incomeIncludesGst', e.target.checked)}
              />
              This amount already includes {rules.gstName}
            </label>
          )}
          <label>
            Business expenses this {form.period} <span className="muted">(incl. {rules.gstName})</span>
            <input inputMode="decimal" placeholder="0.00" value={form.expenses} onChange={(e) => set('expenses', e.target.value)} />
          </label>
          {form.structure === 'sole_trader' && (
            <label>
              Other income for the year <span className="muted">(e.g. wages — affects your tax bracket)</span>
              <input
                inputMode="decimal"
                placeholder="0.00"
                value={form.otherIncome}
                onChange={(e) => set('otherIncome', e.target.value)}
              />
            </label>
          )}
        </section>

        <section className="card result">
          <div className="headline">
            <span className="muted">Put aside</span>
            <strong>{percent(result.setAsideRate)}</strong>
            <span className="muted">of every dollar received</span>
          </div>
          <div className="split">
            <div>
              <span className="dot gst" /> {rules.gstName} <strong>{percent(result.gstSetAsideRate)}</strong>
            </div>
            <div>
              <span className="dot tax" /> Income tax <strong>{percent(result.taxSetAsideRate)}</strong>
            </div>
          </div>
          <div className="bar" aria-hidden>
            <span className="gst" style={{ width: percent(result.gstSetAsideRate) }} />
            <span className="tax" style={{ width: percent(result.taxSetAsideRate) }} />
          </div>

          <table className="breakdown">
            <thead>
              <tr>
                <th />
                <th>Per {form.period}</th>
                {form.period !== 'year' && <th>Per year</th>}
              </tr>
            </thead>
            <tbody>
              <Row label={`Income (excl. ${rules.gstName})`} v={result.incomeExGst} {...{ $, $yr, form }} />
              <Row label={`Expenses (excl. ${rules.gstName})`} v={-result.expensesExGst} {...{ $, $yr, form }} />
              <Row label="Taxable profit" v={result.profit} strong {...{ $, $yr, form }} />
              {form.gstRegistered && (
                <>
                  <Row label={`${rules.gstName} collected`} v={result.gstCollected} sub {...{ $, $yr, form }} />
                  <Row label={`${rules.gstName} credits on expenses`} v={-result.gstCredits} sub {...{ $, $yr, form }} />
                  <Row
                    label={result.gstPayable >= 0 ? `${rules.gstName} to pay` : `${rules.gstName} refund`}
                    v={result.gstPayable}
                    strong
                    {...{ $, $yr, form }}
                  />
                </>
              )}
              <Row label="Income tax" v={result.incomeTax} sub {...{ $, $yr, form }} />
              {result.levies.map((l) => (
                <Row key={l.name} label={l.name} v={l.amount} sub {...{ $, $yr, form }} />
              ))}
              <Row label="Total to put aside" v={result.totalToSetAside} strong {...{ $, $yr, form }} />
              <Row label="What's left for you" v={result.takeHome} strong {...{ $, $yr, form }} />
            </tbody>
          </table>

          {result.overGstThreshold && !form.gstRegistered && (
            <p className="warn">
              Your projected turnover is over the {money(rules.gstRegistrationThreshold, rules.currency)} {rules.gstName}{' '}
              registration threshold — you will likely need to register.
            </p>
          )}
          <p className="muted small">
            {form.structure === 'company'
              ? `Company rate ${percent(rules.companyRate, 0)}: ${rules.companyRateNote}`
              : `Marginal rate ${percent(result.marginalRate)} including levies.`}{' '}
            {rules.label} {rules.financialYear} rates.{' '}
            {form.period !== 'year' && `Tax is estimated on ${PERIODS[form.period].perYear}× this ${form.period}.`}
          </p>
        </section>
      </div>

      <section className="card">
        <h3>Got paid? Split it now</h3>
        <p className="muted">Enter a payment you received to see exactly how much to move into savings.</p>
        <div className="row payment">
          <label>
            Payment received <span className="muted">(as paid, incl. {rules.gstName})</span>
            <input inputMode="decimal" placeholder="0.00" value={form.payment} onChange={(e) => set('payment', e.target.value)} />
          </label>
          <div className="pay-split">
            <div>
              <span className="muted">{rules.gstName}</span>
              <strong>{$yr(payment * result.gstSetAsideRate)}</strong>
            </div>
            <div>
              <span className="muted">Tax</span>
              <strong>{$yr(payment * result.taxSetAsideRate)}</strong>
            </div>
            <div>
              <span className="muted">Yours</span>
              <strong>{$yr(payment * (1 - result.setAsideRate))}</strong>
            </div>
          </div>
        </div>
      </section>

      <p className="disclaimer">
        Estimates only, based on standard resident rates. Doesn’t include offsets, HELP/student loan repayments,
        super, provisional tax timing, or other individual circumstances. Check with your accountant.
      </p>
    </div>
  )
}

function Row(props: {
  label: string
  v: number
  strong?: boolean
  sub?: boolean
  $: (n: number) => string
  $yr: (n: number) => string
  form: Form
}) {
  const { label, v, strong, sub, $, $yr, form } = props
  return (
    <tr className={strong ? 'strong' : sub ? 'sub' : ''}>
      <td>{label}</td>
      <td>{$(v)}</td>
      {form.period !== 'year' && <td>{$yr(v)}</td>}
    </tr>
  )
}
