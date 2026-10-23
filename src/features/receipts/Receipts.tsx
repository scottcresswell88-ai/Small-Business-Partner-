import { useEffect, useMemo, useRef, useState } from 'react'
import { receiptStore, loadJson, saveJson, type Receipt } from '../../lib/storage'
import { downscale, recognise } from '../../lib/ocr'
import { parseReceipt } from '../../lib/receiptParser'
import { RULES, gstFromInclusive } from '../../lib/tax'
import { money, round2, todayIso } from '../../lib/format'
import { summarise, toCsv } from '../../lib/expenses'
import { ReceiptEditor } from './ReceiptEditor'
import { BUSINESS_DEFAULTS, type BusinessDetails } from './settings'

type View = 'receipts' | 'invoice'

export function Receipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [scanning, setScanning] = useState<string[]>([])
  const [editing, setEditing] = useState<Receipt | null>(null)
  const [view, setView] = useState<View>('receipts')
  const [business, setBusiness] = useState<BusinessDetails>(() => loadJson('business', BUSINESS_DEFAULTS))
  useEffect(() => saveJson('business', business), [business])

  // Filters
  const [client, setClient] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [onlyUninvoiced, setOnlyUninvoiced] = useState(true)

  const cameraInput = useRef<HTMLInputElement>(null)
  const uploadInput = useRef<HTMLInputElement>(null)
  const rules = RULES[business.region]

  useEffect(() => {
    receiptStore.all().then((all) => setReceipts(all.sort((a, b) => b.date.localeCompare(a.date))))
  }, [])

  const save = async (r: Receipt) => {
    await receiptStore.put(r)
    setReceipts((all) => [r, ...all.filter((x) => x.id !== r.id)].sort((a, b) => b.date.localeCompare(a.date)))
  }

  const remove = async (id: string) => {
    await receiptStore.remove(id)
    setReceipts((all) => all.filter((x) => x.id !== id))
    setEditing(null)
  }

  const scan = async (files: FileList | null) => {
    if (!files?.length) return
    const list = [...files]
    setScanning((s) => [...s, ...list.map((f) => f.name)])
    let last: Receipt | null = null
    for (const file of list) {
      try {
        const image = await downscale(file)
        let ocrText = ''
        try {
          ocrText = await recognise(image)
        } catch (err) {
          console.error('OCR failed', err)
        }
        const parsed = parseReceipt(ocrText)
        const total = parsed.total ?? 0
        last = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          date: parsed.date ?? todayIso(),
          merchant: parsed.merchant,
          description: '',
          category: 'Materials',
          client,
          total,
          gst: parsed.gst ?? round2(gstFromInclusive(total, rules.gstRate)),
          billable: true,
          invoiced: false,
          image,
          ocrText,
        }
        await save(last)
      } catch (err) {
        alert(`Couldn't read ${file.name}: ${(err as Error).message}`)
      } finally {
        setScanning((s) => {
          const i = s.indexOf(file.name)
          return i < 0 ? s : [...s.slice(0, i), ...s.slice(i + 1)]
        })
      }
    }
    // Open the last scanned receipt so the user can check what OCR picked up.
    if (last && list.length === 1) setEditing(last)
  }

  const addManual = () =>
    setEditing({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      date: todayIso(),
      merchant: '',
      description: '',
      category: 'Materials',
      client,
      total: 0,
      gst: 0,
      billable: true,
      invoiced: false,
    })

  const clients = useMemo(() => [...new Set(receipts.map((r) => r.client).filter(Boolean))].sort(), [receipts])

  const filtered = receipts.filter(
    (r) =>
      (!client || r.client === client) &&
      (!from || r.date >= from) &&
      (!to || r.date <= to) &&
      (!onlyUninvoiced || !r.invoiced),
  )
  const billable = filtered.filter((r) => r.billable)
  const summary = summarise(billable, parseFloat(business.markup) || 0, rules.gstRate)
  const $ = (n: number) => money(n, rules.currency)

  const exportCsv = () => {
    const blob = new Blob([toCsv(summary)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `expenses-${client || 'all'}-${todayIso()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const markInvoiced = async () => {
    if (!confirm(`Mark ${billable.length} expense(s) as invoiced?`)) return
    for (const r of billable) await save({ ...r, invoiced: true })
  }

  return (
    <div className="feature">
      <header className="feature-head">
        <h2>Receipts &amp; expenses</h2>
        <p className="muted">Snap receipts as you go, tag them to a client, and bill them back.</p>
      </header>

      <section className="card scan-bar no-print">
        <button onClick={() => cameraInput.current?.click()}>📷 Scan receipt</button>
        <button className="ghost" onClick={() => uploadInput.current?.click()}>
          Upload photos
        </button>
        <button className="ghost" onClick={addManual}>
          Add manually
        </button>
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            scan(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={uploadInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            scan(e.target.files)
            e.target.value = ''
          }}
        />
        {scanning.length > 0 && (
          <span className="scanning">
            <span className="spinner" /> Reading {scanning.length} receipt{scanning.length > 1 ? 's' : ''}…
          </span>
        )}
      </section>

      <section className="card filters no-print">
        <label>
          Client / job
          <select value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={onlyUninvoiced} onChange={(e) => setOnlyUninvoiced(e.target.checked)} />
          Hide invoiced
        </label>
      </section>

      <div className="segmented no-print" role="tablist">
        <button className={view === 'receipts' ? 'active' : ''} onClick={() => setView('receipts')}>
          All receipts ({filtered.length})
        </button>
        <button className={view === 'invoice' ? 'active' : ''} onClick={() => setView('invoice')}>
          Expense invoice ({billable.length})
        </button>
      </div>

      {view === 'receipts' ? (
        <section className="card table-wrap">
          {filtered.length === 0 ? (
            <p className="empty">No receipts yet. Scan or upload one to get started.</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th />
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Client</th>
                  <th>Category</th>
                  <th className="num">GST</th>
                  <th className="num">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => setEditing(r)}>
                    <td>{r.image ? <img className="thumb" src={r.image} alt="" /> : <span className="thumb" />}</td>
                    <td>{r.date}</td>
                    <td>
                      {r.merchant || <span className="muted">Unknown</span>}
                      {r.description && <div className="muted small">{r.description}</div>}
                    </td>
                    <td>{r.client || <span className="muted">—</span>}</td>
                    <td>{r.category}</td>
                    <td className="num">{$(r.gst)}</td>
                    <td className="num">{$(r.total)}</td>
                    <td>
                      {r.invoiced ? (
                        <span className="tag done">Invoiced</span>
                      ) : r.billable ? (
                        <span className="tag">Billable</span>
                      ) : (
                        <span className="tag muted">Own cost</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : (
        <>
          <details className="card no-print">
            <summary>Invoice details</summary>
            <div className="row">
              <label>
                Business name
                <input value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} />
              </label>
              <label>
                {business.region === 'AU' ? 'ABN' : 'GST number'}
                <input value={business.taxId} onChange={(e) => setBusiness({ ...business, taxId: e.target.value })} />
              </label>
            </div>
            <label>
              Contact / address
              <input value={business.contact} onChange={(e) => setBusiness({ ...business, contact: e.target.value })} />
            </label>
            <div className="row">
              <label>
                Country (sets GST rate)
                <select
                  value={business.region}
                  onChange={(e) => setBusiness({ ...business, region: e.target.value as BusinessDetails['region'] })}
                >
                  {Object.entries(RULES).map(([k, r]) => (
                    <option key={k} value={k}>
                      {r.label} ({r.gstRate * 100}%)
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Markup on expenses (%)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={business.markup}
                  onChange={(e) => setBusiness({ ...business, markup: e.target.value })}
                />
              </label>
            </div>
          </details>

          <section className="card invoice">
            <div className="invoice-head">
              <div>
                <h3>{business.name || 'Your business'}</h3>
                {business.taxId && (
                  <div className="muted">
                    {business.region === 'AU' ? 'ABN' : 'GST No.'} {business.taxId}
                  </div>
                )}
                {business.contact && <div className="muted">{business.contact}</div>}
              </div>
              <div className="right">
                <h3>Expense statement</h3>
                <div>Bill to: {client || 'All clients'}</div>
                <div className="muted">
                  {from || to ? `${from || '…'} to ${to || '…'}` : `Issued ${todayIso()}`}
                </div>
              </div>
            </div>
            {billable.length === 0 ? (
              <p className="empty">No billable expenses match these filters.</p>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Item</th>
                      <th className="num">Cost ex GST</th>
                      {summary.markup > 0 && <th className="num">Markup</th>}
                      <th className="num">Amount ex GST</th>
                      <th className="num">GST</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.lines.map((l) => (
                      <tr key={l.receipt.id}>
                        <td>{l.receipt.date}</td>
                        <td>
                          {l.receipt.merchant}
                          {l.receipt.description && ` — ${l.receipt.description}`}
                          {!client && l.receipt.client && <div className="muted small">{l.receipt.client}</div>}
                        </td>
                        <td className="num">{$(l.exGst)}</td>
                        {summary.markup > 0 && <td className="num">{$(l.markup)}</td>}
                        <td className="num">{$(l.charge)}</td>
                        <td className="num">{$(l.chargeGst)}</td>
                        <td className="num">{$(l.chargeTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <dl className="totals">
                  <dt>Subtotal (ex GST)</dt>
                  <dd>{$(summary.subtotal)}</dd>
                  <dt>GST</dt>
                  <dd>{$(summary.gst)}</dd>
                  <dt className="grand">Total due</dt>
                  <dd className="grand">{$(summary.total)}</dd>
                </dl>
              </div>
            )}
          </section>

          {billable.length > 0 && (
            <div className="actions no-print">
              <button onClick={() => window.print()}>Print / save PDF</button>
              <button className="ghost" onClick={exportCsv}>
                Export CSV
              </button>
              <span className="spacer" />
              <button className="ghost" onClick={markInvoiced}>
                Mark as invoiced
              </button>
            </div>
          )}
        </>
      )}

      {editing && (
        <ReceiptEditor
          receipt={editing}
          region={business.region}
          clients={clients}
          onSave={async (r) => {
            await save(r)
            setEditing(null)
          }}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
