"use client"

import React, { useState, useEffect } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Card } from "./ui/card"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from '../lib/auth'
import { Header } from "./header"
import { Footer } from "./footer"
import DarkVeil from './reactBit'

export function Signup() {
  const navigate = useNavigate()
  // role: 'doctor' or 'organization'
  const [role, setRole] = useState<"doctor" | "organization">("doctor")

  // Doctor fields
  const [doctorName, setDoctorName] = useState("")
  const [license, setLicense] = useState("")
  const [specialty, setSpecialty] = useState("")
  // Selected organization for doctors (mandatory)
  const [selectedOrg, setSelectedOrg] = useState("")
  // Example org options - replace with API-driven list as needed
  const [orgOptions, setOrgOptions] = useState<Array<{ id: string; name: string }>>([])

  // fetch organizations from API
  useEffect(() => {
    let mounted = true
    async function loadOrgs() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/organizations`)
        console.log("organization",res);
        if (!res.ok) return
        const data = await res.json()
        if (mounted && Array.isArray(data.organizations)) setOrgOptions(data.organizations)
      } catch {
        // ignore
      }
    }
    loadOrgs()
    return () => { mounted = false }
  }, [])

  // Organization fields
  const [orgName, setOrgName] = useState("")
  const [adminName, setAdminName] = useState("")

  // Common fields
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const auth = useAuth()
  const [isDark, setIsDark] = useState<boolean>(false);

  // Monitor theme changes
  useEffect(() => {
    const checkTheme = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');
      setIsDark(isDarkMode);
    };

    // Check initial theme
    checkTheme();

    // Watch for theme changes using MutationObserver
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Basic validation per role
    if (role === "doctor") {
      if (!doctorName.trim() || !email.trim() || !password.trim()) {
        setError("Please complete your name, email and password.")
        return
      }
      // if (!license.trim()) {
      //   setError("Please enter your medical license number.")
      //   return
      // }
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

    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)
    try {
      const payload = role === "doctor"
        ? { email, password, role, profile: { name: doctorName, license, specialty, organizationId: selectedOrg } }
        : { email, password, role, profile: { organization: orgName, admin: adminName } }

  await auth.signup(payload)
  navigate('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || 'Signup failed')
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
                {error && <div className="text-sm text-destructive bg-destructive/15 p-3 rounded-md border border-destructive/30 font-medium">{error}</div>}

        {role === "doctor" ? (
          <>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">Full name *</label>
                  <Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Dr. Jane Smith" className="h-10 rounded-lg border-border/80 bg-background/80 focus:border-primary/60 focus:ring-2 focus:ring-primary/25 transition-all shadow-sm" required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1">License (optional)</label>
                    <Input value={license} onChange={(e) => setLicense(e.target.value)} placeholder="License #" className="h-10 rounded-lg border-border/80 bg-background/80 focus:border-primary/60 focus:ring-2 focus:ring-primary/25 transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1">Specialty (optional)</label>
                    <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Cardiology" className="h-10 rounded-lg border-border/80 bg-background/80 focus:border-primary/60 focus:ring-2 focus:ring-primary/25 transition-all shadow-sm" />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">Organization *</label>
                  <select
                    value={selectedOrg}
                    onChange={(e) => setSelectedOrg(e.target.value)}
                    required
                    className="flex h-10 w-full rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/25 transition-all shadow-sm"
                  >
                    <option value="" className="text-sm text-foreground bg-background">Select organization...</option>
                    {orgOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
          </>
        ) : (
          <>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">Organization name *</label>
                  <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Your Clinic or Hospital" className="h-10 rounded-lg border-border/60 bg-background/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all" required />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">Admin contact *</label>
                  <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Administrator name" className="h-10 rounded-lg border-border/60 bg-background/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all" required />
                </div>
          </>
        )}

                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">Email *</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@clinic.org" className="h-10 rounded-lg border-border/60 bg-background/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all" required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1">Password *</label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create password" className="h-10 rounded-lg border-border/60 bg-background/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1">Confirm *</label>
                    <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" className="h-10 rounded-lg border-border/60 bg-background/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all" required />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Button type="submit" className="w-full h-10 rounded-lg shadow-lg bg-gradient-to-r from-emerald-500 to-cyan-400 hover:from-emerald-600 hover:to-cyan-500 transition-all duration-300 font-semibold" disabled={loading}>
                    {loading ? (role === 'doctor' ? 'Creating account…' : 'Setting up org…') : 'Create account'}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">By continuing you agree to our <a href="#" className="text-primary hover:underline font-medium">Terms</a> and <a href="#" className="text-primary hover:underline font-medium">Privacy Policy</a>.</p>
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
