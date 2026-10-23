// Receipts are kept in the browser's IndexedDB so photos don't hit
// localStorage's ~5MB limit. Nothing leaves the device.

export interface Receipt {
  id: string
  createdAt: string
  date: string // ISO yyyy-mm-dd
  merchant: string
  description: string
  category: string
  client: string
  total: number // GST-inclusive
  gst: number
  billable: boolean
  invoiced: boolean
  image?: string // downscaled JPEG data URL
  ocrText?: string
}

const DB_NAME = 'small-business-partner'
const STORE = 'receipts'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const receiptStore = {
  all: () => tx<Receipt[]>('readonly', (s) => s.getAll() as IDBRequest<Receipt[]>),
  put: (r: Receipt) => tx('readwrite', (s) => s.put(r)),
  remove: (id: string) => tx('readwrite', (s) => s.delete(id)),
}

/** Small JSON settings (business details, calculator inputs) live in localStorage. */
export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked — settings just won't persist.
  }
}
