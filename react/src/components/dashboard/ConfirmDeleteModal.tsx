"use client"

import { useState } from "react"
import { Button } from "../ui/button"
import { useAuth } from "@/lib/auth"

export default function ConfirmDeleteModal({ open, onClose, patient, onDeleted }: { open: boolean; onClose: () => void; patient: { id: string; name?: string } | null; onDeleted?: (id: string) => void }) {
  const { authFetch } = useAuth()
  const [deleting, setDeleting] = useState(false)
  if (!open || !patient) return null

  async function handleDelete() {
    if (!patient) return
    setDeleting(true)
    try {
      const res = await authFetch(`/api/patients/${patient.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      onDeleted?.(patient.id)
      onClose()
    } catch (err) {
      console.error('delete error', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-card border border-border rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-2">Delete Patient</h3>
        <p className="text-sm text-muted-foreground mb-4">Are you sure you want to delete <strong>{patient.name || 'this patient'}</strong>? This action cannot be undone.</p>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</Button>
        </div>
        </div>
      </div>
    </div>
  )
}
