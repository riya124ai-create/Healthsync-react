"use client"
import { Plus, Users, UserCheck, UserX, Activity, Search, Calendar, RefreshCw, BarChart3 } from "lucide-react"
import { Card } from "@/components/ui/card"
// import StatCard from "./stat-card"
import RecentPatients from "./RecentPatients"
import IntegrationStatus from "./RecentDiagnosis"
import OrgDoctorsPanel from "./OrgDoctorsPanel"
import RecentlyAssignedPanel from "./RecentlyAssignedPanel"
import NewPatientModal from "./NewPatientModal"
import AddDiagnosisModal from "./AddDiagnosisModal"
import AnalyticsTab from "./AnalyticsTab"
// import ReportsModal from "./ReportsModal"
import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth"
import { useSocket } from "@/lib/socketContext"
import { Button } from "../ui/button"

export default function EMRDashboard() {
  const { user, authFetch } = useAuth()
  const [open, setOpen] = useState(false)
  const [addDiagOpen, setAddDiagOpen] = useState(false)
  const [selectedPatientForDiag, setSelectedPatientForDiag] = useState<string | undefined>(undefined)

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
  const [connectedDoctors, setConnectedDoctors] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview')

  const role = user?.role || 'doctor'
  const { socket } = useSocket()

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
          <h1 className="text-3xl font-bold text-foreground">EMR Dashboard</h1>
          <p className="text-muted-foreground mt-1">Electronic Medical Records with Traditional Medicine Integration</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <RecentPatients />
            <IntegrationStatus />
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <RecentlyAssignedPanel 
                onWriteDiagnosis={(patientId) => {
                  setSelectedPatientForDiag(patientId)
                  setAddDiagOpen(true)
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Add Diagnosis Modal */}
      <AddDiagnosisModal 
        open={addDiagOpen} 
        onClose={() => {
          setAddDiagOpen(false)
          setSelectedPatientForDiag(undefined)
        }} 
        onAdded={() => {
          setAddDiagOpen(false)
          setSelectedPatientForDiag(undefined)
        }}
        preSelectedPatientId={selectedPatientForDiag}
      />
    </>
  )

  type UserProfile = { organizationId?: string | null } | undefined
  const orgId = (user?.profile as UserProfile)?.organizationId ?? null
  
  useEffect(() => {
    if (!socket || role !== 'organization') {
      console.log('Socket not available or user is not organization:', { socket: !!socket, role })
      return
    }
    
    
    socket.emit('get:connected-users')

    const handleConnectedUsers = (data: { users: string[] }) => setConnectedDoctors(data.users || [])

    socket.on('connected:users', handleConnectedUsers)

    // Request updates periodically
    const interval = setInterval(() => {
      socket.emit('get:connected-users')
    }, 10000) // Every 10 seconds

    return () => {
      socket.off('connected:users', handleConnectedUsers)
      clearInterval(interval)
    }
  }, [socket, role])

  async function loadOrgData() {
    if (!orgId) return
    setLoading(true);
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
      // Load latest diagnosis for organization patients and map by patient id
        // Build latest diagnosis map from the doctors payload we already received.
        // The organizations route includes a `diagnosis` array per doctor (diagnosis authored by that doctor across patients).
        try {
          const map: Record<string, any> = {}
          for (const p of patients) map[String(p.id)] = null

          for (const d of docs) {
            const diagList = Array.isArray(d.diagnosis) ? d.diagnosis : []
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
          setLoading(false);
        } catch (e) {
          console.debug('failed to map org diagnosis', e)
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
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text ">Organization Dashboard</h1>
            <p className="text-muted-foreground mt-2">Manage doctors, patients, and assignments across your organization</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium text-sm transition-colors relative ${
              activeTab === 'overview'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Overview
            </div>
            {activeTab === 'overview' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 font-medium text-sm transition-colors relative ${
              activeTab === 'analytics'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </div>
            {activeTab === 'analytics' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        {activeTab === 'analytics' ? (
          <AnalyticsTab orgId={orgId} />
        ) : (
        <>
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6 bg-linear-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200/50 dark:border-blue-800/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Patients</p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-2">{orgPatients.length}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-linear-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200/50 dark:border-green-800/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Assigned</p>
                <p className="text-3xl font-bold text-green-700 dark:text-green-300 mt-2">{orgPatients.filter(p => p.createdBy).length}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-linear-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200/50 dark:border-amber-800/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Unassigned</p>
                <p className="text-3xl font-bold text-amber-700 dark:text-amber-300 mt-2">{orgPatients.filter(p => !p.createdBy).length}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <UserX className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-linear-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200/50 dark:border-purple-800/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Active Doctors</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{connectedDoctors.length - 1}</p>
                  <span className="text-sm text-purple-500 dark:text-purple-400">/ {doctorList.length}</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </Card>
        </div>

        {/* Patients Table Section */}
        <div>
          <Card className="bg-card border-border shadow-lg">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground">Patient Directory</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => loadOrgData()} disabled={loading} aria-label="Refresh patients" className="shadow-sm hover:shadow-md transition-shadow">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                  <button
                    onClick={() => { setOpen(true); setShowAllPatients(true) }}
                    className="p-2 rounded-lg border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                    title="Add New Patient"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => { setShowAllPatients(s => !s) }}
                    className="px-4 py-2 rounded-lg border border-border bg-accent/50 hover:bg-accent transition-colors text-sm font-medium"
                  >
                    {showAllPatients ? 'Hide Details' : 'Show Details'}
                  </button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search by patient name, ID, or assigned doctor..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>
            <NewPatientModal open={open} onClose={() => setOpen(false)} orgId={orgId} onCreated={async () => { await loadOrgData(); setShowAllPatients(true) }} />
            <div id="org-patients-table" className={`${showAllPatients ? 'block' : 'hidden'}`}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="py-4 px-6 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Patient</th>
                      <th className="py-4 px-6 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Age</th>
                      <th className="py-4 px-6 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned To</th>
                      <th className="py-4 px-6 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                      <th className="py-4 px-6 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
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
                      className="border-b border-border/50 hover:bg-accent/30 cursor-grab transition-colors group"
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
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center font-bold text-sm text-primary">{(p.name || p.id || '').slice(0,2).toUpperCase()}</div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">{p.name || p.id}</div>
                            <div className="text-xs text-muted-foreground truncate">{
                            // Prefer latest diagnosis -> patient.disease -> placeholder
                            (latestByPatient[p.id] && (latestByPatient[p.id]?.disease || latestByPatient[p.id]?.icd11))
                              ? `${latestByPatient[p.id]?.disease ? latestByPatient[p.id]?.disease : ''}${latestByPatient[p.id]?.icd11 ? ` (${latestByPatient[p.id]?.icd11})` : ''}`.trim()
                              : (p.hasOwnProperty('disease') && (p as any).disease ? (p as any).disease : '—')
                          }</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                          {p.age ?? '—'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {p.createdBy ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                              <UserCheck className="w-3 h-3 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-sm font-medium text-foreground">{doctorMap[p.createdBy]?.name || doctorMap[p.createdBy]?.email || p.createdBy}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium">
                            <UserX className="w-3 h-3" />
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          className="px-4 py-2 text-sm font-medium rounded-lg border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                          onClick={() => { setAssignPatient({ id: p.id, name: p.name }); setAssignDoctorId(p.createdBy); setAssignOpen(true) }}
                        >
                          Assign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <OrgDoctorsPanel orgId={orgId} />
          </div>
        </div>
        </>
        )}
        {assignOpen && assignPatient && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50" onClick={() => { setAssignOpen(false); setAssignPatient(null); setAssignDoctorId(undefined) }} />
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="relative w-full max-w-md bg-card border border-border rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Assign Patient</h3>
              <div className="text-sm text-muted-foreground mb-4">Assign <span className="font-medium">{assignPatient.name || assignPatient.id}</span> to a doctor</div>
              <div className="space-y-3">
                <label className="block text-sm mb-1">Doctor</label>
                <select value={assignDoctorId ?? ''} onChange={(e) => setAssignDoctorId(e.target.value || undefined)} className="w-full px-3 py-2 rounded-md border border-border bg-input">
                  <option value="">Unassign patient</option>
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
                      setAssigning(true)
                      try {
                        const res = await authFetch(`/api/organizations/${orgId}/patients/${assignPatient.id}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctorId: assignDoctorId || null }) })
                        if (!res.ok) {
                          const txt = await res.text().catch(() => '')
                          throw new Error(txt || 'Assign failed')
                        }
                        // update local table immediately
                        setOrgPatients(prev => prev.map(p => p.id === assignPatient.id ? { ...p, createdBy: assignDoctorId || undefined } : p))
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
          </div>
        )}
      </div>
    </>
  )

  return role === 'organization' ? OrgView : DoctorView
}

