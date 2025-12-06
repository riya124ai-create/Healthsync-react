"use client"
import { useEffect, useMemo, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MoreVertical, RefreshCw, Plus, Activity, Calendar, User, Stethoscope } from "lucide-react"
import EditPatientModal from "./EditPatientModal"
import ConfirmDeleteModal from "./ConfirmDeleteModal"
import NewPatientModal from "./NewPatientModal"
import { useAuth } from "@/lib/auth"

type Patient = {
  id: string
  name: string
  age?: number
  icd11?: string
  disease?: string
  createdAt?: string
  createdBy?: string
}

type Diagnosis = { id: string; patientId?: string; icd11?: string | null; disease?: string | null; notes?: string | null; createdAt?: string | null }

type AuthUser = { id?: string; email?: string } | null

export default function RecentPatients() {
  function formatDateWithRelative(dateStr?: string | null) {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'

    // date label DD-MM-YYYY
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
  const { user, authFetch } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [latestByPatient, setLatestByPatient] = useState<Record<string, Diagnosis | null>>({})
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Patient | null>(null)
  const [deleting, setDeleting] = useState<Patient | null>(null)
  const [newPatientOpen, setNewPatientOpen] = useState(false)

  // load patients (can be triggered by refresh)
  const loadPatients = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const res = await authFetch("/api/patients", { signal })
      if (!res.ok) {
        console.error('failed to fetch patients', await res.text())
        setPatients([])
        return
      }
  const data = await res.json()
  const pts = data.patients || []
  setPatients(pts)

  // Fetch latest diagnoses for these patients and map them by patientId
  try {
    const dr = await authFetch('/api/patients/diagnoses')
    if (dr.ok) {
      const dd = await dr.json()
      console.log(dd);
      const diagnosesArr: Diagnosis[] = Array.isArray(dd) ? dd : (Array.isArray(dd.diagnoses) ? dd.diagnoses : (Array.isArray(dd.items) ? dd.items : []))
      const map: Record<string, Diagnosis | null> = {}
      // initialize with null (use string keys)
      for (const p of pts) map[String(p.id)] = null
      for (const d of diagnosesArr) {
        const pidRaw = d.patientId ?? (d as any).patient_id ?? (d as any).patient ?? ''
        const pid = String((pidRaw && (typeof pidRaw === 'object' ? (pidRaw.id ?? pidRaw._id ?? '') : pidRaw)) || '')
        if (!pid) continue
        const cur = map[pid]
        const dCreated = d.createdAt ? new Date(d.createdAt) : null
        const curCreated = cur && cur.createdAt ? new Date(cur.createdAt) : null
        if (!cur || (dCreated && (!curCreated || dCreated > curCreated))) {
          map[pid] = d
        }
      }
      setLatestByPatient(map)
    } else {
      setLatestByPatient({})
    }
  } catch (e) {
    console.debug('failed loading diagnoses for patients', e)
    setLatestByPatient({})
  }
    } catch (err) {
      const e = err as { name?: string }
      if (e?.name === 'AbortError') return
      console.error('patients fetch error', err)
      setPatients([])
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => {
    const controller = new AbortController()
    loadPatients(controller.signal)
    return () => controller.abort()
  }, [loadPatients])

  // const openOptions = () => {
  //   return(
  //     <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/20 transition-colors">
  //       H
  //     </div>
  //   )
  // }
  // const toggleOptions = () => {
    
  // }
  const myPatients = useMemo(() => {
    if (!user) return []
    const u = user as AuthUser
    const userEmail = u?.email
    const userId = u?.id
    return patients.filter(p => p.createdBy === userId || p.createdBy === userEmail)
  }, [patients, user])

  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent p-6 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground leading-tight">Recent Patients</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Your active patient records</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => loadPatients()} disabled={loading} aria-label="Refresh patients" className="shadow-sm hover:shadow-md transition-shadow">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={() => setNewPatientOpen(true)} className="flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Patient</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading patients...</span>
            </div>
          </div>
        )}
        
        {!loading && myPatients.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No patients yet</p>
            <p className="text-xs text-muted-foreground">Add your first patient to get started</p>
          </div>
        )}

        <div className="space-y-3">
          {myPatients.map((patient) => {
            const diagnosis = latestByPatient[patient.id]
            const hasDiagnosis = diagnosis && (diagnosis.disease || diagnosis.icd11)
            
            return (
              <div key={patient.id} className="group">
                {/* Mobile View */}
                <div className="sm:hidden p-3 rounded-lg border border-border bg-gradient-to-br from-card via-card to-muted/20 hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-sm font-bold text-primary">
                          {patient.name ? patient.name.split(" ")[0][0] : "P"}
                          {patient.name && patient.name.split(" ")[1] ? patient.name.split(" ")[1][0] : ""}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate mb-0.5">{patient.name || '—'}</p>
                        {hasDiagnosis ? (
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Stethoscope className="h-3 w-3 text-primary flex-shrink-0" />
                            <p className="text-xs text-muted-foreground truncate">
                              {diagnosis.disease || diagnosis.icd11}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mb-1.5">No diagnosis yet</p>
                        )}
                        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {patient.age ?? '—'} yrs
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDateWithRelative(patient.createdAt)?.split(' (')[0]}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(patient)} className="opacity-70 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Desktop View */}
                <div className="hidden sm:flex items-center justify-between p-3 rounded-lg border border-border bg-gradient-to-br from-card via-card to-muted/20 hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300">
                      <span className="text-sm font-bold text-primary">
                        {patient.name ? patient.name.split(" ")[0][0] : "P"}
                        {patient.name && patient.name.split(" ")[1] ? patient.name.split(" ")[1][0] : ""}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-foreground">{patient.name}</p>
                        {hasDiagnosis && (
                          <span className="px-1.5 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">
                            Diagnosed
                          </span>
                        )}
                      </div>
                      {hasDiagnosis ? (
                        <div className="flex items-center gap-1.5">
                          <Stethoscope className="h-3 w-3 text-primary flex-shrink-0" />
                          <p className="text-xs text-muted-foreground truncate">
                            {diagnosis.disease && diagnosis.icd11 
                              ? `${diagnosis.disease} (${diagnosis.icd11})`
                              : diagnosis.disease || diagnosis.icd11
                            }
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No diagnosis recorded</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-foreground font-medium">{patient.age ?? "—"}</span>
                        <span className="text-muted-foreground">years</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDateWithRelative(patient.createdAt)}</span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setEditing(patient)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>      <EditPatientModal open={!!editing} onClose={() => setEditing(null)} patient={editing} onSaved={() => { setEditing(null); loadPatients() }} onRequestDelete={(p) => { setEditing(null); setDeleting(p) }} />
      <ConfirmDeleteModal open={!!deleting} onClose={() => setDeleting(null)} patient={deleting} onDeleted={() => { setDeleting(null); loadPatients() }} />
      <NewPatientModal open={newPatientOpen} onClose={() => setNewPatientOpen(false)} onCreated={() => { setNewPatientOpen(false); loadPatients() }} />
      </div>
    </Card>
  )
}
