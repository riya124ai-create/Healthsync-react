"use client"

import React, { useEffect, useState } from "react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { useAuth } from "@/lib/auth"

type Patient = {
  id: string
  name?: string
  age?: number
  icd11?: string
  disease?: string
}

export default function EditPatientModal({ open, onClose, patient, onSaved, onRequestDelete }: { open: boolean; onClose: () => void; patient: Patient | null; onSaved?: (p: Patient) => void; onRequestDelete?: (p: any) => void }) {
  const { authFetch } = useAuth()
  const [name, setName] = useState("")
  const [age, setAge] = useState<number | "">("")
  const [icd11, setIcd11] = useState<string | null>(null)
  const [disease, setDisease] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Array<{ name: string; code: string }>>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!patient) return
    setName(patient.name || "")
    setAge(patient.age ?? "")
    setIcd11(patient.icd11 || null)
    // default disease: prefer the most recent diagnosis if available,
    // otherwise fall back to stored patient.disease
    setDisease(patient.disease || null)
    setQuery(patient.disease || "")
  }, [patient])

  // debounce and fetch ICD-11 suggestions from NLM clinicaltables
  useEffect(() => {
    let cancelled = false
    setSuggestError(null)
    const q = (query || "").trim()
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
                const code = String((item as any).code ?? (item as any).id ?? (item as any).ICD11 ?? '')
                const name = String((item as any).title ?? (item as any).name ?? (item as any).label ?? code)
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
        if (!cancelled) setSuggestError(msg || 'lookup error')
      } finally {
        if (!cancelled) setLoadingSuggestions(false)
      }
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  // When opening the modal, attempt to fetch the patient's diagnoses
  // and prefer the most recent diagnosis as the default disease value.
  useEffect(() => {
    let cancelled = false
    if (!patient) return
    ;(async () => {
      try {
        const res = await authFetch('/api/patients/diagnoses')
        if (!res.ok) return
        const body = await res.json()
        const list: Array<any> = Array.isArray(body.diagnoses) ? body.diagnoses : body.diagnoses || []
        const matches = list.filter(d => String(d.patientId) === String(patient.id))
        if (matches.length === 0) return
        matches.sort((a, b) => {
          const ta = a && a.createdAt ? Date.parse(a.createdAt) : 0
          const tb = b && b.createdAt ? Date.parse(b.createdAt) : 0
          return tb - ta
        })
        const latest = matches[0]
        if (cancelled) return
        if (latest && latest.disease) {
          setDisease(latest.disease)
          setQuery(latest.disease)
        }
      } catch (err) {
        // ignore errors — keep existing patient.disease
      }
    })()

    return () => { cancelled = true }
  }, [patient, authFetch])

  if (!open || !patient) return null

  async function handleSave(e?: React.FormEvent) {
    if(!patient) return
    e?.preventDefault()
    setSaving(true)
    try {
      const payload = { name, age: Number(age), icd11: icd11, disease }
      const res = await authFetch(`/api/patients/${patient.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('update failed')
      const data = await res.json()
      onSaved?.(data)
      onClose()
    } catch (err) {
      console.error('update patient error', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-card border-border rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Edit Patient</h3>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Age</label>
            <Input value={String(age)} onChange={e => setAge(e.target.value ? Number(e.target.value) : "")} type="number" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Disease (search)</label>
            <Input value={query} onChange={e => { setQuery(e.target.value); setIcd11(null); setDisease(e.target.value) }} placeholder="Search disease name e.g. malaria" />
            {loadingSuggestions && <div className="mt-2 text-sm text-muted-foreground">Searching…</div>}
            {suggestError && <div className="mt-2 text-sm text-destructive">{suggestError}</div>}
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
          <div className="flex items-center justify-between gap-2">
            <div>
              <Button variant="destructive" type="button" onClick={() => onRequestDelete?.(patient!)}>Delete</Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
