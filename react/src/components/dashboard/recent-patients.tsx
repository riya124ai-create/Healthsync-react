"use client"
import { useEffect, useMemo, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MoreVertical, RefreshCw, Plus } from "lucide-react"
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
    <Card className="bg-card border-border p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground leading-tight">Recent Patients</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadPatients()} disabled={loading} aria-label="Refresh patients">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setNewPatientOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New patient</span>
          </Button>
          
        </div>
      </div>

      <div className="space-y-4">
        {/* {loading && <p className="text-sm text-muted-foreground">Loading patients…</p>} */}
        {!loading && myPatients.length === 0 && (
          <p className="text-sm text-muted-foreground">No patients yet.</p>
        )}

        {myPatients.map((patient) => (
          <div key={patient.id} className="p-0">
            <div className="flex items-center justify-between sm:hidden p-3 rounded-lg border border-border hover:bg-secondary/20 transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{patient.name || '—'}</p>
                <p className="text-xs text-muted-foreground truncate">{
                  // Prefer most recent diagnosis for this patient; fall back to patient.disease, then icd11
                  (latestByPatient[patient.id] && (latestByPatient[patient.id]!.disease || latestByPatient[patient.id]!.icd11))
                    ? `${latestByPatient[patient.id]!.disease ? latestByPatient[patient.id]!.disease : ''}${latestByPatient[patient.id]!.icd11 ? ` ${latestByPatient[patient.id]!.icd11}` : ''}`.trim()
                    : (patient.disease ? patient.disease : (patient.icd11 || '—'))
                }</p>
              </div>
              <div className="flex items-center gap-3 ml-3">
                <span className="text-xs text-muted-foreground">Age: {patient.age ?? '—'}</span>
                <Button variant="ghost" size="sm" onClick={() => setEditing(patient)}>
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="hidden sm:flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/20 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {patient.name ? patient.name.split(" ")[0][0] : "P"}
                      {patient.name && patient.name.split(" ")[1] ? patient.name.split(" ")[1][0] : ""}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{patient.name}</p>
                    <p className="text-xs text-muted-foreground">{
                      // Prefer most recent diagnosis
                      (latestByPatient[patient.id] && (latestByPatient[patient.id]!.disease || latestByPatient[patient.id]!.icd11))
                        ? `${latestByPatient[patient.id]!.disease ? latestByPatient[patient.id]!.disease : ''}${latestByPatient[patient.id]!.icd11 ? ` (${latestByPatient[patient.id]!.icd11})` : ''}`.trim()
                        : (patient.disease ? `${patient.disease}${patient.icd11 ? ` (${patient.icd11})` : ''}` : (patient.icd11 || "—"))
                    }</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Age: {patient.age ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{formatDateWithRelative(patient.createdAt)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditing(patient)}>
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        <EditPatientModal open={!!editing} onClose={() => setEditing(null)} patient={editing} onSaved={() => { setEditing(null); loadPatients() }} onRequestDelete={(p) => { setEditing(null); setDeleting(p) }} />
        <ConfirmDeleteModal open={!!deleting} onClose={() => setDeleting(null)} patient={deleting} onDeleted={() => { setDeleting(null); loadPatients() }} />
        <NewPatientModal open={newPatientOpen} onClose={() => setNewPatientOpen(false)} onCreated={() => { setNewPatientOpen(false); loadPatients() }} />
      </div>
    </Card>
  )
}
