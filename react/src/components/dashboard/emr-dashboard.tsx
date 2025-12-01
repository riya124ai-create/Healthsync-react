"use client"
import { Plus } from "lucide-react"
import { Card } from "@/components/ui/card"
// import StatCard from "./stat-card"
import RecentPatients from "./recent-patients"
import IntegrationStatus from "./integration-status"
import OrgDoctorsPanel from "./OrgDoctorsPanel"
import { Button } from "../ui/button"
import NewPatientModal from "./NewPatientModal"
import AddDiagnosisModal from "./AddDiagnosisModal"
import ReportsModal from "./ReportsModal"
import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth"

export default function EMRDashboard() {
  const { user, authFetch } = useAuth()
  const [open, setOpen] = useState(false)
  const [addDiagOpen, setAddDiagOpen] = useState(false)
  const [viewReports, setViewReports] = useState(false)

  const [orgPatients, setOrgPatients] = useState<Array<{ id: string; name?: string; age?: number; createdAt?: string; createdBy?: string }>>([])
  const [latestByPatient, setLatestByPatient] = useState<Record<string, { id?: string; patientId?: string; icd11?: string | null; disease?: string | null; createdAt?: string | null } | null>>({})
  const [doctorMap, setDoctorMap] = useState<Record<string, { name?: string; email?: string }>>({})
  const [patientSearch, setPatientSearch] = useState('')
  const [showAllPatients, setShowAllPatients] = useState(false)
  const [doctorList, setDoctorList] = useState<Array<{ id: string; name?: string; email?: string }>>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignPatient, setAssignPatient] = useState<{ id: string; name?: string } | null>(null)
  const [assignDoctorId, setAssignDoctorId] = useState<string | undefined>(undefined)
  const [assigning, setAssigning] = useState(false)

  const role = user?.role || 'doctor'

  // drag ele helper
  function createDragPreview(name?: string, meta?: string) {
    const box = document.createElement('div')
    box.style.position = 'absolute'
    box.style.top = '-9999px'
    box.style.left = '-9999px'
    box.style.zIndex = '999999'
    box.style.padding = '8px 12px'
    box.style.borderRadius = '8px'
    box.style.boxShadow = '0 6px 18px rgba(0,0,0,0.18)'
    box.style.background = 'linear-gradient(180deg, #ffffff, #fbfbfb)'
    box.style.color = '#111827'
    box.style.display = 'flex'
    box.style.alignItems = 'center'
    box.style.gap = '10px'

    const avatar = document.createElement('div')
    avatar.style.width = '40px'
    avatar.style.height = '40px'
    avatar.style.borderRadius = '8px'
    avatar.style.background = 'linear-gradient(135deg,#eef2ff,#e6f0ff)'
    avatar.style.display = 'flex'
    avatar.style.alignItems = 'center'
    avatar.style.justifyContent = 'center'
    avatar.style.fontWeight = '600'
    avatar.style.color = '#4338ca'
    avatar.textContent = (name || '').slice(0,2).toUpperCase()

    const text = document.createElement('div')
    text.style.display = 'flex'
    text.style.flexDirection = 'column'
    text.style.minWidth = '120px'
    const title = document.createElement('div')
    title.style.fontSize = '13px'
    title.style.fontWeight = '600'
    title.textContent = name || 'Patient'
    const sub = document.createElement('div')
    sub.style.fontSize = '12px'
    sub.style.color = '#6b7280'
    sub.textContent = meta || ''

    text.appendChild(title)
    text.appendChild(sub)
    box.appendChild(avatar)
    box.appendChild(text)
    document.body.appendChild(box)
    return box
  }

  // Doctor view (default)
  const DoctorView = (
    <>
      <div className=" space-y-6">
        <div>
          {/* Top 3 recent patients on large screens */}
          <div className="hidden lg:flex items-start gap-4 mb-4">
            {orgPatients
              .slice()
              .sort((a, b) => {
                const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
                const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
                return tb - ta
              })
              .slice(0, 3)
              .map(p => (
                <div key={p.id} className="min-w-[260px] border border-border rounded-lg p-4 bg-card">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-sm">{(p.name || p.id || '').slice(0,2).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{p.name || p.id}</div>
                      <div className="text-xs text-muted-foreground">{p.age ?? '—'} years · {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}</div>
                      <div className="text-xs text-muted-foreground mt-2">{p.createdBy ? (doctorMap[p.createdBy]?.name || doctorMap[p.createdBy]?.email || p.createdBy) : 'Unassigned'}</div>
                    </div>
                    <div>
                      <button className="px-2 py-1 rounded-md bg-primary text-primary-foreground text-sm" onClick={() => { setAssignPatient({ id: p.id, name: p.name }); setAssignDoctorId(p.createdBy); setAssignOpen(true) }}>Assign</button>
                    </div>
                  </div>
                </div>
              ))}
            {/* <div className="flex items-center">
              <button className="px-4 py-2 rounded-md border border-border bg-card" onClick={() => { setShowAllPatients(true); window.setTimeout(() => { const el = document.getElementById('org-patients-table'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 100) }}>See all patients</button>
            </div> */}
          </div>
          <h1 className="text-3xl font-bold text-foreground">EMR Dashboard</h1>
          <p className="text-muted-foreground mt-1">Electronic Medical Records with Traditional Medicine Integration</p>
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <RecentPatients />
            <IntegrationStatus />
          </div>

          <div className="space-y-6">

            <Card className="bg-card border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center" onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">New Patient Record</span>
                </Button>
                <Button className="w-full px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors flex items-center justify-center" onClick={() => setAddDiagOpen(true)}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Add Diagnosis</span>
                </Button>
                <AddDiagnosisModal open={addDiagOpen} onClose={() => setAddDiagOpen(false)} onAdded={() => setAddDiagOpen(false)} onRequestNewPatient={() => { setAddDiagOpen(false); setOpen(true); }} />
                <button className="w-full px-4 py-2 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-card transition-colors" onClick={() => setViewReports(true)}>
                  View Reports
                </button>
                <ReportsModal open={viewReports} onClose={() => setViewReports(false)} />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  )

  // Organization view: list doctors and their details
  type UserProfile = { organizationId?: string | null } | undefined
  const orgId = (user?.profile as UserProfile)?.organizationId ?? null
  async function loadOrgData() {
    if (!orgId) return
    try {
      const res = await authFetch(`/api/organizations/${orgId}/doctors`)
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      const docs = data.doctors || []
      const patients: Array<{ id: string; name?: string; age?: number; createdAt?: string; createdBy?: string }> = []
      const map: Record<string, { name?: string; email?: string }> = {}
      const list: Array<{ id: string; name?: string; email?: string }> = []
      for (const d of docs) {
        map[d.id] = { name: d.profile?.name, email: d.email }
        list.push({ id: d.id, name: d.profile?.name, email: d.email })
        if (Array.isArray(d.patients)) {
          for (const p of d.patients) {
            const rec = p as Record<string, unknown>
            patients.push({ id: String(rec.id || rec._id || ''), name: rec.name ? String(rec.name) : undefined, age: typeof rec.age === 'number' ? (rec.age as number) : (rec.age ? Number(rec.age as unknown) : undefined), createdAt: rec.createdAt ? String(rec.createdAt) : undefined, createdBy: d.id })
          }
        }
      }
      try {
        const u = await authFetch(`/api/organizations/${orgId}/unassigned`)
        if (u.ok) {
          const ud = await u.json()
          for (const p of ud.patients || []) {
            const rec = p as Record<string, unknown>
            patients.push({ id: String(rec.id || rec._id || ''), name: rec.name ? String(rec.name) : undefined, age: typeof rec.age === 'number' ? (rec.age as number) : (rec.age ? Number(rec.age as unknown) : undefined), createdAt: rec.createdAt ? String(rec.createdAt) : undefined, createdBy: rec.createdBy ? String(rec.createdBy) : undefined })
          }
        }
      } catch (e) { console.warn('failed to load unassigned patients', e) }
      setDoctorMap(map)
      setDoctorList(list)
      setOrgPatients(patients)
      // Load latest diagnoses for organization patients and map by patient id
        // Build latest diagnosis map from the doctors payload we already received.
        // The organizations route includes a `diagnoses` array per doctor (diagnoses authored by that doctor across patients).
        try {
          const map: Record<string, any> = {}
          for (const p of patients) map[String(p.id)] = null

          for (const d of docs) {
            const diagList = Array.isArray(d.diagnoses) ? d.diagnoses : []
            for (const diag of diagList) {
              const pid = String(diag.patientId || diag.patient_id || (diag.patient && (diag.patient.id || diag.patient._id)) || '')
              if (!pid) continue
              const cur = map[pid]
              const dCreated = diag.createdAt ? new Date(diag.createdAt) : null
              const curCreated = cur && cur.createdAt ? new Date(cur.createdAt) : null
              if (!cur || (dCreated && (!curCreated || dCreated > curCreated))) {
                map[pid] = diag
              }
            }
          }
          setLatestByPatient(map)
        } catch (e) {
          console.debug('failed to map org diagnoses', e)
          setLatestByPatient({})
        }
    } catch (err) {
      console.error('load org patients', err)
    }
  }

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    ;(async () => {
      if (cancelled) return
      await loadOrgData()
    })()
    return () => { cancelled = true }
  }, [orgId, authFetch])

  useEffect(() => {
    function onAssigned(e: Event) {
      try {
        const ce = e as CustomEvent<{ patientId: string; doctorId: string }>
        const { patientId, doctorId } = ce.detail || {}
        if (!patientId) return
        setOrgPatients((prev) => prev.map(p => p.id === patientId ? { ...p, createdBy: doctorId } : p))
      } catch (err) {
        console.debug('orgPatientAssigned handler error', err)
      }
    }
    window.addEventListener('orgPatientAssigned', onAssigned as EventListener)
    return () => { window.removeEventListener('orgPatientAssigned', onAssigned as EventListener) }
  }, [])
  const OrgView = (
    <>
      <div className=" space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Organization Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview across your organization</p>
        </div>

        <div>
          <Card className="bg-card border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold leading-tight">Organization Patients</h3>
              <Button
                size="sm"
                onClick={() => { setOpen(true); setShowAllPatients(true) }}
                title="Create new patient"
                className="flex items-center gap-2 px-3 py-1.5 rounded-md shadow-sm hover:shadow-md transition-shadow"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Patient</span>
              </Button>
            </div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex-1">
                <input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder="Search patients by name, id, or doctor" className="w-full px-3 py-2 rounded-md border border-border bg-input text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-2 rounded-md border border-border bg-card" onClick={() => { setShowAllPatients(s => !s) }}>{showAllPatients ? 'Hide table' : 'Show table'}</button>
              </div>
            </div>
            <NewPatientModal open={open} onClose={() => setOpen(false)} orgId={orgId} onCreated={async () => { await loadOrgData(); setShowAllPatients(true) }} />
            <div id="org-patients-table" className={`overflow-auto ${showAllPatients ? 'block' : 'hidden'}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 px-2">Patient</th>
                    <th className="py-2 px-2">Age</th>
                    <th className="py-2 px-2">Assigned To</th>
                    <th className="py-2 px-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {orgPatients
                    .filter(pp => {
                      if (!patientSearch) return true
                      const q = patientSearch.trim().toLowerCase()
                      const doctorName = pp.createdBy ? (doctorMap[pp.createdBy]?.name || doctorMap[pp.createdBy]?.email || pp.createdBy) : ''
                      return (pp.name || '').toLowerCase().includes(q) || (pp.id || '').toLowerCase().includes(q) || doctorName.toLowerCase().includes(q)
                    })
                    .map(p => (
                    <tr
                      key={p.id}
                      className="border-t hover:bg-accent/5 cursor-grab"
                      draggable
                      onDragStart={(e) => {
                        try {
                          const preview = createDragPreview(p.name || p.id, p.age ? `Age: ${p.age}` : '')
                          const el = (e.currentTarget as HTMLElement & { __dragPreview?: HTMLElement })
                          el.__dragPreview = preview
                          try { e.dataTransfer.setDragImage(preview, Math.floor(preview.offsetWidth / 2), Math.floor(preview.offsetHeight / 2)) } catch (err) { console.debug('setDragImage failed', err) }
                        } catch (err) { console.debug('createDragPreview failed', err) }
                        e.dataTransfer.setData('text/plain', JSON.stringify({ patientId: p.id, patientName: p.name || '', fromDoctorId: p.createdBy || null }));
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={(e) => {
                        try {
                          const el = (e.currentTarget as HTMLElement & { __dragPreview?: HTMLElement })
                          const prev = el.__dragPreview
                          if (prev && prev.parentNode) prev.parentNode.removeChild(prev)
                          el.__dragPreview = undefined
                        } catch (err) { console.debug('clean drag preview failed', err) }
                      }}
                    >
                      <td className="py-2 px-2 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-sm">{(p.name || p.id || '').slice(0,2).toUpperCase()}</div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{p.name || p.id}</div>
                          <div className="text-xs text-muted-foreground truncate">{
                            // Prefer latest diagnosis -> patient.disease -> placeholder
                            (latestByPatient[p.id] && (latestByPatient[p.id]?.disease || latestByPatient[p.id]?.icd11))
                              ? `${latestByPatient[p.id]?.disease ? latestByPatient[p.id]?.disease : ''}${latestByPatient[p.id]?.icd11 ? ` (${latestByPatient[p.id]?.icd11})` : ''}`.trim()
                              : (p.hasOwnProperty('disease') && (p as any).disease ? (p as any).disease : '—')
                          }</div>
                        </div>
                      </td>
                      <td className="py-2 px-2">{p.age ?? '—'}</td>
                      <td className="py-2 px-2">{p.createdBy ? (doctorMap[p.createdBy]?.name || doctorMap[p.createdBy]?.email || p.createdBy) : 'Unassigned'}</td>
                      <td className="py-2 px-2">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}</td>
                      <td className="py-2 px-2 text-right">
                        <button className="px-2 py-1 text-sm rounded-md border border-border bg-card" onClick={() => { setAssignPatient({ id: p.id, name: p.name }); setAssignDoctorId(p.createdBy); setAssignOpen(true) }}>Assign</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <OrgDoctorsPanel orgId={orgId} />
          </div>
        </div>
        {assignOpen && assignPatient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => { setAssignOpen(false); setAssignPatient(null); setAssignDoctorId(undefined) }} />
            <div className="relative w-full max-w-md mx-4 bg-card border-border rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Assign Patient</h3>
              <div className="text-sm text-muted-foreground mb-4">Assign <span className="font-medium">{assignPatient.name || assignPatient.id}</span> to a doctor</div>
              <div className="space-y-3">
                <label className="block text-sm mb-1">Doctor</label>
                <select value={assignDoctorId ?? ''} onChange={(e) => setAssignDoctorId(e.target.value || undefined)} className="w-full px-3 py-2 rounded-md border border-border bg-input">
                  <option value="">Select a doctor</option>
                  {doctorList.map(d => (
                    <option key={d.id} value={d.id}>{d.name || d.email || d.id}</option>
                  ))}
                </select>
                <div className="flex items-center justify-end gap-2">
                  <button type="button" className="px-3 py-2 border border-border rounded-md" onClick={() => { setAssignOpen(false); setAssignPatient(null); setAssignDoctorId(undefined) }}>Cancel</button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-md bg-primary text-primary-foreground"
                    onClick={async () => {
                      if (!assignPatient) return
                      if (!assignDoctorId) { alert('Please select a doctor'); return }
                      setAssigning(true)
                      try {
                        const res = await authFetch(`/api/organizations/${orgId}/patients/${assignPatient.id}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctorId: assignDoctorId }) })
                        if (!res.ok) {
                          const txt = await res.text().catch(() => '')
                          throw new Error(txt || 'Assign failed')
                        }
                        // update local table immediately
                        setOrgPatients(prev => prev.map(p => p.id === assignPatient.id ? { ...p, createdBy: assignDoctorId } : p))
                        // notify other listeners (keeps views in sync)
                        try { window.dispatchEvent(new CustomEvent('orgPatientAssigned', { detail: { patientId: assignPatient.id, doctorId: assignDoctorId } })) } catch (e) { console.debug(e) }
                        setAssignOpen(false)
                        setAssignPatient(null)
                        setAssignDoctorId(undefined)
                      } catch (err) {
                        alert(err instanceof Error ? err.message : String(err))
                      } finally { setAssigning(false) }
                    }}
                    disabled={assigning}
                  >{assigning ? 'Assigning…' : 'Assign'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )

  return role === 'organization' ? OrgView : DoctorView
}

