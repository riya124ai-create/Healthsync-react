"use client"

import React, { useState, useEffect } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Card } from "./ui/card"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from '../lib/auth'
import { wakeUpBackend } from '../lib/keepAlive'
import { Header } from "./header"
import { Footer } from "./footer"
import DarkVeil from './reactBit'

interface Organization {
  id: string
  name: string
}

/**
 * Enhanced fetch with retry logic and timeout
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 2,
  timeout = 15000
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
      console.warn(`[Signup] Request failed, retrying... (${maxRetries} attempts left). Error:`, error.message)
      await new Promise(resolve => setTimeout(resolve, 500))
      return fetchWithRetry(url, options, maxRetries - 1, timeout)
    }
    
    throw error
  }
}

export function Signup() {
  const navigate = useNavigate()
  const auth = useAuth()
  
  // role: 'doctor' or 'organization'
  const [role, setRole] = useState<"doctor" | "organization">("doctor")

  // Doctor fields
  const [doctorName, setDoctorName] = useState("")
  const [license, setLicense] = useState("")
  const [specialty, setSpecialty] = useState("")
  // Selected organization for doctors (mandatory)
  const [selectedOrg, setSelectedOrg] = useState("")
  // Organization options from API
  const [orgOptions, setOrgOptions] = useState<Organization[]>([])
  const [orgsLoading, setOrgsLoading] = useState(false)
  const [orgsError, setOrgsError] = useState<string | null>(null)

  // Organization fields
  const [orgName, setOrgName] = useState("")
  const [adminName, setAdminName] = useState("")

  // Common fields
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordChecks, setPasswordChecks] = useState({
    upper: false,
    lower: false,
    digit: false,
    symbol: false,
    length: false,
  })
  const [passwordValid, setPasswordValid] = useState(false)
  const [passwordHint, setPasswordHint] = useState("")
  const [isDark, setIsDark] = useState<boolean>(false)

  // Monitor theme changes
  useEffect(() => {
    const checkTheme = () => {
      const isDarkMode = document.documentElement.classList.contains('dark')
      setIsDark(isDarkMode)
    }

    checkTheme()

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkTheme()
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  // Fetch organizations from API with better error handling
  useEffect(() => {
    let mounted = true
    
    async function loadOrgs() {
      // Skip loading organizations if user is signing up as organization
      if (role !== 'doctor') {
        setOrgOptions([])
        return
      }

      setOrgsLoading(true)
      setOrgsError(null)
      
      try {
        console.debug('[Signup] Loading organizations...')
        await wakeUpBackend()
        
        const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000'
        const res = await fetchWithRetry(`${API_BASE}/api/organizations`)
        
        if (!res.ok) {
          console.error('[Signup] Failed to load organizations. Status:', res.status)
          setOrgsError('Failed to load organizations. Please refresh the page.')
          return
        }
        
        const data = await res.json()
        console.debug('[Signup] Organizations loaded:', data.organizations?.length)
        
        if (mounted && Array.isArray(data.organizations)) {
          setOrgOptions(data.organizations)
        }
      } catch (error) {
        console.error('[Signup] Error loading organizations:', error)
        setOrgsError('Unable to load organizations. Please check your connection and try again.')
      } finally {
        if (mounted) {
          setOrgsLoading(false)
        }
      }
    }

    loadOrgs()
    return () => { mounted = false }
  }, [role])

  // Evaluate password strength client-side
  useEffect(() => {
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasDigit = /\d/.test(password)
    const hasSymbol = /[^A-Za-z0-9]/.test(password)
    const meetsLength = password.length >= 8

    setPasswordChecks({
      upper: hasUpper,
      lower: hasLower,
      digit: hasDigit,
      symbol: hasSymbol,
      length: meetsLength,
    })

    const valid = hasUpper && hasLower && hasDigit && hasSymbol && meetsLength
    setPasswordValid(valid)

    if (!password) {
      setPasswordHint("")
      return
    }

    if (!valid) {
      setPasswordHint("Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.")
    } else {
      setPasswordHint("")
    }
  }, [password])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Basic validation per role
    if (role === "doctor") {
      if (!doctorName.trim() || !email.trim() || !password.trim()) {
        setError("Please complete your name, email and password.")
        return
      }
      if (!selectedOrg) {
        setError("Please select your organization from the list.")
        return
      }
    } else {
      if (!orgName.trim() || !adminName.trim() || !email.trim() || !password.trim()) {
        setError("Please complete organization name, admin name, email and password.")
        return
      }
    }

    if (!passwordValid) {
      setError("Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.")
      return
    }

    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address")
      return
    }

    setLoading(true)
    
    try {
      console.debug('[Signup] Submitting signup form for:', email)
      
      const payload = role === "doctor"
        ? { 
            email, 
            password, 
            role, 
            profile: { 
              name: doctorName.trim(), 
              license: license.trim(), 
              specialty: specialty.trim(), 
              organizationId: selectedOrg 
            } 
          }
        : { 
            email, 
            password, 
            role, 
            profile: { 
              organization: orgName.trim(), 
              admin: adminName.trim() 
            } 
          }

      await auth.signup(payload)
      console.debug('[Signup] Signup successful, navigating to dashboard')
      navigate('/dashboard')
    } catch (err: unknown) {
      console.error('[Signup] Signup failed:', err)
      
      const msg = err instanceof Error ? err.message : String(err)
      
      // Provide user-friendly error messages based on error type
      let userMessage = 'Signup failed. Please try again.'
      
      if (msg.includes('already exists') || msg.includes('409')) {
        userMessage = 'An account with this email already exists. Please login instead.'
      } else if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
        userMessage = 'Network error: Unable to connect to the server. Please check your connection and try again.'
      } else if (msg.includes('timeout') || msg.includes('AbortError')) {
        userMessage = 'Request timed out. The server may be waking up. Please try again in a few seconds.'
      } else if (msg.includes('401')) {
        userMessage = 'Authentication failed. Please check your credentials.'
      } else if (msg.length > 0) {
        userMessage = msg
      }
      
      setError(userMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background relative">
      {isDark && (
        <DarkVeil hueShift={15} noiseIntensity={0.015} scanlineIntensity={0.01} speed={0.25} warpAmount={0.015} />
      )}
      
      <div className="relative z-10">
        <Header />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="hidden md:block">
              <div className="space-y-8 pr-8">
                <div>
                  <h1 className="text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-cyan-400">Join HealthSync</span>
                    <span className="block text-2xl lg:text-3xl font-medium text-muted-foreground mt-2">today</span>
                  </h1>
                  <p className="text-lg text-muted-foreground mt-4 leading-relaxed">Start a secure, interoperable EMR for your clinic or team. Invite colleagues, configure integrations, and import patient data.</p>
                </div>
                
                <div className="grid gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Quick Setup</h3>
                      <p className="text-sm text-muted-foreground">Get started in under 5 minutes</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Multi-Role Support</h3>
                      <p className="text-sm text-muted-foreground">Individual doctors and organizations</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Secure & Compliant</h3>
                      <p className="text-sm text-muted-foreground">HIPAA-compliant infrastructure</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Card className="max-w-md md:max-w-lg lg:max-w-xl w-full mx-auto p-6 md:p-8 rounded-2xl shadow-2xl backdrop-blur-sm bg-card/95 border-border/50">
                <div className="text-center mb-6">
                  <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1">Get started with HealthSync</h2>
                  <p className="text-sm text-muted-foreground">Create your account and start building better healthcare workflows</p>
                </div>

                {/* Enhanced Role toggle */}
                <div className="flex gap-1 mb-4 p-1 bg-muted/40 rounded-xl border border-border/30">
                  <button
                    type="button"
                    onClick={() => setRole("doctor")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${role === "doctor" ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 text-white shadow-lg transform scale-[1.02]' : 'text-muted-foreground hover:text-foreground hover:bg-background/60'}`}>
                    Doctor
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("organization")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${role === "organization" ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 text-white shadow-lg transform scale-[1.02]' : 'text-muted-foreground hover:text-foreground hover:bg-background/60'}`}>
                    Organization
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="text-sm text-destructive bg-destructive/15 p-3 rounded-md border border-destructive/30 font-medium">
                      {error}
                    </div>
                  )}

                  {role === "doctor" ? (
                    <>
                      <div>
                        <label className="text-sm font-medium text-foreground block mb-1">Full name *</label>
                        <Input 
                          value={doctorName} 
                          onChange={(e) => setDoctorName(e.target.value)} 
                          placeholder="Dr. Jane Smith" 
                          className="h-10 rounded-lg border-border/80 bg-background/80 focus:border-primary/60 focus:ring-2 focus:ring-primary/25 transition-all shadow-sm" 
                          required 
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium text-foreground block mb-1">License (optional)</label>
                          <Input 
                            value={license} 
                            onChange={(e) => setLicense(e.target.value)} 
                            placeholder="License #" 
                            className="h-10 rounded-lg border-border/80 bg-background/80 focus:border-primary/60 focus:ring-2 focus:ring-primary/25 transition-all shadow-sm" 
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground block mb-1">Specialty (optional)</label>
                          <Input 
                            value={specialty} 
                            onChange={(e) => setSpecialty(e.target.value)} 
                            placeholder="Cardiology" 
                            className="h-10 rounded-lg border-border/80 bg-background/80 focus:border-primary/60 focus:ring-2 focus:ring-primary/25 transition-all shadow-sm" 
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-foreground block mb-1">Organization *</label>
                        {orgsLoading ? (
                          <div className="h-10 rounded-lg border border-border/80 bg-muted/30 flex items-center px-3">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="ml-2 text-sm text-muted-foreground">Loading organizations...</span>
                          </div>
                        ) : orgsError ? (
                          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 p-2 rounded-md">
                            {orgsError}
                          </div>
                        ) : (
                          <select
                            value={selectedOrg}
                            onChange={(e) => setSelectedOrg(e.target.value)}
                            required
                            className="flex h-10 w-full rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/25 transition-all shadow-sm"
                          >
                            <option value="" className="text-sm text-foreground bg-background">
                              {orgOptions.length > 0 ? 'Select organization...' : 'No organizations available'}
                            </option>
                            {orgOptions.map((o) => (
                              <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium text-foreground block mb-1">Organization name *</label>
                        <Input 
                          value={orgName} 
                          onChange={(e) => setOrgName(e.target.value)} 
                          placeholder="Your Clinic or Hospital" 
                          className="h-10 rounded-lg border-border/60 bg-background/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all" 
                          required 
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-foreground block mb-1">Admin contact *</label>
                        <Input 
                          value={adminName} 
                          onChange={(e) => setAdminName(e.target.value)} 
                          placeholder="Administrator name" 
                          className="h-10 rounded-lg border-border/60 bg-background/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all" 
                          required 
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1">Email *</label>
                    <Input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      placeholder="you@clinic.org" 
                      className="h-10 rounded-lg border-border/60 bg-background/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all" 
                      required 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1">Password *</label>
                      <Input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="Create password" 
                        className="h-10 rounded-lg border-border/60 bg-background/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all" 
                        required 
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1">Confirm *</label>
                      <Input 
                        type="password" 
                        value={confirm} 
                        onChange={(e) => setConfirm(e.target.value)} 
                        placeholder="Confirm password" 
                        className="h-10 rounded-lg border-border/60 bg-background/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all" 
                        required 
                      />
                    </div>
                  </div>

                  <div className="text-xs text-foreground/80 bg-muted/30 border border-border/40 px-3 py-2 rounded-md space-y-1">
                    <div className="font-semibold">Password must include:</div>
                    {[
                      { key: "upper", label: "An uppercase letter (A-Z)" },
                      { key: "lower", label: "A lowercase letter (a-z)" },
                      { key: "digit", label: "A number (0-9)" },
                      { key: "symbol", label: "A symbol (e.g. !@#$)" },
                      { key: "length", label: "At least 8 characters" },
                    ].map(({ key, label }) => {
                      const met = passwordChecks[key as keyof typeof passwordChecks]
                      return (
                        <div
                          key={key}
                          className={`flex items-center gap-2 ${met ? 'text-emerald-600' : 'text-destructive'} ${met ? '' : 'line-through'}`}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: met ? '#10b981' : '#ef4444' }}></span>
                          <span>{label}</span>
                        </div>
                      )
                    })}
                  </div>
                  
                  {!passwordValid && passwordHint && (
                    <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 px-3 py-2 rounded-md">
                      {passwordHint}
                    </div>
                  )}

                  <div className="space-y-2 pt-2">
                    <Button 
                      type="submit" 
                      className="w-full h-10 rounded-lg shadow-lg bg-gradient-to-r from-emerald-500 to-cyan-400 hover:from-emerald-600 hover:to-cyan-500 transition-all duration-300 font-semibold" 
                      disabled={loading || (role === 'doctor' && orgsLoading)}
                    >
                      {loading ? (
                        <span className="flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          {role === 'doctor' ? 'Creating account...' : 'Setting up organization...'}
                        </span>
                      ) : 'Create account'}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      By continuing you agree to our <a href="#" className="text-primary hover:underline font-medium">Terms</a> and <a href="#" className="text-primary hover:underline font-medium">Privacy Policy</a>.
                    </p>
                  </div>

                  <div className="text-center text-sm text-muted-foreground pt-3 border-t border-border/30">
                    Already have an account?{' '}
                    <Link to="/login" className="text-primary hover:underline font-semibold">
                      Sign in
                    </Link>
                  </div>
                </form>
              </Card>
            </div>
          </div>
        </div>
        
        <Footer />
      </div>
    </main>
  )
}

export default Signup
