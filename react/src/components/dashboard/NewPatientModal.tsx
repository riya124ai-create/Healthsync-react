"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { useAuth } from "@/lib/auth"

type Props = {
  open: boolean
  onClose: () => void
  onCreated?: (patientId: string) => void
  orgId?: string | null
}

export default function NewPatientModal({ open, onClose, onCreated, orgId }: Props) {
  const { authFetch } = useAuth()
  const [name, setName] = useState("")
  const [age, setAge] = useState<number | "">("")
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Array<{ name: string; code: string }>>([])
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setName("")
      setAge("")
      setQuery("")
      setSuggestions([])
  setSelectedCode(null)
  setSelectedName(null)
  setSaving(false)
    }
  }, [open])

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
  // call NLM ClinicalTables ICD-11 endpoint directly from the frontend
  const url = `https://clinicaltables.nlm.nih.gov/api/icd11_codes/v3/search?terms=${encodeURIComponent(q)}&maxList=15`
        const res = await fetch(url)
  if (!res.ok) throw new Error(`icd lookup failed ${res.status}`)
  const data: unknown = await res.json()

  // data shapes may vary. Try to parse common patterns.
  // DEBUG: log raw response for troubleshooting
  console.debug('ICD raw data:', data)
        const parsed: Array<{ name: string; code: string }> = []
        if (Array.isArray(data)) {
          // Common ClinicalTables response: [terms, resultsArray, meta?, detailedResults]
          // Sometimes data[1] is an array of codes and data[3] contains arrays like [code, label, ...]
          const maybeResults = data[1]
          const maybeDetails = data[3]

          if (Array.isArray(maybeResults) && maybeResults.length > 0 && typeof maybeResults[0] === 'string' && Array.isArray(maybeDetails)) {
            // use detailed results in data[3]
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
                // try [code, label, ...]
                const code = String(item[0] ?? '')
                const name = String(item[1] ?? item[2] ?? code)
                parsed.push({ name, code })
              } else if (item && typeof item === 'object') {
                const code = String(item.code ?? item.id ?? item.ICD11 ?? '')
                const name = String(item.title ?? item.name ?? item.label ?? code)
                parsed.push({ name, code })
              } else if (typeof item === 'string') {
                // fallback: code-only in list; try to pair with details if available
                const code = item
                parsed.push({ name: code, code })
              }
            }
          }
        } else if (data && typeof data === 'object') {
          // fallback: object with results
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

  console.debug('ICD parsed suggestions:', parsed.slice(0, 15))
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


  // Disease / ICD selection is optional for quick patient creation
  const canSubmit = useMemo(() => !!name && !!age, [name, age])

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!canSubmit) return
    setSaving(true)
  const payload = { name, age: Number(age), icd11: selectedCode, disease: selectedName || query }
    try {
      // POST to backend; if orgId provided, create under that organization
      if (authFetch) {
        const endpoint = orgId ? `/api/organizations/${orgId}/patients` : '/api/patients'
        const res = await authFetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) throw new Error('failed')
        const data = await res.json().catch(() => null)
        const newId = data?.id || data?._id || null
        if (newId && typeof onCreated === 'function') onCreated(String(newId))
      } else {
        console.log('patient payload (no authFetch):', payload)
      }
      onClose()
    } catch (err) {
      console.error('save failed', err)
      // keep modal open
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-card border border-border rounded-lg shadow-lg p-6">
        <h2 className="text-lg font-semibold mb-4">New Patient Record</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Patient Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Age</label>
            <Input value={String(age)} onChange={e => setAge(e.target.value ? Number(e.target.value) : "")} placeholder="Age" type="number" />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Disease (optional — search)</label>
            <Input value={query} onChange={e => { setQuery(e.target.value); setSelectedCode(null); setSelectedName(null) }} placeholder="Search disease name (optional) e.g. malaria" />
            {loadingSuggestions && <div className="mt-2 text-sm text-muted-foreground">Searching…</div>}
            {suggestError && <div className="mt-2 text-sm text-destructive">{suggestError}</div>}
            {suggestions.length > 0 && (
              <ul className="mt-2 max-h-40 overflow-auto border border-border rounded-md bg-background">
                {suggestions.map(s => (
                  <li key={s.code} className="px-3 py-2 hover:bg-accent cursor-pointer flex justify-between" onClick={() => { setQuery(s.name); setSelectedCode(s.code); setSelectedName(s.name); setSuggestions([]) }}>
                    <span className="capitalize">{s.name}</span>
                    <span className="text-sm text-muted-foreground">{s.code}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">ICD-11 Code</label>
            <Input value={selectedCode || ""} readOnly placeholder="Select a disease to populate code" />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
            <Button type="submit" disabled={!canSubmit || saving}>{saving ? 'Saving…' : 'Create Record'}</Button>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}
