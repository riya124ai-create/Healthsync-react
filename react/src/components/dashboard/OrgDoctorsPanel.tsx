"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { Button } from "../ui/button"
import { useAuth } from "@/lib/auth"
import { ChevronUp, ChevronDown } from "lucide-react"
// inline org new-patient modal used instead of importing the full NewPatientModal

type Profile = { name?: string }

type Patient = {
  id: string
  name?: string
  age?: number
  createdAt?: string | null
}

type Diagnosis = {
  id: string
  patientId?: string
  patientName?: string
  icd11?: string
  disease?: string
  notes?: string
  createdAt?: string
}

type Doctor = {
  id: string
  email?: string
  profile?: Profile
  patients?: Patient[]
  diagnosis?: Diagnosis[]
}

export default function OrgDoctorsPanel({ orgId }: { orgId: string | null }) {
  const { authFetch } = useAuth()
  // Helper: create a nicely styled drag preview element and attach to document body
  
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [panelError, setPanelError] = useState<string | null>(null)

  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    if (!query) return doctors
    const q = query.trim().toLowerCase()
    return doctors.filter(d => {
      const name = d.profile?.name || ""
      const email = d.email || ""
      return name.toLowerCase().includes(q) || email.toLowerCase().includes(q)
    })
  }, [doctors, query])
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null)
  const [openDiagnosisIds, setOpenDiagnosisIds] = useState<Record<string, boolean>>({})

  // Scroll indicators state for diagnosis lists
  const [scrollStates, setScrollStates] = useState<Record<string, { canScrollUp: boolean; canScrollDown: boolean }>>({})
  const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const handleScroll = (key: string) => {
    const el = scrollRefs.current[key]
    if (!el) return
    const canScrollUp = el.scrollTop > 5
    const canScrollDown = el.scrollTop < el.scrollHeight - el.clientHeight - 5
    setScrollStates(prev => ({ ...prev, [key]: { canScrollUp, canScrollDown } }))
  }

  const toggleDiagnosis = (id?: string) => {
    if (!id) return
    setOpenDiagnosisIds((s) => ({ ...s, [id]: !s[id] }))
  }

  function formatDateWithRelative(dateStr?: string | null) {
    if (!dateStr) return "—"
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return "—"

    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const yyyy = d.getFullYear()
    const dateLabel = `${dd}-${mm}-${yyyy}`

    const msPerDay = 24 * 60 * 60 * 1000
    const today = new Date()
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const dateMid = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diffDays = Math.floor((todayMid.getTime() - dateMid.getTime()) / msPerDay)

    let relative = ""
    if (diffDays <= 0) relative = "Today"
    else if (diffDays === 1) relative = "Yesterday"
    else if (diffDays >= 2 && diffDays <= 6) relative = `${diffDays} Days`
    else if (diffDays >= 7 && diffDays < 30) {
      const weeks = Math.floor(diffDays / 7)
      relative = `${weeks} Week${weeks > 1 ? "s" : ""}`
    } else {
      const months = Math.floor(diffDays / 30)
      relative = `${months} Month${months > 1 ? "s" : ""}`
    }

    return `${dateLabel} (${relative})`
  }

  function computeInitials(name?: string | null, email?: string | null) {
    // If name is not provided, fall back to email first char or 'D'
    if (!name || name.trim().length === 0) return (email && email[0]?.toUpperCase()) || 'D'
    // Remove common titles like 'Dr.' so we can detect given name and surname
    const titles = new Set(['dr', 'dr.', 'doctor'])
    const parts = name.split(/\s+/).filter(Boolean).filter(p => !titles.has(p.toLowerCase()))
    if (parts.length === 0) return (email && email[0]?.toUpperCase()) || 'D'
    if (parts.length === 1) {
      // No surname — start initials with 'D' followed by first letter of the single name
      const first = parts[0][0]?.toUpperCase() || 'D'
      return `D${first}`
    }
    // Has surname — use first letter of given name + first letter of surname
    const a = parts[0][0]?.toUpperCase() || 'D'
    const b = parts[1][0]?.toUpperCase() || ''
    return `${a}${b}`
  }

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await authFetch(`/api/organizations/${orgId}/doctors`)
        if (!res.ok) throw new Error('failed to load doctors')
        const data = await res.json()
        if (!cancelled) setDoctors(data.doctors || [])
      } catch (err) {
        console.error('load org doctors error', err)
        if (!cancelled) setDoctors([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [orgId, authFetch])


  // helper: re-fetch doctors
  async function refreshDoctors() {
    if (!orgId) return
    setLoading(true)
    try {
      const res = await authFetch(`/api/organizations/${orgId}/doctors`)
      if (!res.ok) throw new Error('failed to load doctors')
      const data = await res.json()
      setDoctors(data.doctors || [])
    } catch (err) {
      console.error('refresh doctors error', err)
    } finally {
      setLoading(false)
    }
  }

  if (!orgId) return <div className="text-sm text-muted-foreground">No organization selected.</div>

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Doctors</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* New Patient button moved to Organization Patients table in EMR dashboard */}
        </div>
        <div className="w-full sm:w-80">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search doctors by name or email"
            className="w-full px-3 py-2 rounded-md border border-border bg-input text-sm"
          />
        </div>
      </div>

      {panelError && <div className="text-sm text-destructive mt-2">{panelError}</div>}


      

      {loading && <div className="text-sm text-muted-foreground">Loading doctors…</div>}
      {!loading && doctors.length === 0 && <div className="text-sm text-muted-foreground">No doctors found.</div>}

      <div className="lg:flex lg:gap-6">
        <div className="lg:flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {filtered.map((d) => {
          const patientsCount = d.patients ? d.patients.length : 0
          const DiagnosisCount = d.diagnosis ? d.diagnosis.length : 0
          const lastDiagnosis = (d.diagnosis || []).reduce<string | null>((acc, cur) => {
            if (!cur?.createdAt) return acc
            if (!acc) return cur.createdAt
            return new Date(cur.createdAt) > new Date(acc) ? cur.createdAt : acc
          }, null)

          return (
            <div key={d.id}
              className={"relative border border-border rounded-lg p-4 bg-background flex flex-col sm:flex-row gap-3 overflow-hidden " + (dropTarget === d.id ? 'ring-2 ring-primary/60' : '')}
              onDragOver={(e) => { e.preventDefault(); setDropTarget(d.id) }}
              onDragLeave={() => { setDropTarget(null) }}
              onDrop={async (e) => {
                e.preventDefault()
                setDropTarget(null)
                setPanelError(null)
                try {
                  const data = e.dataTransfer.getData('text/plain')
                  if (!data) return
                  const parsed = JSON.parse(data)
                  const patientId = parsed.patientId
                  const fromDoctorId = parsed.fromDoctorId || null
                  if (!patientId) return
                  // continue

                  // Optimistic local update: remove from source and add to target
                  setDoctors((prev) => {
                    const next = prev.map((doc) => {
                      // remove patient from source
                      if (fromDoctorId && doc.id === fromDoctorId) {
                        return { ...doc, patients: (doc.patients || []).filter(p => p.id !== patientId) }
                      }
                      // add to destination
                      if (doc.id === d.id) {
                        // avoid duplicate
                        const existing = (doc.patients || []).some(p => p.id === patientId)
                        if (existing) return doc
                        const newPatient: Patient = { id: patientId }
                        return { ...doc, patients: [newPatient, ...(doc.patients || [])] }
                      }
                      return doc
                    })
                    return next
                  })


                  // Notify other parts of the UI (table/carousel) about optimistic assignment
                  try {
                    window.dispatchEvent(new CustomEvent('orgPatientAssigned', { detail: { patientId, doctorId: d.id } }))
                  } catch (e) {
                    console.debug('dispatch orgPatientAssigned failed', e)
                  }

                  const res = await authFetch(`/api/organizations/${orgId}/patients/${patientId}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctorId: d.id }) })
                  if (!res.ok) {
                    const txt = await res.text().catch(() => '')
                    await refreshDoctors()
                    setPanelError(txt || 'Failed to assign patient')
                  } else {
                    await refreshDoctors()
                    console.log('Patient assigned successfully - doctor will receive real-time notification')
                  }
                } catch (err) {
                  console.error('drop assign error', err)
                  setPanelError('Transfer failed')
                  await refreshDoctors()
                }
              }}
            >
              {dropTarget === d.id && (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-black/40 pointer-events-none">
                  <div className="text-center px-4">
                    <div className="text-white font-semibold text-lg">Assign to doctor</div>
                  </div>
                </div>
              )}
              <div className="shrink-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                  {computeInitials(d.profile?.name as string | undefined, d.email)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{d.profile?.name || d.email || d.id}</div>
                    <div className="text-xs text-muted-foreground truncate">{d.email}</div>
                  </div>
                  <div className="text-right sm:text-right">
                    <div className="text-sm font-medium">{patientsCount} patients</div>
                    <div className="text-xs text-muted-foreground">{DiagnosisCount} diagnosis</div>
                  </div>
                </div>

                  <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">Last: {formatDateWithRelative(lastDiagnosis)}</div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          // open details pane on large screens, inline expand on small screens
                          if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
                            setSelectedDoctorId(selectedDoctorId === d.id ? null : d.id)
                            setExpanded(null)
                          } else {
                            setExpanded(expanded === d.id ? null : d.id)
                            setSelectedDoctorId(null)
                          }
                        }}
                      >
                        {selectedDoctorId === d.id || expanded === d.id ? 'Hide' : 'View details'}
                      </Button>
                    </div>
                  </div>

                {expanded === d.id && (
                  <div className="mt-3 border-t border-border pt-3 space-y-3">

                    <div>
                      <h4 className="text-sm font-medium">Recent Diagnosis ({DiagnosisCount})</h4>
                      {d.diagnosis && d.diagnosis.length > 0 ? (
                        <div className="relative mt-2">
                          {scrollStates[`diagnosis-${d.id}`]?.canScrollUp && (
                            <div className="absolute top-0 left-0 right-0 h-8 bg-linear-to-b from-card to-transparent z-10 flex items-start justify-center pointer-events-none">
                              <ChevronUp className="w-5 h-5 text-primary" />
                            </div>
                          )}
                          <div
                            ref={(el) => { scrollRefs.current[`diagnosis-${d.id}`] = el }}
                            className="max-h-48 overflow-auto space-y-2 text-sm"
                            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                            onScroll={() => handleScroll(`diagnosis-${d.id}`)}
                          >
                        <ul className="space-y-2">
                          {d.diagnosis.slice(0, 6).map((r: Diagnosis) => (
                            <li
                              key={r.id}
                              className="p-2 border border-border rounded-md cursor-pointer"
                              role={r.notes ? 'button' : undefined}
                              aria-expanded={r.notes ? !!openDiagnosisIds[r.id] : undefined}
                              onClick={() => r.notes && toggleDiagnosis(r.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold truncate">{r.patientName || r.patientId}</div>
                                  <div className="text-xs text-muted-foreground">{r.disease || r.icd11 || '—'}</div>
                                </div>
                                <div className="text-xs text-muted-foreground">{formatDateWithRelative(r.createdAt)}</div>
                              </div>
                              {r.notes && (
                                <div
                                  className="mt-2 text-sm whitespace-pre-wrap overflow-hidden transition-all duration-200"
                                  style={{ maxHeight: openDiagnosisIds[r.id] ? 400 : 0, opacity: openDiagnosisIds[r.id] ? 1 : 0 }}
                                >
                                  {r.notes}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                          </div>
                          {scrollStates[`diagnosis-${d.id}`]?.canScrollDown && (
                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-card to-transparent z-10 flex items-end justify-center pointer-events-none">
                              <ChevronDown className="w-5 h-5 text-primary" />
                            </div>
                          )}
                        </div>
                      ) : <div className="text-sm text-muted-foreground">No diagnosis</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
            })}
          </div>
        </div>

        <div className="hidden lg:block lg:w-1/3">
          <div className="sticky top-6">
            {selectedDoctorId ? (
              (() => {
                const doc = doctors.find(x => x.id === selectedDoctorId) as Doctor | undefined
                if (!doc) return <div className="text-sm text-muted-foreground">Doctor not found.</div>
                const patientsCount = doc.patients ? doc.patients.length : 0
                const DiagnosisCount = doc.diagnosis ? doc.diagnosis.length : 0
                return (
                  <div className="border border-border rounded-lg p-4 bg-background">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                        {computeInitials(doc.profile?.name as string | undefined, doc.email)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{doc.profile?.name || doc.email}</div>
                        <div className="text-xs text-muted-foreground">{doc.email}</div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Patients</div>
                        <div className="text-sm font-medium">{patientsCount}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Diagnosis</div>
                        <div className="text-sm font-medium">{DiagnosisCount}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Recent</div>
                        <div className="relative mt-2">
                          {scrollStates[`modal-diagnosis-${doc.id}`]?.canScrollUp && (
                            <div className="absolute top-0 left-0 right-0 h-8 bg-linear-to-b from-card to-transparent z-10 flex items-start justify-center pointer-events-none">
                              <ChevronUp className="w-5 h-5 text-primary" />
                            </div>
                          )}
                          <div
                            ref={(el) => { scrollRefs.current[`modal-diagnosis-${doc.id}`] = el }}
                            className="max-h-64 overflow-auto space-y-2"
                            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                            onScroll={() => handleScroll(`modal-diagnosis-${doc.id}`)}
                          >
                        <div className="space-y-2">
                          {(doc.diagnosis || []).slice(0, 10).map((r) => (
                            <div
                              key={r.id}
                              className="p-2 border border-border rounded-md cursor-pointer"
                              role={r.notes ? 'button' : undefined}
                              aria-expanded={r.notes ? !!openDiagnosisIds[r.id] : undefined}
                              onClick={() => r.notes && toggleDiagnosis(r.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold truncate">{r.patientName || r.patientId}</div>
                                  <div className="text-xs text-muted-foreground">{r.disease || r.icd11 || '—'}</div>
                                </div>
                                <div className="text-xs text-muted-foreground">{formatDateWithRelative(r.createdAt)}</div>
                              </div>
                              {r.notes && (
                                <div
                                  className="mt-2 text-sm whitespace-pre-wrap overflow-hidden transition-all duration-200"
                                  style={{ maxHeight: openDiagnosisIds[r.id] ? 400 : 0, opacity: openDiagnosisIds[r.id] ? 1 : 0 }}
                                >
                                  {r.notes}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                          </div>
                          {scrollStates[`modal-diagnosis-${doc.id}`]?.canScrollDown && (
                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-card to-transparent z-10 flex items-end justify-center pointer-events-none">
                              <ChevronDown className="w-5 h-5 text-primary" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()
            ) : (
              <div className="border border-border rounded-lg p-4 bg-card text-sm text-muted-foreground">Select a doctor to see details</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
