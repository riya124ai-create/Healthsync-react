"use client"

import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../lib/auth"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Card } from "../components/ui/card"
import { Eye, EyeOff } from "lucide-react"

export default function Signup() {
  const navigate = useNavigate()
  const { signup } = useAuth()
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    role: "doctor" as "doctor" | "organization"
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const [passwordChecks, setPasswordChecks] = useState({
    upper: false,
    lower: false,
    digit: false,
    symbol: false,
    length: false,
  })
  
  const passwordValid = Object.values(passwordChecks).every(Boolean)

  // Redirect if already authenticated
  useEffect(() => {
    const token = localStorage.getItem('hs_token') || sessionStorage.getItem('hs_token')
    if (token) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate])

  // Validate password on change
  useEffect(() => {
    const hasUpper = /[A-Z]/.test(formData.password)
    const hasLower = /[a-z]/.test(formData.password)
    const hasDigit = /\d/.test(formData.password)
    const hasSymbol = /[^A-Za-z0-9]/.test(formData.password)
    const meetsLength = formData.password.length >= 8

    setPasswordChecks({
      upper: hasUpper,
      lower: hasLower,
      digit: hasDigit,
      symbol: hasSymbol,
      length: meetsLength,
    })
  }, [formData.password])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validation
    if (!formData.email.trim() || !formData.password.trim() || !formData.fullName.trim()) {
      setError("Please fill in all required fields.")
      return
    }

    if (!passwordValid) {
      setError("Password must meet all requirements.")
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)

    try {
      // For simplicity, using doctor role with basic profile
      // The backend supports both doctor and organization roles
      const payload = {
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        profile: {
          name: formData.fullName.trim(),
        }
      }

      await signup(payload)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Create Account</h1>
          <p className="text-muted-foreground mt-2">Sign up for HealthSync</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-destructive/15 border border-destructive/30 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="fullName" className="text-sm font-medium text-foreground">
              Full Name
            </label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              placeholder="Dr. Jane Smith"
              value={formData.fullName}
              onChange={handleChange}
              required
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@clinic.org"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            {formData.password && (
              <div className="text-xs space-y-1 bg-muted/30 border border-border/40 px-3 py-2 rounded-md">
                <div className="font-semibold text-foreground">Password must include:</div>
                {[
                  { key: "upper", label: "Uppercase letter (A-Z)" },
                  { key: "lower", label: "Lowercase letter (a-z)" },
                  { key: "digit", label: "Number (0-9)" },
                  { key: "symbol", label: "Symbol (!@#$)" },
                  { key: "length", label: "At least 8 characters" },
                ].map(({ key, label }) => {
                  const met = passwordChecks[key as keyof typeof passwordChecks]
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-2 ${met ? 'text-emerald-600' : 'text-muted-foreground'} ${!met ? 'line-through opacity-50' : ''}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: met ? '#10b981' : '#6b7280' }} />
                      <span>{label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
              Confirm Password
            </label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !passwordValid || formData.password !== formData.confirmPassword}
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-semibold">
              Sign in
            </Link>
          </div>
        </form>
      </Card>
    </div>
  )
}
