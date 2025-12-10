import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'
import { useSocket } from '@/lib/useSocket'
import { UserPlus, FileEdit, Clock, User } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Patient {
  id: string
  name?: string
  age?: number
  createdAt?: string
  assignedAt?: string
  createdBy?: string
}

interface RecentlyAssignedPanelProps {
  onWriteDiagnosis?: (patientId: string, patientName?: string) => void
}

export default function RecentlyAssignedPanel({ onWriteDiagnosis }: RecentlyAssignedPanelProps) {
  const { authFetch } = useAuth()
  const { socket } = useSocket()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)

  const loadRecentlyAssigned = async () => {
    try {
      setLoading(true)
      const res = await authFetch('/api/patients')
      if (!res.ok) throw new Error('Failed to load patients')
      const data = await res.json()
      
      // Filter patients assigned today (use assignedAt if available, fallback to createdAt)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const todaysPatients = (data.patients || []).filter((p: Patient) => {
        const assignmentDate = p.assignedAt
        if (!assignmentDate) return false
        const assignedDate = new Date(assignmentDate)
        return assignedDate >= today
      })
      
      setPatients(todaysPatients)
    } catch (err) {
      console.error('Failed to load recently assigned patients', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecentlyAssigned()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for real-time socket events for patient assignments
  useEffect(() => {
    if (!socket) return

    const handlePatientAssigned = (data: {
      patientId: string
      patientName: string
      patientAge?: number
      assignedBy: string
      organizationName: string
      timestamp: string
      message: string
    }) => {
      console.log('Patient assigned (RecentlyAssignedPanel):', data)
      
      // Add the new patient to the list immediately
      const newPatient: Patient = {
        id: data.patientId,
        name: data.patientName,
        age: data.patientAge,
        assignedAt: data.timestamp,
        createdBy: '', // Will be set by backend
      }
      
      setPatients((prev) => {
        // Check if patient already exists (avoid duplicates)
        const exists = prev.some(p => p.id === data.patientId)
        if (exists) return prev
        
        // Add to the beginning of the list
        return [newPatient, ...prev]
      })
    }

    const handleDiagnosisAdded = (data: { patientId: string; diagnosisId: string }) => {
      console.log('Diagnosis added, removing patient:', data.patientId)
      
      // Remove the patient from the list
      setPatients((prev) => prev.filter(p => p.id !== data.patientId))
    }

    socket.on('patient:assigned', handlePatientAssigned)
    socket.on('patient:diagnosis-added', handleDiagnosisAdded)

    return () => {
      socket.off('patient:assigned', handlePatientAssigned)
      socket.off('patient:diagnosis-added', handleDiagnosisAdded)
    }
  }, [socket])

  // Listen for patient assignment events (fallback for local state updates)
  useEffect(() => {
    const handleAssigned = () => {
      loadRecentlyAssigned()
    }
    window.addEventListener('orgPatientAssigned', handleAssigned)
    return () => window.removeEventListener('orgPatientAssigned', handleAssigned)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <Card className="p-3 bg-linear-to-br from-blue-500/5 to-indigo-500/5 border-blue-200/20">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-linear-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
            <UserPlus className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Today's Assignments</h3>
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        </div>
      </Card>
    )
  }

  if (patients.length === 0) {
    return (
      <Card className="p-3 bg-linear-to-br from-blue-500/5 to-indigo-500/5 border-blue-200/20">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-linear-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
            <UserPlus className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Today's Assignments</h3>
            <p className="text-xs text-muted-foreground">No new patients today</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <User className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">No patients assigned today</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-3 bg-linear-to-br from-blue-500/5 to-indigo-500/5 border-blue-200/20">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-linear-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
          <UserPlus className="h-3.5 w-3.5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Today's Assignments</h3>
          <p className="text-xs text-muted-foreground">
            {patients.length} {patients.length === 1 ? 'patient' : 'patients'} assigned
          </p>
        </div>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {patients.map((patient) => (
          <div
            key={patient.id}
            className="p-2.5 rounded-lg bg-card border border-border hover:border-blue-300/50 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-linear-to-br from-blue-500/10 to-indigo-500/10 flex items-center justify-center font-semibold text-xs text-blue-600 shrink-0">
                {(patient.name || patient.id || '').slice(0, 2).toUpperCase()}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {patient.name || patient.id}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Clock className="h-3 w-3" />
                  <span>
                    {patient.createdAt
                      ? new Date(patient.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Today'}
                  </span>
                </div>
                
                <Button
                  size="sm"
                  onClick={() => onWriteDiagnosis?.(patient.id, patient.name)}
                  className="w-full mt-2 h-7 text-xs bg-linear-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-sm"
                >
                  <FileEdit className="h-3 w-3 mr-1.5" />
                  Write Diagnosis
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
