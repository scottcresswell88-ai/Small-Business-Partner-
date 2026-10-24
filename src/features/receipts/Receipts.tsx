import { useEffect, useMemo, useRef, useState } from 'react'
import { receiptStore, loadJson, saveJson, type Receipt } from '../../lib/storage'
import { RULES } from '../../lib/tax'
import { ReceiptEditor } from './ReceiptEditor'
import { ReceiptList } from './ReceiptList'
import { ExpenseInvoice } from './ExpenseInvoice'
import { PasteDialog } from './PasteDialog'
import { blankReceipt, fromText, importFile } from './importReceipt'
import { BUSINESS_DEFAULTS, type BusinessDetails } from './settings'

type View = 'receipts' | 'invoice'

const byDateDesc = (a: Receipt, b: Receipt) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)

export function Receipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [scanning, setScanning] = useState(0)
  const [editing, setEditing] = useState<{ receipt: Receipt; isNew: boolean } | null>(null)
  const [pasting, setPasting] = useState(false)
  const [view, setView] = useState<View>('receipts')
  const [business, setBusiness] = useState<BusinessDetails>(() => loadJson('business', BUSINESS_DEFAULTS))
  useEffect(() => saveJson('business', business), [business])

  // Filters
  const [client, setClient] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [onlyUninvoiced, setOnlyUninvoiced] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  const cameraInput = useRef<HTMLInputElement>(null)
  const uploadInput = useRef<HTMLInputElement>(null)
  const rules = RULES[business.region]
  const gstRate = business.gstRegistered ? rules.gstRate : 0

  useEffect(() => {
    receiptStore.all().then((all) => setReceipts(all.sort(byDateDesc)))
  }, [])

  const save = async (r: Receipt) => {
    await receiptStore.put(r)
    setReceipts((all) => [r, ...all.filter((x) => x.id !== r.id)].sort(byDateDesc))
  }

  const remove = async (id: string) => {
    await receiptStore.remove(id)
    setReceipts((all) => all.filter((x) => x.id !== id))
    setEditing(null)
  }

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const list = [...files]
    setScanning((n) => n + list.length)
    let last: Receipt | null = null
    for (const file of list) {
      try {
        last = await importFile(file, client, rules.gstRate)
        // A single receipt opens for checking before it's saved; batches save straight away.
        if (list.length > 1) await save(last)
      } catch (err) {
        alert(`Couldn't read ${file.name}: ${(err as Error).message}`)
      } finally {
        setScanning((n) => n - 1)
      }
    }
    if (last && list.length === 1) setEditing({ receipt: last, isNew: true })
  }

  const clients = useMemo(() => [...new Set(receipts.map((r) => r.client).filter(Boolean))].sort(), [receipts])

  const filtered = receipts.filter(
    (r) =>
      (!client || r.client === client) &&
      (!from || r.date >= from) &&
      (!to || r.date <= to) &&
      (!onlyUninvoiced || !r.invoiced),
  )
  const billable = filtered.filter((r) => r.billable)
  const activeFilters = [from, to].filter(Boolean).length + (onlyUninvoiced ? 0 : 1)

  const markInvoiced = async () => {
    if (!confirm(`Mark ${billable.length} expense(s) as invoiced?`)) return
    for (const r of billable) await save({ ...r, invoiced: true })
  }

  return (
    <div className="feature">
      <header className="feature-head no-print">
        <h2>Receipts</h2>
        <p className="muted">Capture receipts as you go, tag them to a client, and bill them back.</p>
      </header>

      <section className="capture no-print">
        <button className="capture-main" onClick={() => cameraInput.current?.click()}>
          <span className="capture-icon" aria-hidden>
            📷
          </span>
          <span>
            <strong>Scan receipt</strong>
            <small>Use your camera</small>
          </span>
        </button>
        <div className="capture-more">
          <button className="tile" onClick={() => uploadInput.current?.click()}>
            <span aria-hidden>📄</span>
            Photo or PDF
          </button>
          <button className="tile" onClick={() => setPasting(true)}>
            <span aria-hidden>✉️</span>
            Email text
          </button>
          <button className="tile" onClick={() => setEditing({ receipt: blankReceipt(client), isNew: true })}>
            <span aria-hidden>✏️</span>
            Type it in
          </button>
        </div>
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            importFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={uploadInput}
          type="file"
          accept="image/*,application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            importFiles(e.target.files)
            e.target.value = ''
          }}
        />
        {scanning > 0 && (
          <div className="scanning" role="status">
            <span className="spinner" /> Reading {scanning} receipt{scanning > 1 ? 's' : ''}…
          </div>
        )}
      </section>

      <div className="toolbar no-print">
        <div className="chips scroll" aria-label="Filter by client">
          <button className={`chip ${client === '' ? 'active' : ''}`} onClick={() => setClient('')}>
            All clients
          </button>
          {clients.map((c) => (
            <button key={c} className={`chip ${client === c ? 'active' : ''}`} onClick={() => setClient(c)}>
              {c}
            </button>
          ))}
        </div>
        <button
          className={`ghost icon-btn ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters((s) => !s)}
          aria-expanded={showFilters}
        >
          Filters{activeFilters > 0 && <span className="badge">{activeFilters}</span>}
        </button>
      </div>
      {showFilters && (
        <section className="card filters no-print">
          <div className="row">
            <label>
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <label className="switch">
            <span>Hide invoiced receipts</span>
            <input type="checkbox" checked={onlyUninvoiced} onChange={(e) => setOnlyUninvoiced(e.target.checked)} />
          </label>
          {(from || to) && (
            <button
              className="link"
              onClick={() => {
                setFrom('')
                setTo('')
              }}
            >
              Clear dates
            </button>
          )}
        </section>
      )}

      <div className="segmented no-print" role="tablist">
        <button role="tab" aria-selected={view === 'receipts'} className={view === 'receipts' ? 'active' : ''} onClick={() => setView('receipts')}>
          Receipts <span className="count">{filtered.length}</span>
        </button>
        <button role="tab" aria-selected={view === 'invoice'} className={view === 'invoice' ? 'active' : ''} onClick={() => setView('invoice')}>
          Invoice <span className="count">{billable.length}</span>
        </button>
      </div>

      {view === 'receipts' ? (
        <ReceiptList
          receipts={filtered}
          currency={rules.currency}
          onOpen={(r) => setEditing({ receipt: r, isNew: false })}
        />
      ) : (
        <ExpenseInvoice
          receipts={billable}
          business={business}
          setBusiness={setBusiness}
          client={client}
          from={from}
          to={to}
          gstRate={gstRate}
          onOpen={(r) => setEditing({ receipt: r, isNew: false })}
          onMarkInvoiced={markInvoiced}
        />
      )}

      {editing && (
        <ReceiptEditor
          receipt={editing.receipt}
          isNew={editing.isNew}
          gstRate={rules.gstRate}
          clients={clients}
          onSave={async (r) => {
            await save(r)
            setEditing(null)
          }}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      )}
      {pasting && (
        <PasteDialog
          onClose={() => setPasting(false)}
          onUse={(text) => {
            setPasting(false)
            setEditing({ receipt: fromText(text, blankReceipt(client, 'text'), rules.gstRate), isNew: true })
          }}
        />
      )}
    </div>
  )
}
