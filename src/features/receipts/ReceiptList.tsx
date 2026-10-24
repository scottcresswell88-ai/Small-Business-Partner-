import type { Receipt } from '../../lib/storage'
import { money } from '../../lib/format'

interface Props {
  receipts: Receipt[]
  currency: string
  onOpen: (r: Receipt) => void
}

const ICONS: Record<NonNullable<Receipt['source']>, string> = { photo: '🧾', pdf: '📄', text: '✉️', manual: '✏️' }

function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function ReceiptList({ receipts, currency, onOpen }: Props) {
  if (receipts.length === 0) {
    return (
      <section className="card empty">
        <span className="empty-icon" aria-hidden>
          🧾
        </span>
        <p>No receipts here yet.</p>
        <p className="muted small">Scan one, upload a photo or PDF, or paste the text from an emailed receipt.</p>
      </section>
    )
  }
  return (
    <ul className="receipt-list">
      {receipts.map((r) => (
        <li key={r.id}>
          <button className="receipt-item" onClick={() => onOpen(r)}>
            {r.image ? (
              <img className="thumb" src={r.image} alt="" />
            ) : (
              <span className="thumb" aria-hidden>
                {ICONS[r.source ?? 'manual']}
              </span>
            )}
            <span className="receipt-main">
              <strong>{r.merchant || 'Unknown supplier'}</strong>
              <span className="muted small">
                {shortDate(r.date)} · {r.client || 'No client'}
                {r.description && ` · ${r.description}`}
              </span>
            </span>
            <span className="receipt-side">
              <strong>{money(r.total, currency)}</strong>
              {r.invoiced ? (
                <span className="tag done">Invoiced</span>
              ) : r.billable ? (
                <span className="tag">Billable</span>
              ) : (
                <span className="tag muted">Own cost</span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
