import { useEffect, useState } from 'react'

interface Props {
  onUse: (text: string) => void
  onClose: () => void
}

export function PasteDialog({ onUse, onClose }: Props) {
  const [text, setText] = useState('')
  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form
        className="sheet"
        role="dialog"
        aria-label="Paste emailed receipt"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          onUse(text)
        }}
      >
        <header className="sheet-head">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <h3>Emailed receipt</h3>
          <button type="submit" disabled={!text.trim()}>
            Next
          </button>
        </header>
        <div className="sheet-body">
          <p className="muted small">
            Open the receipt email, select all the text and copy it, then paste it below. If the receipt is a PDF
            attachment, save it to your phone (Share → Save to Files) and use <strong>Photo or PDF</strong> instead.
          </p>
          <textarea
            autoFocus
            rows={12}
            placeholder="Paste the receipt email here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {'clipboard' in navigator && 'readText' in navigator.clipboard && (
            <button
              type="button"
              className="ghost block"
              onClick={() =>
                navigator.clipboard
                  .readText()
                  .then(setText)
                  .catch(() => alert('Couldn’t read the clipboard — long-press the box and choose Paste.'))
              }
            >
              Paste from clipboard
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
