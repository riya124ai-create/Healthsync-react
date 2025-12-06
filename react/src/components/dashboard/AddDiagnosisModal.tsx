"use client"

import React, { useEffect, useState } from "react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { useAuth } from "@/lib/auth"

type Patient = { id: string; name?: string; createdBy?: string }

export default function AddDiagnosisModal({ open, onClose, onAdded, preSelectedPatientId }: { open: boolean; onClose: () => void; onAdded?: () => void; onRequestNewPatient?: () => void; preSelectedPatientId?: string }) {
  const { authFetch, user } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [newName, setNewName] = useState<string>("")
  const [newAge, setNewAge] = useState<number | "">("")
  
  const [query, setQuery] = useState("")
  const [icd11, setIcd11] = useState<string | null>(null)
  const [disease, setDisease] = useState<string | null>(null)
  const [notes, setNotes] = useState<string>("")
  const [suggestions, setSuggestions] = useState<Array<{ name: string; code: string }>>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoadingPatients(true)
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch('/api/patients')
        if (!res.ok) throw new Error('failed to load patients')
        const data = await res.json()
        if (!cancelled) {
          const all: Patient[] = data.patients || []
          const u = user as { id?: string; email?: string } | null
          const userId = u?.id
          const userEmail = u?.email
          const filtered = all.filter(p => p.createdBy === userId || p.createdBy === userEmail)
          setPatients(filtered)
        }
      } catch (err) {
        console.error('load patients error', err)
      } finally {
        if (!cancelled) setLoadingPatients(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, authFetch, user])

  useEffect(() => {
    if (!open) return
    setSuggestions([])
    setIcd11(null)
    setDisease(null)
    setQuery("")
    setSelected(preSelectedPatientId || null)
    setError(null)
    setNotes("")
    setNewName("")
    setNewAge("")
  }, [open, preSelectedPatientId])

  function resetForm() {
    setSelected(null)
    setQuery("")
    setIcd11(null)
    setDisease(null)
    setNotes("")
    setSuggestions([])
    setError(null)
    setNewName("")
    setNewAge("")
  }

  // debounce ICD search (NLM)
  useEffect(() => {
    let cancelled = false
    setError(null)
    const q = (query || '').trim()
    if (!q) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      setLoadingSuggestions(true)
      try {
        const url = `https://clinicaltables.nlm.nih.gov/api/icd11_codes/v3/search?terms=${encodeURIComponent(q)}&maxList=15`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`icd lookup failed ${res.status}`)
        const data: unknown = await res.json()
        const parsed: Array<{ name: string; code: string }> = []
        if (Array.isArray(data)) {
          const maybeResults = data[1]
          const maybeDetails = data[3]
          if (Array.isArray(maybeResults) && maybeResults.length > 0 && typeof maybeResults[0] === 'string' && Array.isArray(maybeDetails)) {
            for (const item of maybeDetails) {
              if (Array.isArray(item)) {
                const code = String(item[0] ?? '')
                const name = String(item[1] ?? item[2] ?? code)
                parsed.push({ name, code })
              }
            }
          } else if (Array.isArray(maybeResults)) {
            for (const item of maybeResults) {
              if (Array.isArray(item)) {
                const code = String(item[0] ?? '')
                const name = String(item[1] ?? item[2] ?? code)
                parsed.push({ name, code })
                } else if (item && typeof item === 'object') {
                const it = item as Record<string, unknown>
                const code = String(it.code ?? it.id ?? it.ICD11 ?? '')
                const name = String(it.title ?? it.name ?? it.label ?? code)
                parsed.push({ name, code })
              } else if (typeof item === 'string') {
                const code = item
                parsed.push({ name: code, code })
              }
            }
          }
        } else if (data && typeof data === 'object') {
          const obj = data as Record<string, unknown>
          const results = Array.isArray(obj.results) ? obj.results : Array.isArray(obj.items) ? obj.items : []
          if (Array.isArray(results)) {
            for (const item of results) {
              if (item && typeof item === 'object') {
                const it = item as Record<string, unknown>
                const code = String(it.code ?? it.id ?? '')
                const name = String(it.title ?? it.name ?? it.label ?? code)
                parsed.push({ name, code })
              }
            }
          }
        }
        if (!cancelled) setSuggestions(parsed.slice(0, 15))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (!cancelled) setError(msg || 'lookup error')
      } finally {
        if (!cancelled) setLoadingSuggestions(false)
      }
    }, 350)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, open])

  if (!open) return null

  async function handleAdd(e?: React.FormEvent) {
    e?.preventDefault()
    if (!selected) { setError('Select a patient'); return }
    if (!notes || notes.trim() === '') { setError('Notes (text diagnosis) are required'); return }
    setSaving(true)
    try {
      let targetPatientId = selected

      // If creating a new patient inline, first create the patient using provided name/age and the diagnosis icd11
      if (selected === '__new__') {
        if (!newName || String(newAge) === '') {
          setError('New patient name and age are required')
          setSaving(false)
          return
        }
        if (!icd11) {
          setError('ICD-11 code is required to create a new patient')
          setSaving(false)
          return
        }
        const patientPayload = { name: newName, age: Number(newAge), icd11: icd11, ...(disease ? { disease } : {}) }
        const pres = await authFetch('/api/patients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patientPayload) })
        if (!pres.ok) {
          const txt = await pres.text().catch(() => '')
          throw new Error(txt || 'failed to create patient')
        }
        const pdata = await pres.json()
        targetPatientId = pdata.id || pdata._id || null
        if (!targetPatientId) throw new Error('failed to determine created patient id')
      }

      const payload = { icd11: icd11, disease, notes }
      const res = await authFetch(`/api/patients/${targetPatientId}/diagnoses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('failed to add diagnosis')
      
      // Delete the patient assignment notification
      try {
        await authFetch(`/api/notifications/patient/${targetPatientId}`, { method: 'DELETE' })
      } catch (notifErr) {
        console.warn('Failed to delete notification:', notifErr)
        // Don't fail the operation if notification deletion fails
      }
      
      onAdded?.()
      resetForm()
      onClose()
    } catch (err) {
      console.error('add diagnosis error', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={() => { resetForm(); onClose() }} />
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-card border border-border rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Add Diagnosis</h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Patient</label>
            <select value={selected ?? ''} onChange={e => {
              const value = e.target.value
              if (value === '__new__') {
                // switch form into inline "create new patient" mode
                setSelected('__new__')
                setNewName("")
                setNewAge("")
                return
              }
              setSelected(value || null)
            }} className="w-full border border-border rounded-md p-2 bg-background">
              <option value="">Select patient…</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name || p.id}</option>
              ))}
              <option value="__new__">Add new patient</option>
            </select>
            {loadingPatients && <div className="text-xs text-muted-foreground mt-1">Loading patients…</div>}
          </div>

              {selected === '__new__' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">New patient name</label>
                    <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Patient name" />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">New patient age</label>
                    <Input value={String(newAge)} onChange={e => setNewAge(e.target.value ? Number(e.target.value) : "")} type="number" placeholder="Age" />
                  </div>
                </div>
              )}

          

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Disease (search)</label>
            <Input value={query} onChange={e => { setQuery(e.target.value); setIcd11(null); setDisease(e.target.value) }} placeholder="Search disease name e.g. malaria" />
            {loadingSuggestions && <div className="mt-2 text-sm text-muted-foreground">Searching…</div>}
            {error && <div className="mt-2 text-sm text-destructive">{error}</div>}
            {suggestions.length > 0 && (
              <ul className="mt-2 max-h-40 overflow-auto border border-border rounded-md bg-background">
                {suggestions.map(s => (
                  <li key={s.code} className="px-3 py-2 hover:bg-accent cursor-pointer flex justify-between" onClick={() => { setQuery(s.name); setIcd11(s.code); setDisease(s.name); setSuggestions([]) }}>
                    <span className="capitalize">{s.name}</span>
                    <span className="text-sm text-muted-foreground">{s.code}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">ICD-11 Code</label>
            <Input value={icd11 || ""} onChange={e => setIcd11(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Notes</label>
            <textarea value={notes} onChange={e => { setNotes(e.target.value); if (error) setError(null) }} className="w-full border border-border rounded-md p-2 bg-background" rows={4} placeholder="Add clinical notes or observations" />
            {error && <div className="mt-1 text-sm text-destructive">{error}</div>}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => { resetForm(); onClose() }}>Cancel</Button>
            <Button type="submit" disabled={saving || !selected}>{saving ? 'Adding…' : 'Add Diagnosis'}</Button>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}
