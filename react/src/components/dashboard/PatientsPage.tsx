"use client"
import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth"
import { Card } from "@/components/ui/card"
import { Button } from "../ui/button"
import { Plus, Search, Filter, ChevronDown, ChevronUp, User, Calendar, Stethoscope, FileText } from "lucide-react"
import NewPatientModal from "./NewPatientModal"

type Diagnosis = {
  id: string
  icd11?: string | null
  disease?: string | null
  notes?: string | null
  createdAt?: string | null
  createdBy?: string
  doctorName?: string
  doctorEmail?: string
}

type Patient = {
  id: string
  name?: string
  age?: number
  createdAt?: string
  createdBy?: string
  assignedDoctorName?: string
  assignedDoctorEmail?: string
  diagnosis?: Diagnosis[]
  diagnosisCount?: number
}

export default function PatientsPage() {
  const { user, authFetch } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterDoctor, setFilterDoctor] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"name" | "date" | "diagnosis">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null)
  const [doctorList, setDoctorList] = useState<Array<{ id: string; name?: string; email?: string }>>([])
  const [newPatientOpen, setNewPatientOpen] = useState(false)

  const role = user?.role || 'doctor'
  type UserProfile = { organizationId?: string | null } | undefined
  const orgId = role === 'organization' ? (user?.profile as UserProfile)?.organizationId : null
  const userId = user?.id

  async function loadPatients() {
    setLoading(true)
    try {
      // For doctors: load patients assigned to them OR patients they've diagnosed
      if (role === 'doctor') {
        const patientMap = new Map<string, Patient>()
        const userProfile = user?.profile as { name?: string } | undefined
        const doctorName = userProfile?.name || user?.email

        // 1. Load assigned patients
        const res = await authFetch('/api/patients')
        if (res.ok) {
          const data = await res.json()
          const assignedPatients: Patient[] = (data.patients || []).map((p: { id?: string; _id?: string; name?: string; age?: number; createdAt?: string }) => ({
            id: String(p.id || p._id || ''),
            name: p.name,
            age: p.age,
            createdAt: p.createdAt,
            createdBy: userId,
            assignedDoctorName: doctorName,
            assignedDoctorEmail: user?.email,
            diagnosis: [],
            diagnosisCount: 0
          }))
          assignedPatients.forEach(p => patientMap.set(p.id, p))
        }

        // 2. Load all diagnosis by this doctor to find patients they've diagnosed
        const diagRes = await authFetch('/api/patients/diagnosis')
        if (diagRes.ok) {
          const diagData = await diagRes.json()
          const myDiagnosis = diagData.diagnosis || []

          // Group diagnosis by patient ID
          const diagsByPatient = new Map<string, Diagnosis[]>()
          for (const d of myDiagnosis) {
            const patientId = String(d.patientId || d.patient_id || (d.patient && (d.patient.id || d.patient._id)) || '')
            if (!patientId) continue

            const diagnosis: Diagnosis = {
              id: String(d.id || d._id || ''),
              icd11: d.icd11,
              disease: d.disease,
              notes: d.notes,
              createdAt: d.createdAt,
              createdBy: userId,
              doctorName: doctorName,
              doctorEmail: user?.email
            }

            if (!diagsByPatient.has(patientId)) {
              diagsByPatient.set(patientId, [])
            }
            diagsByPatient.get(patientId)!.push(diagnosis)
          }

          // For each patient with diagnosis, ensure they're in our map
          for (const [patientId, diagnosis] of diagsByPatient.entries()) {
            if (!patientMap.has(patientId)) {
              // Patient not assigned to us but we have diagnosis for them
              // Fetch patient info
              try {
                const pRes = await authFetch(`/api/patients/${patientId}`)
                if (pRes.ok) {
                  const pData = await pRes.json()
                  const p = pData.patient
                  patientMap.set(patientId, {
                    id: patientId,
                    name: p?.name,
                    age: p?.age,
                    createdAt: p?.createdAt,
                    createdBy: p?.createdBy,
                    diagnosis: [],
                    diagnosisCount: 0
                  })
                }
              } catch {
                // If we can't fetch patient info, create minimal entry
                patientMap.set(patientId, {
                  id: patientId,
                  name: `Patient ${patientId.slice(0, 8)}`,
                  diagnosis: [],
                  diagnosisCount: 0
                })
              }
            }

            // Add diagnosis to patient
            const patient = patientMap.get(patientId)
            if (patient) {
              patient.diagnosis = diagnosis.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
                return dateB - dateA
              })
              patient.diagnosisCount = diagnosis.length
            }
          }
        }

        setPatients(Array.from(patientMap.values()))
        setDoctorList([{ id: userId || '', name: doctorName, email: user?.email }])
        setLoading(false)
        return
      }

      // For organizations: load all patients from all doctors
      if (!orgId) return
      const res = await authFetch(`/api/organizations/${orgId}/doctors`)
      if (!res.ok) throw new Error('Failed to load data')
      const data = await res.json()
      const docs = data.doctors || []

      // Build doctor map
      const docMap: Record<string, { name?: string; email?: string }> = {}
      const docList: Array<{ id: string; name?: string; email?: string }> = []
      
      for (const d of docs) {
        docMap[d.id] = { name: d.profile?.name, email: d.email }
        docList.push({ id: d.id, name: d.profile?.name, email: d.email })
      }
      setDoctorList(docList)

      // Collect all patients with their diagnosis
      const patientMap = new Map<string, Patient>()

      for (const doctor of docs) {
        // Add doctor's patients
        if (Array.isArray(doctor.patients)) {
          for (const p of doctor.patients) {
            const patientId = String(p.id || p._id || '')
            if (!patientId) continue

            if (!patientMap.has(patientId)) {
              patientMap.set(patientId, {
                id: patientId,
                name: p.name,
                age: p.age,
                createdAt: p.createdAt,
                createdBy: doctor.id,
                assignedDoctorName: docMap[doctor.id]?.name,
                assignedDoctorEmail: docMap[doctor.id]?.email,
                diagnosis: [],
                diagnosisCount: 0
              })
            }
          }
        }

        // Add diagnosis
        if (Array.isArray(doctor.diagnosis)) {
          for (const diag of doctor.diagnosis) {
            const patientId = String(diag.patientId || diag.patient_id || (diag.patient && (diag.patient.id || diag.patient._id)) || '')
            if (!patientId) continue

            const diagnosis: Diagnosis = {
              id: String(diag.id || diag._id || ''),
              icd11: diag.icd11,
              disease: diag.disease,
              notes: diag.notes,
              createdAt: diag.createdAt,
              createdBy: doctor.id,
              doctorName: docMap[doctor.id]?.name,
              doctorEmail: docMap[doctor.id]?.email
            }

            const patient = patientMap.get(patientId)
            if (patient) {
              if (!patient.diagnosis) patient.diagnosis = []
              patient.diagnosis.push(diagnosis)
              patient.diagnosisCount = (patient.diagnosisCount || 0) + 1
            } else {
              // Patient exists but not in assigned list (might be unassigned or deleted)
              // Add them anyway
              patientMap.set(patientId, {
                id: patientId,
                name: `Patient ${patientId.slice(0, 8)}`,
                createdBy: doctor.id,
                assignedDoctorName: docMap[doctor.id]?.name,
                assignedDoctorEmail: docMap[doctor.id]?.email,
                diagnosis: [diagnosis],
                diagnosisCount: 1
              })
            }
          }
        }
      }

      // Load unassigned patients
      try {
        const unassignedRes = await authFetch(`/api/organizations/${orgId}/unassigned`)
        if (unassignedRes.ok) {
          const unassignedData = await unassignedRes.json()
          for (const p of unassignedData.patients || []) {
            const patientId = String(p.id || p._id || '')
            if (!patientId || patientMap.has(patientId)) continue

            patientMap.set(patientId, {
              id: patientId,
              name: p.name,
              age: p.age,
              createdAt: p.createdAt,
              createdBy: p.createdBy,
              diagnosis: [],
              diagnosisCount: 0
            })
          }
        }
      } catch (e) {
        console.warn('Failed to load unassigned patients', e)
      }

      // Sort diagnosis by date (most recent first)
      const allPatients = Array.from(patientMap.values())
      allPatients.forEach(patient => {
        if (patient.diagnosis && patient.diagnosis.length > 0) {
          patient.diagnosis.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
            return dateB - dateA
          })
        }
      })

      setPatients(allPatients)
    } catch (err) {
      console.error('Failed to load patients:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPatients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function filterAndSortPatients() {
    let filtered = [...patients]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(p => 
        (p.name || '').toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query) ||
        (p.assignedDoctorName || '').toLowerCase().includes(query) ||
        (p.assignedDoctorEmail || '').toLowerCase().includes(query) ||
        p.diagnosis?.some(d => 
          (d.disease || '').toLowerCase().includes(query) ||
          (d.icd11 || '').toLowerCase().includes(query) ||
          (d.notes || '').toLowerCase().includes(query)
        )
      )
    }

    // Apply doctor filter
    if (filterDoctor !== "all") {
      filtered = filtered.filter(p => p.createdBy === filterDoctor)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let compareValue = 0

      switch (sortBy) {
        case "name":
          compareValue = (a.name || a.id).localeCompare(b.name || b.id)
          break
        case "date": {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          compareValue = dateA - dateB
          break
        }
        case "diagnosis":
          compareValue = (a.diagnosisCount || 0) - (b.diagnosisCount || 0)
          break
      }

      return sortOrder === "asc" ? compareValue : -compareValue
    })

    setFilteredPatients(filtered)
  }

  useEffect(() => {
    filterAndSortPatients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, searchQuery, filterDoctor, sortBy, sortOrder])

  function toggleSort(field: "name" | "date" | "diagnosis") {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("desc")
    }
  }

  function toggleExpand(patientId: string) {
    setExpandedPatient(expandedPatient === patientId ? null : patientId)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {role === 'doctor' ? 'My Patients' : 'Patients Overview'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {role === 'doctor' 
              ? 'View your patients and the diagnosis you\'ve provided' 
              : 'View all patients and their diagnosis across your organization'}
          </p>
        </div>
        <Button onClick={() => setNewPatientOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Patient
        </Button>
      </div>

      {/* Stats Cards */}
      <div className={`grid grid-cols-1 gap-4 ${role === 'organization' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{role === 'doctor' ? 'My Patients' : 'Total Patients'}</p>
              <p className="text-2xl font-bold">{patients.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-green-500/10">
              <Stethoscope className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{role === 'doctor' ? 'My Diagnosis' : 'Total Diagnosis'}</p>
              <p className="text-2xl font-bold">{patients.reduce((sum, p) => sum + (p.diagnosisCount || 0), 0)}</p>
            </div>
          </div>
        </Card>
        {role === 'organization' && (
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Doctors</p>
                <p className="text-2xl font-bold">{doctorList.length}</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={role === 'doctor' ? "Search patients or diagnosis..." : "Search patients, doctors, or diagnosis..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background"
            />
          </div>
          {role === 'organization' && doctorList.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterDoctor}
                onChange={(e) => setFilterDoctor(e.target.value)}
                className="px-3 py-2 border border-border rounded-md bg-background"
              >
                <option value="all">All Doctors</option>
                {doctorList.map(d => (
                  <option key={d.id} value={d.id}>{d.name || d.email}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* Patients Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading patients...</div>
        ) : filteredPatients.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {searchQuery || filterDoctor !== "all" ? "No patients found matching your filters" : "No patients yet"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => toggleSort("name")}
                      className="flex items-center gap-1 font-semibold text-sm hover:text-primary transition-colors"
                    >
                      Patient
                      {sortBy === "name" && (sortOrder === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="font-semibold text-sm">Age</span>
                  </th>
                  {role === 'organization' && (
                    <th className="px-4 py-3 text-left">
                      <span className="font-semibold text-sm">Assigned Doctor</span>
                    </th>
                  )}
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => toggleSort("diagnosis")}
                      className="flex items-center gap-1 font-semibold text-sm hover:text-primary transition-colors"
                    >
                      Diagnosis
                      {sortBy === "diagnosis" && (sortOrder === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => toggleSort("date")}
                      className="flex items-center gap-1 font-semibold text-sm hover:text-primary transition-colors"
                    >
                      Created
                      {sortBy === "date" && (sortOrder === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                    </button>
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((patient) => (
                  <>
                    <tr key={patient.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-sm">
                            {(patient.name || patient.id).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{patient.name || `Patient ${patient.id.slice(0, 8)}`}</div>
                            <div className="text-xs text-muted-foreground">ID: {patient.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{patient.age || '—'}</td>
                      {role === 'organization' && (
                        <td className="px-4 py-3 text-sm">
                          {patient.assignedDoctorName || patient.assignedDoctorEmail || 
                            <span className="text-muted-foreground italic">Unassigned</span>}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {patient.diagnosisCount || 0} {(patient.diagnosisCount || 0) === 1 ? 'diagnosis' : 'diagnosis'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {patient.createdAt ? new Date(patient.createdAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {(patient.diagnosisCount || 0) > 0 && (
                          <button
                            onClick={() => toggleExpand(patient.id)}
                            className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                          >
                            {expandedPatient === patient.id ? (
                              <>Hide <ChevronUp className="h-4 w-4" /></>
                            ) : (
                              <>View <ChevronDown className="h-4 w-4" /></>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedPatient === patient.id && patient.diagnosis && patient.diagnosis.length > 0 && (
                      <tr key={`${patient.id}-expanded`}>
                        <td colSpan={role === 'organization' ? 6 : 5} className="px-4 py-4 bg-muted/20">
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Diagnosis History
                            </h4>
                            <div className="space-y-2">
                              {patient.diagnosis.map((diagnosis, idx) => (
                                <div
                                  key={diagnosis.id || idx}
                                  className="p-3 rounded-lg bg-card border border-border"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-1">
                                      <div className="flex items-center gap-2">
                                        {diagnosis.disease && (
                                          <span className="font-medium text-sm">{diagnosis.disease}</span>
                                        )}
                                        {diagnosis.icd11 && (
                                          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                            {diagnosis.icd11}
                                          </span>
                                        )}
                                      </div>
                                      {diagnosis.notes && (
                                        <p className="text-sm text-muted-foreground">{diagnosis.notes}</p>
                                      )}
                                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                                        {role === 'organization' && (
                                          <span className="flex items-center gap-1">
                                            <Stethoscope className="h-3 w-3" />
                                            {diagnosis.doctorName || diagnosis.doctorEmail || 'Unknown doctor'}
                                          </span>
                                        )}
                                        {diagnosis.createdAt && (
                                          <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(diagnosis.createdAt).toLocaleDateString('en-US', {
                                              year: 'numeric',
                                              month: 'short',
                                              day: 'numeric',
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            })}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* New Patient Modal */}
      <NewPatientModal
        open={newPatientOpen}
        onClose={() => setNewPatientOpen(false)}
        orgId={orgId}
        onCreated={() => {
          setNewPatientOpen(false)
          loadPatients()
        }}
      />
    </div>
  )
}
