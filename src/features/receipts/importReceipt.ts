import type { Receipt } from '../../lib/storage'
import { downscale, recognise } from '../../lib/ocr'
import { readPdf } from '../../lib/pdf'
import { parseReceipt } from '../../lib/receiptParser'
import { gstFromInclusive } from '../../lib/tax'
import { round2, todayIso } from '../../lib/format'

export function blankReceipt(client: string, source: Receipt['source'] = 'manual'): Receipt {
  return {
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
    source,
  }
}

/** Fill a receipt from extracted text. Missing GST is assumed to be the standard rate. */
export function fromText(text: string, base: Receipt, gstRate: number): Receipt {
  const parsed = parseReceipt(text)
  const total = parsed.total ?? 0
  return {
    ...base,
    date: parsed.date ?? base.date,
    merchant: parsed.merchant,
    total,
    gst: parsed.gst ?? round2(gstFromInclusive(total, gstRate)),
    ocrText: text,
  }
}

export async function importFile(file: File, client: string, gstRate: number): Promise<Receipt> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const { text, image } = await readPdf(file)
    // Scanned PDFs have no text layer, so read the rendered page instead.
    const usable = text.replace(/\s/g, '').length > 20 ? text : await recognise(image).catch(() => '')
    return { ...fromText(usable, blankReceipt(client, 'pdf'), gstRate), image, pdf: file }
  }
  const image = await downscale(file)
  const text = await recognise(image).catch((err) => {
    console.error('OCR failed', err)
    return ''
  })
  return { ...fromText(text, blankReceipt(client, 'photo'), gstRate), image }
}
