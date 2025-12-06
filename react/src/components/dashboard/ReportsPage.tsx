"use client"

import { useEffect, useState, useMemo } from "react"
import { Button } from "../ui/button"
import { Card } from "../ui/card"
import { Input } from "../ui/input"
import { RefreshCw, FileText, User, Calendar, Stethoscope, ChevronDown, ChevronUp, Search, Filter } from "lucide-react"
import { useAuth } from "@/lib/auth"

type Report = { id: string; patientId: string; patientName?: string; doctorId?: string; doctorName?: string; icd11?: string | null; disease?: string | null; notes?: string | null; createdAt?: string | null }

export default function ReportsPage() {
  const { user, authFetch } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all')

  const role = user?.role || 'doctor'
  const orgId = (user?.profile as any)?.organizationId || null

  // Get unique doctors for filter
  const uniqueDoctors = useMemo(() => {
    const doctors = new Map<string, string>()
    reports.forEach(r => {
      if (r.doctorId && r.doctorName) {
        doctors.set(r.doctorId, r.doctorName)
      }
    })
    return Array.from(doctors.entries()).map(([id, name]) => ({ id, name }))
  }, [reports])

  // Filter reports based on search and filters
  const filteredReports = useMemo(() => {
    let filtered = reports

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(r => 
        (r.patientName || '').toLowerCase().includes(q) ||
        (r.disease || '').toLowerCase().includes(q) ||
        (r.icd11 || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q) ||
        (r.doctorName || '').toLowerCase().includes(q)
      )
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      
      filtered = filtered.filter(r => {
        if (!r.createdAt) return false
        const reportDate = new Date(r.createdAt)
        
        switch (dateFilter) {
          case 'today':
            const reportDay = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate())
            return reportDay.getTime() === today.getTime()
          case 'week':
            const weekAgo = new Date(today)
            weekAgo.setDate(weekAgo.getDate() - 7)
            return reportDate >= weekAgo
          case 'month':
            const monthAgo = new Date(today)
            monthAgo.setMonth(monthAgo.getMonth() - 1)
            return reportDate >= monthAgo
          default:
            return true
        }
      })
    }

    // Doctor filter
    if (selectedDoctor !== 'all') {
      filtered = filtered.filter(r => r.doctorId === selectedDoctor)
    }

    return filtered
  }, [reports, searchQuery, dateFilter, selectedDoctor])

  async function loadReports() {
    setLoading(true)
    try {
      if (role === 'organization' && orgId) {
        // Organization view: Load all diagnoses from all doctors
        const res = await authFetch(`/api/organizations/${orgId}/doctors`)
        if (!res.ok) throw new Error('failed to load doctors')
        const data = await res.json()
        const docs = data.doctors || []
        const collected: Report[] = []
        for (const d of docs) {
          const doctorName = (d && (d.name || (d.profile && d.profile.name) || d.email)) || 'Unknown'
          const doctorId = (d && (d.id || d._id || d.userId)) || undefined
          for (const diag of (d.diagnoses || [])) {
            const rec = diag as any
            collected.push({ id: rec.id || rec._id || String(Math.random()), patientId: rec.patientId || '', patientName: rec.patientName || rec.patientId, doctorId, doctorName, icd11: rec.icd11 || null, disease: rec.disease || null, notes: rec.notes || null, createdAt: rec.createdAt || null })
          }
        }
        collected.sort((a, b) => { const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0; const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0; return tb - ta })
        setReports(collected)
      } else {
        // Doctor view: Load only their diagnoses
        const res = await authFetch('/api/patients/diagnoses')
        if (!res.ok) throw new Error('failed to load diagnoses')
        const data = await res.json()
        const diagList = data.diagnoses || []
        const collected: Report[] = diagList.map((diag: any) => ({
          id: diag.id || diag._id || String(Math.random()),
          patientId: diag.patientId || diag.patient?.id || '',
          patientName: diag.patientName || diag.patient?.name || diag.patientId,
          doctorId: user?.id,
          doctorName: (user?.profile as any)?.name || user?.email || 'You',
          icd11: diag.icd11 || null,
          disease: diag.disease || null,
          notes: diag.notes || null,
          createdAt: diag.createdAt || null
        }))
        collected.sort((a, b) => { const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0; const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0; return tb - ta })
        setReports(collected)
      }
    } catch (err) {
      console.error('load reports error', err)
      setReports([])
    } finally {
      setLoading(false)
    }
  }

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
    setLoading(true)
    ;(async () => {
      try {
        await loadReports()
      } catch (err) {
        console.error('load reports error', err)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, orgId])

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500/5 via-purple-500/3 to-transparent p-6 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground leading-tight">
                  {role === 'organization' ? 'Organization Reports' : 'My Reports'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {role === 'organization' 
                    ? 'View all diagnoses across your organization' 
                    : 'View all diagnoses you\'ve created'}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => void loadReports()} 
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-6 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient, disease, doctor, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setDateFilter('all')
                setSelectedDoctor('all')
              }}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Clear Filters
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>

            {/* Doctor Filter - Only show for organizations */}
            {role === 'organization' && uniqueDoctors.length > 0 && (
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                <select
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Doctors</option>
                  {uniqueDoctors.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Results Count */}
            <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
              <span>Showing {filteredReports.length} of {reports.length} reports</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 pb-6">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Reports</p>
                <p className="text-lg font-bold text-foreground">{filteredReports.length}</p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Patients</p>
                <p className="text-lg font-bold text-foreground">
                  {new Set(filteredReports.map(r => r.patientId)).size}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Calendar className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">This Month</p>
                <p className="text-lg font-bold text-foreground">
                  {filteredReports.filter(r => {
                    if (!r.createdAt) return false
                    const d = new Date(r.createdAt)
                    const now = new Date()
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
                  }).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Reports List */}
      <Card className="bg-card border-border p-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading reports…</span>
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <FileText className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No reports found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {role === 'organization' 
                ? 'Diagnoses created by doctors will appear here' 
                : 'Your diagnoses will appear here'}
            </p>
          </div>
        )}

        {!loading && reports.length > 0 && filteredReports.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Search className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No reports match your filters</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Try adjusting your search or filters
            </p>
          </div>
        )}

        {!loading && filteredReports.length > 0 && (
          <div className="space-y-2.5">
            {filteredReports.map(r => (
              <div 
                key={r.id} 
                className="p-3 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors"
              >
                <button 
                  type="button" 
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)} 
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-primary">
                            {(r.patientName || r.patientId || '').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {r.patientName || r.patientId}
                          </p>
                          {r.disease && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-xs font-medium text-blue-600">
                                {r.disease}
                              </span>
                              {r.icd11 && (
                                <span className="px-1.5 py-0.5 rounded-md bg-green-500/10 text-xs font-medium text-green-600">
                                  {r.icd11}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground ml-12">
                        <div className="flex items-center gap-1">
                          <Stethoscope className="h-3 w-3" />
                          <span>{r.doctorName || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDateWithRelative(r.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 pt-2">
                      {expandedId === r.id ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </button>

                {expandedId === r.id && (
                  <div className="mt-2.5 ml-12 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Clinical Notes:</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap break-words">
                      {r.notes || '—'}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
