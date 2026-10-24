import type { Dispatch, SetStateAction } from 'react'
import type { Receipt } from '../../lib/storage'
import { RULES, type Region } from '../../lib/tax'
import { money, todayIso } from '../../lib/format'
import { summarise, toCsv } from '../../lib/expenses'
import type { BusinessDetails } from './settings'

interface Props {
  receipts: Receipt[]
  business: BusinessDetails
  setBusiness: Dispatch<SetStateAction<BusinessDetails>>
  client: string
  from: string
  to: string
  /** 0 when the business isn't GST registered. */
  gstRate: number
  onOpen: (r: Receipt) => void
  onMarkInvoiced: () => void
}

export function ExpenseInvoice(props: Props) {
  const { receipts, business, setBusiness, client, from, to, gstRate, onOpen, onMarkInvoiced } = props
  const rules = RULES[business.region]
  const summary = summarise(receipts, parseFloat(business.markup) || 0, gstRate)
  const $ = (n: number) => money(n, rules.currency)
  const registered = gstRate > 0
  const update = (patch: Partial<BusinessDetails>) => setBusiness((b) => ({ ...b, ...patch }))
  // Receipts saved with $0 GST before GST was calculated automatically may be overstated.
  const suspect = registered ? receipts.filter((r) => r.gst === 0 && !r.source) : []

  const exportCsv = () => {
    const blob = new Blob([toCsv(summary)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `expenses-${client || 'all'}-${todayIso()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <details className="card settings no-print">
        <summary>
          <span>
            Invoice settings
            <small className="muted">
              {business.name || 'Add your business name'} · {registered ? `GST registered` : 'Not GST registered'}
              {parseFloat(business.markup) > 0 && ` · ${business.markup}% markup`}
            </small>
          </span>
        </summary>
        <label>
          Business name
          <input value={business.name} onChange={(e) => update({ name: e.target.value })} />
        </label>
        <div className="row">
          <label>
            {business.region === 'AU' ? 'ABN' : 'GST number'}
            <input inputMode="numeric" value={business.taxId} onChange={(e) => update({ taxId: e.target.value })} />
          </label>
          <label>
            Country
            <select value={business.region} onChange={(e) => update({ region: e.target.value as Region })}>
              {Object.entries(RULES).map(([k, r]) => (
                <option key={k} value={k}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Contact / address
          <input value={business.contact} onChange={(e) => update({ contact: e.target.value })} />
        </label>
        <label className="switch">
          <span>
            Registered for GST
            <small>
              {business.gstRegistered
                ? 'You claim back the GST you paid and charge GST on the rebill'
                : 'Expenses are rebilled at the full amount you paid, with no GST'}
            </small>
          </span>
          <input
            type="checkbox"
            checked={business.gstRegistered}
            onChange={(e) => update({ gstRegistered: e.target.checked })}
          />
        </label>
        <label>
          Markup on expenses (%)
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={business.markup}
            onChange={(e) => update({ markup: e.target.value })}
          />
        </label>
      </details>

      {suspect.length > 0 && (
        <p className="warn no-print">
          {suspect.length} receipt{suspect.length > 1 ? 's have' : ' has'} $0 GST recorded, so GST is being added on
          top of the full amount. Tap {suspect.length > 1 ? 'each one' : 'it'} below to check.
        </p>
      )}

      <section className="card invoice">
        <div className="invoice-head">
          <div>
            <h3>{business.name || 'Your business'}</h3>
            {business.taxId && (
              <div className="muted small">
                {business.region === 'AU' ? 'ABN' : 'GST No.'} {business.taxId}
              </div>
            )}
            {business.contact && <div className="muted small">{business.contact}</div>}
          </div>
          <div className="right">
            <h3>{registered ? 'Tax invoice – expenses' : 'Expense statement'}</h3>
            <div className="small">Bill to: {client || 'All clients'}</div>
            <div className="muted small">{from || to ? `${from || '…'} to ${to || '…'}` : `Issued ${todayIso()}`}</div>
          </div>
        </div>

        {receipts.length === 0 ? (
          <p className="empty-inline muted">No billable expenses match these filters.</p>
        ) : (
          <>
            {/* Phone layout */}
            <ul className="invoice-lines screen-only">
              {summary.lines.map((l) => (
                <li key={l.receipt.id}>
                  <button className="invoice-line" onClick={() => onOpen(l.receipt)}>
                    <span className="receipt-main">
                      <strong>{l.receipt.merchant || 'Unknown supplier'}</strong>
                      <span className="muted small">
                        {l.receipt.date}
                        {l.receipt.description && ` · ${l.receipt.description}`}
                        {!client && l.receipt.client && ` · ${l.receipt.client}`}
                      </span>
                      <span className="muted small">
                        Paid {$(l.receipt.total)}
                        {registered && ` (GST ${$(l.receipt.gst)})`}
                        {l.markup > 0 && ` · +${$(l.markup)} markup`}
                      </span>
                    </span>
                    <span className="receipt-side">
                      <strong>{$(l.chargeTotal)}</strong>
                      {registered && <span className="muted small">incl. {$(l.chargeGst)} GST</span>}
                      {suspect.includes(l.receipt) && <span className="tag warn-tag">Check GST</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {/* Desktop and print layout */}
            <div className="table-wrap wide-only">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Item</th>
                    <th className="num">{registered ? 'Cost ex GST' : 'Cost'}</th>
                    {summary.markup > 0 && <th className="num">Markup</th>}
                    {registered && <th className="num">Amount ex GST</th>}
                    {registered && <th className="num">GST</th>}
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.lines.map((l) => (
                    <tr key={l.receipt.id} className="clickable" onClick={() => onOpen(l.receipt)}>
                      <td>{l.receipt.date}</td>
                      <td>
                        {l.receipt.merchant}
                        {l.receipt.description && ` — ${l.receipt.description}`}
                        {!client && l.receipt.client && <div className="muted small">{l.receipt.client}</div>}
                      </td>
                      <td className="num">{$(l.exGst)}</td>
                      {summary.markup > 0 && <td className="num">{$(l.markup)}</td>}
                      {registered && <td className="num">{$(l.charge)}</td>}
                      {registered && <td className="num">{$(l.chargeGst)}</td>}
                      <td className="num">{$(l.chargeTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="totals">
              {registered && (
                <>
                  <dt>Subtotal (ex GST)</dt>
                  <dd>{$(summary.subtotal)}</dd>
                  <dt>GST</dt>
                  <dd>{$(summary.gst)}</dd>
                </>
              )}
              <dt className="grand">Total due</dt>
              <dd className="grand">{$(summary.total)}</dd>
            </dl>
            {registered && summary.markup === 0 && (
              <p className="muted small note no-print">
                The GST you paid is claimed back on your BAS, and the same GST is charged to your client, so the total
                matches what you paid.
              </p>
            )}
          </>
        )}
      </section>

      {receipts.length > 0 && (
        <div className="action-bar no-print">
          <button onClick={() => window.print()}>Save PDF</button>
          <button className="ghost" onClick={exportCsv}>
            CSV
          </button>
          <button className="ghost" onClick={onMarkInvoiced} title="Mark these expenses as invoiced">
            Invoiced ✓
          </button>
        </div>
      )}
    </>
  )
}
