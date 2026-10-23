import type { Worker } from 'tesseract.js'

let worker: Promise<Worker> | null = null

/** Lazily load Tesseract (it's large) and reuse one worker for every scan. */
function getWorker(): Promise<Worker> {
  // Assets are self-hosted in public/ocr (see scripts/copy-ocr-assets.mjs).
  const base = `${import.meta.env.BASE_URL}ocr`
  worker ??= import('tesseract.js')
    .then(({ createWorker }) =>
      createWorker('eng', undefined, {
        workerPath: `${base}/worker.min.js`,
        corePath: base,
        langPath: base,
      }),
    )
    .catch((err) => {
      worker = null // allow a retry on the next scan
      throw err
    })
  return worker
}

export async function recognise(image: Blob | string): Promise<string> {
  const w = await getWorker()
  const { data } = await w.recognize(image)
  return data.text
}

/** Downscale a photo so stored receipts stay small but legible. */
export function downscale(file: Blob, maxSide = 1600, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    img.src = url
  })
}
