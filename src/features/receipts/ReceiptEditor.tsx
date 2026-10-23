import { useState } from 'react'
import type { Receipt } from '../../lib/storage'
import { RULES, gstFromInclusive, type Region } from '../../lib/tax'
import { round2 } from '../../lib/format'
import { CATEGORIES } from './settings'

interface Props {
  receipt: Receipt
  region: Region
  clients: string[]
  onSave: (r: Receipt) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function ReceiptEditor({ receipt, region, clients, onSave, onDelete, onClose }: Props) {
  const [r, setR] = useState(receipt)
  const [showText, setShowText] = useState(false)
  const set = <K extends keyof Receipt>(k: K, v: Receipt[K]) => setR((x) => ({ ...x, [k]: v }))
  const rate = RULES[region].gstRate

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Edit receipt" onClick={(e) => e.stopPropagation()}>
        <div className="modal-body">
          {r.image && (
            <a className="receipt-image" href={r.image} target="_blank" rel="noreferrer">
              <img src={r.image} alt="Receipt" />
            </a>
          )}
          <form
            className="fields"
            onSubmit={(e) => {
              e.preventDefault()
              onSave(r)
            }}
          >
            <div className="row">
              <label>
                Date
                <input type="date" value={r.date} onChange={(e) => set('date', e.target.value)} required />
              </label>
              <label>
                Category
                <select value={r.category} onChange={(e) => set('category', e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Supplier
              <input value={r.merchant} onChange={(e) => set('merchant', e.target.value)} />
            </label>
            <label>
              Description
              <input
                value={r.description}
                placeholder="What was it for?"
                onChange={(e) => set('description', e.target.value)}
              />
            </label>
            <label>
              Client / job
              <input
                list="client-list"
                value={r.client}
                placeholder="Who should this be billed to?"
                onChange={(e) => set('client', e.target.value)}
              />
              <datalist id="client-list">
                {clients.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <div className="row">
              <label>
                Total paid (incl. GST)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={r.total || ''}
                  onChange={(e) => set('total', parseFloat(e.target.value) || 0)}
                />
              </label>
              <label>
                GST
                <span className="input-with-action">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={r.gst || ''}
                    onChange={(e) => set('gst', parseFloat(e.target.value) || 0)}
                  />
                  <button
                    type="button"
                    className="ghost small"
                    title={`Calculate ${rate * 100}% GST from total`}
                    onClick={() => set('gst', round2(gstFromInclusive(r.total, rate)))}
                  >
                    Calc
                  </button>
                </span>
              </label>
            </div>
            <div className="row">
              <label className="check">
                <input type="checkbox" checked={r.billable} onChange={(e) => set('billable', e.target.checked)} />
                Billable to client
              </label>
              <label className="check">
                <input type="checkbox" checked={r.invoiced} onChange={(e) => set('invoiced', e.target.checked)} />
                Already invoiced
              </label>
            </div>
            {r.ocrText && (
              <div>
                <button type="button" className="link" onClick={() => setShowText((s) => !s)}>
                  {showText ? 'Hide' : 'Show'} scanned text
                </button>
                {showText && <pre className="ocr-text">{r.ocrText}</pre>}
              </div>
            )}
            <div className="actions">
              <button
                type="button"
                className="danger ghost"
                onClick={() => confirm('Delete this receipt?') && onDelete(r.id)}
              >
                Delete
              </button>
              <span className="spacer" />
              <button type="button" className="ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
