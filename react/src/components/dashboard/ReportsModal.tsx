"use client"

import { useEffect, useState } from "react"
import { Button } from "../ui/button"
import { useAuth } from "@/lib/auth"

type Report = { id: string; patientId: string; patientName?: string; icd11?: string | null; disease?: string | null; notes?: string | null; createdAt?: string | null }

export default function ReportsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { authFetch } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function formatDateWithRelative(dateStr?: string | null) {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'

    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    const dateLabel = `${dd}-${mm}-${yyyy}`

    const msPerDay = 24 * 60 * 60 * 1000
    const today = new Date()
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const dateMid = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diffDays = Math.floor((todayMid.getTime() - dateMid.getTime()) / msPerDay)

    let relative = ''
    if (diffDays <= 0) relative = 'Today'
    else if (diffDays === 1) relative = 'Yesterday'
    else if (diffDays >= 2 && diffDays <= 6) relative = `${diffDays} Days`
    else if (diffDays >= 7 && diffDays < 30) {
      const weeks = Math.floor(diffDays / 7)
      relative = `${weeks} Week${weeks > 1 ? 's' : ''}`
    } else {
      const months = Math.floor(diffDays / 30)
      relative = `${months} Month${months > 1 ? 's' : ''}`
    }

    return `${dateLabel} (${relative})`
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await authFetch('/api/patients/diagnoses')
        if (!res.ok) throw new Error('failed to load reports')
        const data = await res.json()
        if (!cancelled) setReports(data.diagnoses || [])
      } catch (err) {
        console.error('load reports error', err)
        if (!cancelled) setReports([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, authFetch])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-card border border-border rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Diagnosis Reports</h3>
          <div>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>

        {loading && <div className="text-sm text-muted-foreground">Loading reports…</div>}
        {!loading && reports.length === 0 && <div className="text-sm text-muted-foreground">No reports found.</div>}

        <div className="space-y-3 max-h-96 overflow-auto">
          {reports.map(r => (
            <div key={r.id} className="p-3 border border-border rounded-md bg-background">
              <button type="button" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)} className="w-full text-left">
                <div className="cursor-pointer flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{r.patientName || r.patientId}</p>
                    <p className="text-xs text-muted-foreground">{r.disease ? `${r.disease} ${r.icd11 ? `(${r.icd11})` : ''}` : (r.icd11 || '—')}</p>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                      <div>{formatDateWithRelative(r.createdAt)}</div>
                  </div>
                </div>
              </button>
              {expandedId === r.id && (
                <div className="mt-2 text-sm text-foreground whitespace-pre-wrap">{r.notes || '—'}</div>
              )}
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  )
}
