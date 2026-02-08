"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { wakeUpBackend } from './keepAlive'

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
    console.debug('[Auth] Token stored successfully (remember=%s)', remember)
  } catch (error) {
    console.error('[Auth] Failed to store auth token:', error)
  }
}

function clearToken() {
  try {
    localStorage.removeItem('hs_token')
    sessionStorage.removeItem('hs_token')
    console.debug('[Auth] Token cleared')
  } catch (error) {
    console.error('[Auth] Failed to clear auth token:', error)
  }
}

/**
 * Enhanced fetch with retry logic and timeout
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 2,
  timeout = 30000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (maxRetries > 0 && error instanceof Error) {
      console.warn(`[Auth] Request failed, retrying... (${maxRetries} attempts left). Error:`, error.message)
      // Wait 500ms before retry
      await new Promise(resolve => setTimeout(resolve, 500))
      return fetchWithRetry(url, options, maxRetries - 1, timeout)
    }
    
    throw error
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000'
  
  console.debug('[Auth] Initializing auth context. API_BASE:', API_BASE)
  console.debug('[Auth] Environment mode:', import.meta.env.MODE)

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        setLoading(true)
        const token = getStoredToken()
        
        if (!token) {
          console.debug('[Auth] No token found, starting with unauthenticated state')
          setLoading(false)
          return
        }

        console.debug('[Auth] Token found, validating with backend...')
        
        const response = await fetchWithRetry(
          `${API_BASE}/api/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) {
          console.warn('[Auth] Token validation failed with status:', response.status)
          if (response.status === 401) {
            clearToken()
          }
          if (mounted) {
            setUser(null)
          }
          return
        }

        // Validate response content type
        const contentType = response.headers.get('content-type')
        if (!contentType?.includes('application/json')) {
          console.error('[Auth] Invalid response content type:', contentType)
          throw new Error('Invalid server response')
        }

        const data = await response.json()
        console.debug('[Auth] User authenticated successfully:', data.user?.email)
        
        if (mounted) {
          setUser(data.user || null)
        }
      } catch (error) {
        console.error('[Auth] Initialization error:', error)
        clearToken()
        if (mounted) {
          setUser(null)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    init()
    
    return () => { 
      console.debug('[Auth] AuthProvider cleanup')
      mounted = false 
    }
  }, [API_BASE])

  async function login(email: string, password: string, remember = false) {
    console.debug('[Auth] Login attempt for:', email)
    
    try {
      // Wake up backend if it's sleeping (Render free tier)
      console.debug('[Auth] Waking up backend...')
      await wakeUpBackend()
      
      const response = await fetchWithRetry(
        `${API_BASE}/api/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ email, password }),
        }
      )

      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        console.error('[Auth] Invalid response content type during login:', contentType)
        throw new Error('Invalid server response. Please try again.')
      }

      const data = await response.json()
      
      if (!response.ok) {
        console.warn('[Auth] Login failed with status:', response.status, 'Error:', data?.error)
        throw new Error(data?.error || data?.message || 'Login failed. Please check your credentials.')
      }

      const token: string | undefined = data?.token
      const userData = data?.user

      if (!token || !userData) {
        console.error('[Auth] Invalid login response: missing token or user data')
        throw new Error('Invalid response from server')
      }

      console.debug('[Auth] Login successful for:', userData.email)
      storeToken(token, remember)
      setUser(userData)
      return userData
    } catch (error) {
      console.error('[Auth] Login error:', error)
      
      if (error instanceof Error) {
        // Provide more user-friendly error messages
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          throw new Error('Request timed out. The server may be waking up. Please try again.')
        }
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new Error('Network error: Unable to connect to the server. Please check your connection.')
        }
        throw error
      }
      
      throw new Error('An unexpected error occurred during login')
    }
  }

  async function loginWithGoogle(credential: string, pin?: string, setPinForFuture = false, remember = false) {
    console.debug('[Auth] Google login attempt')
    
    try {
      const response = await fetchWithRetry(
        `${API_BASE}/api/auth/google`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ credential, pin, setPinForFuture }),
        }
      )

      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        console.error('[Auth] Invalid response content type during Google login:', contentType)
        throw new Error('Invalid server response. Please try again.')
      }

      const data = await response.json()
      
      if (!response.ok) {
        console.warn('[Auth] Google login failed with status:', response.status, 'Error:', data?.error)
        throw new Error(data?.error || data?.message || 'Google login failed')
      }

      const token: string | undefined = data?.token
      const userData = data?.user

      if (!token || !userData) {
        console.error('[Auth] Invalid Google login response: missing token or user data')
        throw new Error('Invalid response from server')
      }

      console.debug('[Auth] Google login successful for:', userData.email)
      storeToken(token, remember)
      setUser(userData)
      return userData
    } catch (error) {
      console.error('[Auth] Google login error:', error)
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.')
        }
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new Error('Network error: Unable to connect to the server.')
        }
        throw error
      }
      
      throw new Error('An unexpected error occurred during Google login')
    }
  }

  async function checkGoogleCredential(credential: string) {
    console.debug('[Auth] Checking Google credential...')
    
    try {
      const response = await fetchWithRetry(
        `${API_BASE}/api/auth/google`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ credential }),
        }
      )

      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        console.error('[Auth] Invalid response content type during credential check:', contentType)
        throw new Error('Invalid server response')
      }

      const data = await response.json()
      
      if (!response.ok) {
        console.warn('[Auth] Credential check failed:', data?.error)
        throw new Error(data?.error || 'Failed to verify Google credential')
      }

      return { needPin: !!data.needPin, hasPin: !!data.hasPin }
    } catch (error) {
      console.error('[Auth] Credential check error:', error)
      throw error instanceof Error ? error : new Error('Credential check failed')
    }
  }

  async function signup(payload: { email: string; password: string; role?: string; profile?: any }, remember = false) {
    console.debug('[Auth] Signup attempt for:', payload.email)
    
    try {
      await wakeUpBackend()
      
      const response = await fetchWithRetry(
        `${API_BASE}/api/auth/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        }
      )

      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        console.error('[Auth] Invalid response content type during signup:', contentType)
        throw new Error('Invalid server response. Please try again.')
      }

      const data = await response.json()
      
      if (!response.ok) {
        console.warn('[Auth] Signup failed with status:', response.status, 'Error:', data?.error)
        throw new Error(data?.error || data?.message || 'Signup failed. Please try again.')
      }

      const token: string | undefined = data?.token
      const userData = data?.user

      if (!token || !userData) {
        console.error('[Auth] Invalid signup response: missing token or user data')
        throw new Error('Invalid response from server')
      }

      console.debug('[Auth] Signup successful for:', userData.email)
      storeToken(token, remember)
      setUser(userData)
      return userData
    } catch (error) {
      console.error('[Auth] Signup error:', error)
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out. The server may be waking up. Please try again.')
        }
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new Error('Network error: Unable to connect to the server. Please check your connection.')
        }
        throw error
      }
      
      throw new Error('An unexpected error occurred during signup')
    }
  }

  async function logout() {
    console.debug('[Auth] Logging out user:', user?.email)
    
    try {
      const token = getStoredToken()
      if (token) {
        await fetchWithRetry(
          `${API_BASE}/api/auth/logout`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        ).catch(err => {
          console.warn('[Auth] Logout API call failed (non-critical):', err)
        })
      }
    } catch (err) {
      console.warn('[Auth] Logout error (non-critical):', err)
    } finally {
      clearToken()
      setUser(null)
      console.debug('[Auth] User logged out, redirecting to login')
      navigate('/login')
    }
  }

  async function authFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
    const token = getStoredToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers as Record<string, string> || {}),
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    // Handle both relative (/api/...) and absolute URLs
    const url = typeof input === 'string' && input.startsWith('/api')
      ? `${API_BASE}${input}`
      : input.toString()

    console.debug('[Auth] authFetch:', url, { hasToken: !!token, method: init.method || 'GET' })
    
    return fetchWithRetry(url, { ...init, headers })
  }

  const value: AuthContextType = {
    user,
    loading,
    login,
    loginWithGoogle,
    checkGoogleCredential,
    signup,
    logout,
    authFetch,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    console.error('[Auth] useAuth called outside of AuthProvider')
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

export default AuthProvider