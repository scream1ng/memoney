import { Download, Share2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useDragClose } from '../hooks/useDragClose'
import type { Tx } from '../lib/types'

export function ReportExportSheet({ label, filename, transactions, symbol, onClose }: {
  label: string
  filename: string
  transactions: Tx[]
  symbol: string
  onClose: () => void
}) {
  const [file, setFile] = useState<File>()
  const [error, setError] = useState('')
  const [sharing, setSharing] = useState(false)
  const drag = useDragClose(onClose, sharing)
  const closeRef = useRef<HTMLButtonElement>(null)
  const busyRef = useRef(false)
  const canShare = !!file && !!navigator.share && !!navigator.canShare?.({ files: [file] })

  useEffect(() => {
    let active = true
    void import('../lib/reportPdf').then(({ createReportPdf }) => createReportPdf(label, filename, transactions, symbol))
      .then((ready) => { if (active) setFile(ready) })
      .catch(() => { if (active) setError('Could not prepare the PDF. Close and try again.') })
    return () => { active = false }
  }, [label, filename, transactions, symbol])

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !sharing) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, sharing])

  async function share() {
    if (!file || !canShare || busyRef.current) return
    busyRef.current = true
    setSharing(true)
    setError('')
    try {
      await navigator.share({ files: [file], title: `MeMoney · ${label}` })
      onClose()
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) setError('Could not share the PDF. You can download it instead.')
    } finally { busyRef.current = false; setSharing(false) }
  }

  function download() {
    if (!file || busyRef.current) return
    busyRef.current = true
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    onClose()
  }

  return (
    <div className="report-export-wrap" onClick={() => { if (!sharing) onClose() }}>
      <section style={drag.style} className="report-export-sheet" role="dialog" aria-modal="true" aria-labelledby="report-export-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-handle" {...drag.handlers}>
          <div className="grab" aria-hidden />
          <div className="report-export-head"><h2 id="report-export-title">Export {label}</h2><button ref={closeRef} aria-label="Close export options" onClick={onClose} disabled={sharing}><X size={20} /></button></div>
        </div>
        {error && <div className="warn" role="alert">{error}</div>}
        {!file && !error && <div className="muted report-export-wait" role="status">Preparing PDF…</div>}
        {file && <div className="card report-export-options">
          {canShare && <button onClick={() => void share()} disabled={sharing}><Share2 size={22} /><span><strong>Share PDF</strong><small>Choose Mail, Files or another app</small></span></button>}
          <button onClick={download} disabled={sharing}><Download size={22} /><span><strong>Download PDF</strong><small>Save a copy on this device</small></span></button>
        </div>}
        {file && !canShare && <p className="muted report-export-hint">File sharing is unavailable here. Download the PDF to attach it in your email app.</p>}
      </section>
    </div>
  )
}
