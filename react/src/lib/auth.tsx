"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type User = { id: string; email: string; role?: string; profile?: unknown } | null

type AuthContextType = {
  user: User
  loading: boolean
  login: (email: string, password: string, remember?: boolean) => Promise<User>
  loginWithGoogle?: (credential: string, pin: string | undefined, setPinForFuture?: boolean, remember?: boolean) => Promise<User>
  checkGoogleCredential?: (credential: string) => Promise<{ needPin: boolean; hasPin: boolean }>
  signup: (payload: { email: string; password: string; role?: string; profile?: unknown }, remember?: boolean) => Promise<User>
  logout: () => Promise<void>
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function getStoredToken() {
  try {
    return localStorage.getItem('hs_token') || sessionStorage.getItem('hs_token')
  } catch {
    return null
  }
}

function storeToken(token: string, remember = true) {
  try {
    if (remember) localStorage.setItem('hs_token', token)
    else sessionStorage.setItem('hs_token', token)
  } catch {
    console.error("failed to store auth token")
  }
}

function clearToken() {
  try {
    localStorage.removeItem('hs_token')
    sessionStorage.removeItem('hs_token')
  } catch {
    console.error("failed to clear auth token")
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
  const API_BASE = (import.meta.env.VITE_API_URL as string) || 'https://healthsync-fawn.vercel.app'

  async function init() {
      setLoading(true)
      const token = getStoredToken()
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) {
          clearToken()
          if (mounted) setUser(null)
          setLoading(false)
          return
        }
        const data = await res.json()
        if (mounted) setUser(data.user || null)
      } catch {
        clearToken()
        if (mounted) setUser(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    init()
    return () => { mounted = false }
  }, [])

  async function login(email: string, password: string, remember = false) {
    const API_BASE = (import.meta.env.VITE_API_URL as string) || 'https://healthsync-fawn.vercel.app'
    const res = await fetch(`${API_BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Login failed')
    const token: string | undefined = data?.token
    if (token) storeToken(token, remember)
    setUser(data.user || null)
    return data.user || null
  }

  async function loginWithGoogle(credential: string, pin?: string, setPinForFuture = false, remember = false) {
    const API_BASE = (import.meta.env.VITE_API_URL as string) || 'https://healthsync-fawn.vercel.app'
    const res = await fetch(`${API_BASE}/api/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential, pin, setPinForFuture }) })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Google login failed')
    const token: string | undefined = data?.token
    if (token) storeToken(token, remember)
    setUser(data.user || null)
    return data.user || null
  }

  async function checkGoogleCredential(credential: string) {
    const API_BASE = (import.meta.env.VITE_API_URL as string) || 'https://healthsync-fawn.vercel.app'
    const res = await fetch(`${API_BASE}/api/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed')
    return { needPin: !!data.needPin, hasPin: !!data.hasPin }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function signup(payload: { email: string; password: string; role?: string; profile?: any }, remember = false) {
    const API_BASE = (import.meta.env.VITE_API_URL as string) || 'https://healthsync-fawn.vercel.app'
    const res = await fetch(`${API_BASE}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Signup failed')
    const token: string | undefined = data?.token
    if (token) storeToken(token, remember)
    setUser(data.user || null)
    return data.user || null
  }

  async function logout() {
    try {
      const API_BASE = (import.meta.env.VITE_API_URL as string) || 'https://healthsync-fawn.vercel.app'
      await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' })
    } catch (err) {
      // non-fatal logout error (network, etc.)
      // keep client state cleaned up regardless
  console.warn('logout error', err)
    }
    clearToken()
    setUser(null)
    navigate('/login')
  }

  async function authFetch(input: RequestInfo, init?: RequestInit) {
    const token = getStoredToken()
    const headers = { ...(init?.headers as Record<string, string> | undefined), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const API_BASE = (import.meta.env.VITE_API_URL as string) || 'https://healthsync-fawn.vercel.app'
    const url = typeof input === 'string' && input.startsWith('/api') ? `${API_BASE}${input}` : input
    return fetch(url, { ...init, headers })
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, checkGoogleCredential, signup, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default AuthProvider
