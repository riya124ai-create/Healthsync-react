"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { Plus, RefreshCw } from 'lucide-react'
import AddDiagnosisModal from "./AddDiagnosisModal"

type Diagnosis = {
  patientId: string
  patientName: string
  id: string
  icd11?: string | null
  disease?: string | null
  notes?: string | null
  createdAt?: string | null
}

export default function IntegrationStatus() {
  const { authFetch } = useAuth()
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  const [addDiagOpen, setAddDiagOpen] = useState(false)

  async function loadDiagnoses() {
    let cancelled = false
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/patients/diagnoses')
      if (!res.ok) throw new Error('failed to fetch diagnoses')
      const body = await res.json()
      const list: Diagnosis[] = Array.isArray(body.diagnoses) ? body.diagnoses.map((d: any) => ({
        patientId: String(d.patientId || ''),
        patientName: String(d.patientName || ''),
        id: String(d.id || ''),
        icd11: d.icd11 || null,
        disease: d.disease || null,
        notes: d.notes || null,
        createdAt: d.createdAt || null,
      })) : []
      if (!cancelled) setDiagnoses(list)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!cancelled) setError(msg || 'error')
    } finally {
      if (!cancelled) setLoading(false)
    }
  }

  useEffect(() => { loadDiagnoses() }, [authFetch])

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase()
    if (!q) return diagnoses
    return diagnoses.filter(d => ((d.patientName || '').toLowerCase().includes(q) || (d.disease || '').toLowerCase().includes(q) || (d.notes || '').toLowerCase().includes(q) || (d.icd11 || '').toLowerCase().includes(q)))
  }, [diagnoses, query])

  const [showAll, setShowAll] = useState(false)
  const displayList = showAll ? filtered : filtered.slice(0, 3)

  return (
    <Card className="bg-card border-border p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground leading-tight">Recent Diagnoses</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => loadDiagnoses()} disabled={loading} aria-label="Refresh diagnoses">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={() => setAddDiagOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New diagnosis</span>
            </Button>
          </div>
        </div>
        <div className="mt-3">
          <Input placeholder="Search by name, diagnosis or ICD" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && <div className="text-sm text-destructive">{error}</div>}

      {!loading && filtered.length === 0 && (
        <div className="text-sm text-muted-foreground">No diagnoses found.</div>
      )}

      <div className="space-y-3">
        {displayList.map(d => (
          <div key={d.id} className="p-3 border border-border rounded-md">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">{d.patientName || d.patientId}</div>
                <div className="text-xs text-muted-foreground">{d.disease || d.icd11 || '—'}</div>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                {d.createdAt ? new Date(d.createdAt).toLocaleString() : ''}
              </div>
            </div>
            {d.notes && <div className="mt-2 text-sm text-muted-foreground">{d.notes}</div>}
          </div>
        ))}
      </div>

      {filtered.length > 3 && (
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => setShowAll(s => !s)}>
            {showAll ? 'Show less' : `View more (${filtered.length - 3})`}
          </Button>
        </div>
      )}
      <AddDiagnosisModal open={addDiagOpen} onClose={() => setAddDiagOpen(false)} onAdded={() => { setAddDiagOpen(false); loadDiagnoses() }} />
    </Card>
  )
}
