"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { Plus, RefreshCw, FileText, Search, User, Calendar, Stethoscope, ChevronDown, ChevronUp } from 'lucide-react'
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
    <Card className="bg-card border-border overflow-hidden">
      <div className="bg-gradient-to-r from-green-500/5 via-green-500/3 to-transparent p-6 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground leading-tight">Recent Diagnoses</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Latest clinical records and observations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => loadDiagnoses()} disabled={loading} aria-label="Refresh diagnoses" className="shadow-sm hover:shadow-md transition-shadow">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={() => setAddDiagOpen(true)} className="flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Diagnosis</span>
            </Button>
          </div>
        </div>
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by patient, diagnosis, or ICD code..." 
            value={query} 
            onChange={e => setQuery(e.target.value)}
            className="pl-10 bg-background/50 backdrop-blur-sm border-border/60 focus:border-primary/50 transition-colors"
          />
        </div>
      </div>

      <div className="p-6">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading diagnoses...</span>
            </div>
          </div>
        )}
        
        {error && (
          <div className="flex items-center justify-center py-8">
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <Stethoscope className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {query ? 'No matching diagnoses' : 'No diagnoses yet'}
            </p>
            <p className="text-xs text-muted-foreground">
              {query ? 'Try adjusting your search criteria' : 'Add a diagnosis to get started'}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {displayList.map(d => {
            const diagnosisText = d.disease && d.icd11 
              ? `${d.disease} (${d.icd11})`
              : d.disease || d.icd11 || '—'
            
            return (
              <div 
                key={d.id} 
                className="group p-3 border border-border rounded-lg bg-gradient-to-br from-card via-card to-muted/20 hover:shadow-lg hover:border-green-500/30 transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {d.patientName || `Patient ${d.patientId.slice(0, 8)}`}
                      </p>
                      {d.icd11 && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs bg-green-500/10 text-green-600 font-medium flex-shrink-0">
                          ICD-11
                        </span>
                      )}
                    </div>
                    <div className="flex items-start gap-1.5 mb-1">
                      <Stethoscope className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground break-words">
                        {diagnosisText}
                      </p>
                    </div>
                    {d.notes && (
                      <div className="mt-2 p-2 rounded-md bg-muted/50 border border-border/50">
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                          {d.notes}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
                    <Calendar className="h-3 w-3" />
                    <span className="hidden sm:inline">
                      {d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '—'}
                    </span>
                    <span className="sm:hidden">
                      {d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      }) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {filtered.length > 3 && (
          <div className="mt-6 flex justify-center">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowAll(s => !s)}
              className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all"
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  View {filtered.length - 3} More
                </>
              )}
            </Button>
          </div>
        )}
      </div>
      
      <AddDiagnosisModal open={addDiagOpen} onClose={() => setAddDiagOpen(false)} onAdded={() => { setAddDiagOpen(false); loadDiagnoses() }} />
    </Card>
  )
}
