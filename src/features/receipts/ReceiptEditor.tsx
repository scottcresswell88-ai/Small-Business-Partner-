import { useEffect, useMemo, useState } from 'react'
import type { Receipt } from '../../lib/storage'
import { gstFromInclusive } from '../../lib/tax'
import { round2 } from '../../lib/format'
import { CATEGORIES } from './settings'

interface Props {
  receipt: Receipt
  gstRate: number
  clients: string[]
  isNew: boolean
  onSave: (r: Receipt) => void
  onDelete: (id: string) => void
  onClose: () => void
}

type GstMode = 'auto' | 'custom' | 'none'

function initialGstMode(r: Receipt, auto: number): GstMode {
  if (r.total === 0 || Math.abs(r.gst - auto) < 0.015) return 'auto'
  if (r.gst > 0) return 'custom'
  // $0 GST read from a scanned receipt is taken as GST-free. Receipts saved before
  // GST was automatic (no source) may have been left at $0 by mistake, so recalculate.
  return r.source ? 'none' : 'auto'
}

export function ReceiptEditor({ receipt, gstRate, clients, isNew, onSave, onDelete, onClose }: Props) {
  const autoGst = (total: number) => round2(gstFromInclusive(total, gstRate))
  const [gstMode, setGstMode] = useState<GstMode>(() => initialGstMode(receipt, autoGst(receipt.total)))
  const [r, setR] = useState(() => (gstMode === 'auto' ? { ...receipt, gst: autoGst(receipt.total) } : receipt))
  const [showText, setShowText] = useState(false)
  const [showImage, setShowImage] = useState(false)
  const set = <K extends keyof Receipt>(k: K, v: Receipt[K]) => setR((x) => ({ ...x, [k]: v }))

  // In auto mode GST follows the total, so a hand-entered receipt can't end up with $0 GST.
  const setTotal = (total: number) =>
    setR((x) => ({ ...x, total, gst: gstMode === 'auto' ? autoGst(total) : gstMode === 'none' ? 0 : x.gst }))
  const chooseGst = (mode: GstMode) => {
    setGstMode(mode)
    if (mode === 'auto') set('gst', autoGst(r.total))
    if (mode === 'none') set('gst', 0)
  }

  const pdfUrl = useMemo(() => (r.pdf ? URL.createObjectURL(r.pdf) : null), [r.pdf])
  useEffect(() => () => void (pdfUrl && URL.revokeObjectURL(pdfUrl)), [pdfUrl])

  useEffect(() => {
    document.body.classList.add('modal-open')
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('modal-open')
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form
        className="sheet"
        role="dialog"
        aria-label={isNew ? 'New receipt' : 'Edit receipt'}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          onSave(r)
        }}
      >
        <header className="sheet-head">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <h3>{isNew ? 'Check receipt' : 'Edit receipt'}</h3>
          <button type="submit">Save</button>
        </header>

        <div className="sheet-body">
          {r.image && (
            <div className={`receipt-preview ${showImage ? 'open' : ''}`}>
              <button type="button" className="preview-toggle" onClick={() => setShowImage((s) => !s)}>
                <img src={r.image} alt="Receipt" />
              </button>
              <div className="preview-links">
                <button type="button" className="link" onClick={() => setShowImage((s) => !s)}>
                  {showImage ? 'Shrink' : 'Enlarge'}
                </button>
                {pdfUrl && (
                  <a className="link" href={pdfUrl} target="_blank" rel="noreferrer">
                    Open PDF
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="amount-row">
            <label className="amount">
              Total paid
              <span className="money-input">
                <span>$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={r.total || ''}
                  onChange={(e) => setTotal(parseFloat(e.target.value) || 0)}
                  required
                />
              </span>
            </label>
            <div className="gst-field">
              <span className="label">GST included</span>
              <div className="segmented small" role="group" aria-label="GST">
                <button type="button" className={gstMode === 'auto' ? 'active' : ''} onClick={() => chooseGst('auto')}>
                  {Math.round(gstRate * 100)}%
                </button>
                <button type="button" className={gstMode === 'custom' ? 'active' : ''} onClick={() => chooseGst('custom')}>
                  Other
                </button>
                <button type="button" className={gstMode === 'none' ? 'active' : ''} onClick={() => chooseGst('none')}>
                  None
                </button>
              </div>
              {gstMode === 'custom' ? (
                <span className="money-input compact">
                  <span>$</span>
                  <input
                    aria-label="GST amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={r.gst || ''}
                    onChange={(e) => set('gst', parseFloat(e.target.value) || 0)}
                  />
                </span>
              ) : (
                <span className="gst-value">${r.gst.toFixed(2)}</span>
              )}
            </div>
          </div>

          <label>
            Supplier
            <input value={r.merchant} placeholder="e.g. Bunnings" onChange={(e) => set('merchant', e.target.value)} />
          </label>
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
          {clients.length > 0 && (
            <div className="chips" aria-label="Recent clients">
              {clients.slice(0, 8).map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`chip ${r.client === c ? 'active' : ''}`}
                  onClick={() => set('client', c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <label>
            Description
            <input value={r.description} placeholder="What was it for?" onChange={(e) => set('description', e.target.value)} />
          </label>

          <div className="toggles">
            <label className="switch">
              <span>
                Bill to client
                <small>Include on the client’s expense invoice</small>
              </span>
              <input type="checkbox" checked={r.billable} onChange={(e) => set('billable', e.target.checked)} />
            </label>
            <label className="switch">
              <span>
                Already invoiced
                <small>Hide from future invoices</small>
              </span>
              <input type="checkbox" checked={r.invoiced} onChange={(e) => set('invoiced', e.target.checked)} />
            </label>
          </div>

          {r.ocrText && (
            <div>
              <button type="button" className="link" onClick={() => setShowText((s) => !s)}>
                {showText ? 'Hide' : 'Show'} text read from receipt
              </button>
              {showText && <pre className="ocr-text">{r.ocrText}</pre>}
            </div>
          )}

          {!isNew && (
            <button
              type="button"
              className="danger ghost block"
              onClick={() => confirm('Delete this receipt?') && onDelete(r.id)}
            >
              Delete receipt
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
