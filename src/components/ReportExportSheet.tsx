import { Download, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'
import { useDragClose } from '../hooks/useDragClose'
import type { Tx } from '../lib/types'
import { createReportCsv } from '../lib/reportCsv'

export function ReportExportSheet({ label, filename, transactions, symbol, onClose }: {
  label: string
  filename: string
  transactions: Tx[]
  symbol: string
  onClose: () => void
}) {
  const [prepared, setPrepared] = useState<{ transactions: Tx[]; label: string; filename: string; symbol: string; file?: File; error?: string }>()
  const current = prepared?.transactions === transactions && prepared.label === label && prepared.filename === filename && prepared.symbol === symbol ? prepared : undefined
  const file = current?.file
  const error = current?.error
  const drag = useDragClose(onClose)
  const closeRef = useRef<HTMLButtonElement>(null)
  const busyRef = useRef(false)

  useEffect(() => {
    let active = true
    void import('../lib/reportPdf').then(({ createReportPdf }) => createReportPdf(label, filename, transactions, symbol))
      .then((ready) => { if (active) setPrepared({ transactions, label, filename, symbol, file: ready }) })
      .catch(() => { if (active) setPrepared({ transactions, label, filename, symbol, error: 'Could not prepare the PDF. Close and try again.' }) })
    return () => { active = false }
  }, [label, filename, transactions, symbol])


  function download(ready: File) {
    if (busyRef.current) return
    busyRef.current = true
    const url = URL.createObjectURL(ready)
    const link = document.createElement('a')
    link.href = url
    link.download = ready.name
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    onClose()
  }

  return (
    <Modal onDismiss={onClose} style={drag.style} className="report-export-sheet" aria-labelledby="report-export-title">
        <div className="modal-handle" {...drag.handlers}>
          <div className="grab" aria-hidden />
          <div className="report-export-head"><h2 id="report-export-title">Export {label}</h2><button ref={closeRef} aria-label="Close export options" onClick={onClose}><X size={20} /></button></div>
        </div>
        {error && <div className="warn" role="alert">{error}</div>}
        {!file && !error && <div className="muted report-export-wait" role="status">Preparing PDF…</div>}
        <div className="card report-export-options">
          <button onClick={() => file && download(file)} disabled={!file}><Download size={22} /><span><strong>Download PDF</strong><small>Save a copy on this device</small></span></button>
          <button onClick={() => download(createReportCsv(filename.replace(/\.pdf$/i, '.csv'), transactions, symbol))}><Download size={22} /><span><strong>Download CSV</strong><small>Open in Excel or another spreadsheet app</small></span></button>
        </div>
    </Modal>
  )
}
