import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export interface PdfReceipt {
  text: string
  /** First page rendered as a JPEG data URL, for the thumbnail and OCR fallback. */
  image: string
}

/**
 * Read a PDF receipt. Most emailed receipts are digital PDFs with real text,
 * which is far more accurate than OCR; scanned PDFs have no text and the caller
 * falls back to OCR on the rendered first page.
 */
export async function readPdf(file: Blob, maxSide = 1600): Promise<PdfReceipt> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  try {
    const doc = await task.promise
    let text = ''
    for (let n = 1; n <= Math.min(doc.numPages, 5); n++) {
      const content = await (await doc.getPage(n)).getTextContent()
      for (const item of content.items) {
        if ('str' in item) text += item.str + (item.hasEOL ? '\n' : ' ')
      }
      text += '\n'
    }

    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: maxSide / Math.max(base.width, base.height) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, viewport }).promise
    return { text, image: canvas.toDataURL('image/jpeg', 0.8) }
  } finally {
    await task.destroy()
  }
}
