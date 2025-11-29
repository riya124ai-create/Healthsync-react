
"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Card } from "./ui/card"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../lib/auth"
import { Header } from "./header"
import { Footer } from "./footer"

export function Login() {
 	const navigate = useNavigate()
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [remember, setRemember] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const auth = useAuth()

	const googleButtonRef = useRef<HTMLDivElement | null>(null)
	const [showPinModal, setShowPinModal] = useState(false)
	const [googleCredential, setGoogleCredential] = useState<string | null>(null)
	const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', ''])
	const pinRefs = useRef<HTMLInputElement[]>([])
	const [hasSavedPin, setHasSavedPin] = useState<boolean | null>(null)

	useEffect(() => {
		if (showPinModal) {
			setTimeout(() => { try { pinRefs.current[0]?.focus() } catch (err) { console.debug('focus pin failed', err) } }, 100)
		}
	}, [showPinModal])
	const [googleLoading, setGoogleLoading] = useState(false)
	const [setPinForFuture, setSetPinForFuture] = useState(true)

	useEffect(() => {
		const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
		if (!clientId) return
		function handleCredentialResponse(response: any) {
			if (response && response.credential) {
				const cred = response.credential
				// ask backend whether a PIN already exists for this credential
				if (auth.checkGoogleCredential) {
					auth.checkGoogleCredential(cred).then((info) => {
						setHasSavedPin(info.hasPin)
						setGoogleCredential(cred)
						setShowPinModal(true)
					}).catch((err) => {
						console.debug('check google credential failed', err)
						// fallback: still open PIN modal but assume no saved PIN
						setHasSavedPin(false)
						setGoogleCredential(cred)
						setShowPinModal(true)
					})
				} else {
					setHasSavedPin(null)
					setGoogleCredential(cred)
					setShowPinModal(true)
				}
			}
		}

		// load the Google Identity Services library
		if (!(window as any).google) {
			const s = document.createElement('script')
			s.src = 'https://accounts.google.com/gsi/client'
			s.async = true
			s.defer = true
			s.onload = () => {
				try {
					;(window as any).google.accounts.id.initialize({ client_id: clientId, callback: handleCredentialResponse })
					if (googleButtonRef.current) {
						;(window as any).google.accounts.id.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large' })
					}
				} catch (err) {
					console.debug('google init failed', err)
				}
			}
			document.head.appendChild(s)
		} else {
			try {
				;(window as any).google.accounts.id.initialize({ client_id: clientId, callback: handleCredentialResponse })
				if (googleButtonRef.current) {
					;(window as any).google.accounts.id.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large' })
				}
			} catch (err) { console.debug('google render failed', err) }
		}
	}, [auth])

	async function godummy(e: React.MouseEvent) {
		e.preventDefault()
		setError(null)
		setLoading(true)
		try {
			await auth.login("test@gmail.com", "testacc", false);
			navigate('/dashboard')
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err)
			setError(msg || 'Sign in failed')
		} finally {
			setLoading(false)
		}
	}

	async function handleGooglePinSubmit(e?: React.FormEvent) {
		e?.preventDefault()
		if (!googleCredential) return
		const pin = pinDigits.join('')
		if (!pin || pin.length !== 4) {
			setError('Please enter your 4-digit PIN')
			return
		}
		setGoogleLoading(true)
		setError(null)
		try {
			// uses new auth method added to context
			if (!auth.loginWithGoogle) throw new Error('Google login not supported')
			await auth.loginWithGoogle(googleCredential, pin, setPinForFuture, remember)
			navigate('/dashboard')
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err)
			setError(msg || 'Google sign-in failed')
		} finally {
			setGoogleLoading(false)
			setShowPinModal(false)
			setPinDigits(['', '', '', ''])
			setGoogleCredential(null)
		}
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setError(null)
		if (!email.trim() || !password.trim()) {
			setError("Please provide both email and password.")
			return
		}
		setLoading(true)

		try {
			await auth.login(email.trim(), password, remember)
			navigate('/dashboard')
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err)
			setError(msg || 'Sign in failed')
		} finally {
			setLoading(false)
		}
	}

	return (
		<main className="min-h-screen bg-background">
			<Header />

			<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
					<div className="hidden md:block">
						{/* Small marketing/hero beside the login form to keep theme consistent */}
						<div className="space-y-6">
							<h1 className="text-3xl font-bold text-foreground">Sign in to HealthSync</h1>
							<p className="text-sm text-muted-foreground">Secure access to clinical workflows, patient records, and interoperability tools.</p>
							<ul className="mt-4 space-y-2 text-sm text-muted-foreground">
								<li>• HIPAA-ready access controls</li>
								<li>• Fast FHIR-enabled integrations</li>
								<li>• Centralized clinical data</li>
							</ul>
						</div>
					</div>

					<div>
						<Card className="max-w-md md:max-w-lg lg:max-w-xl w-full mx-auto p-6">
							<h2 className="text-2xl font-semibold text-foreground mb-2">Welcome back</h2>
							<p className="text-sm text-muted-foreground mb-4">Sign in to continue to HealthSync EMR</p>

							<form onSubmit={handleSubmit} className="space-y-4">
								{error && <div className="text-sm text-destructive">{error}</div>}

								<div>
									<label className="text-sm text-muted-foreground block mb-1">Email</label>
									<Input
										type="email"
										placeholder="you@clinic.org"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										required
									/>
								</div>

								<div>
									<div className="flex items-center justify-between mb-1">
										<label className="text-sm text-muted-foreground">Password</label>
										<Link to="/forgot" className="text-sm text-primary underline-offset-2 hover:underline">
											Forgot?
										</Link>
									</div>
									<Input
										type="password"
										placeholder="••••••••"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										required
									/>
								</div>

								<div className="flex items-center justify-between">
									<label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
										<input
											type="checkbox"
											checked={remember}
											onChange={(e) => setRemember(e.target.checked)}
											className="w-4 h-4 rounded border border-input bg-background"
										/>
										Remember me
									</label>
								</div>

								<div>
									<Button type="submit" className="w-full" disabled={loading}>
										{loading ? "Signing in…" : "Sign in"}
									</Button>
								</div>

								<div className="mt-2 text-center">
									<div ref={googleButtonRef} />
									<div className="text-xs text-muted-foreground mt-2">Sign in with Google. A PIN will be required.</div>
								</div>

								{/* <div className="text-center text-sm text-muted-foreground">
									Don’t have an account?{' '}
									<Link to="/signup" className="text-primary hover:underline">
										Get started
									</Link>
								</div> */}
								<div className="text-center text-sm text-muted-foreground">
									Want to explore the dashboard?{' '}
									<Link to="/signup" onClick={godummy} className="text-primary hover:underline">
										Test with demo account
									</Link>
								</div>
							</form>

							{/* PIN modal for Google sign-ins */}
							{showPinModal && (
								<div className="fixed inset-0 z-50 flex items-center justify-center">
									<div className="absolute inset-0 bg-black/50" onClick={() => { setShowPinModal(false); setGoogleCredential(null); setPinDigits(['', '', '', '']) }} />
									<div className="relative w-full max-w-sm mx-4 bg-card border-border rounded-lg shadow-lg p-6">
										<h3 className="text-lg font-semibold mb-2">{hasSavedPin ? 'Enter your PIN' : 'Create a 4-digit PIN'}</h3>
										<p className="text-sm text-muted-foreground mb-3">{hasSavedPin ? 'Enter the 4-digit PIN associated with your account.' : 'Create a 4-digit PIN to protect your Google sign-in.'}</p>
										<form onSubmit={handleGooglePinSubmit} className="space-y-3">
											<div className="flex items-center justify-center gap-2">
												{[0,1,2,3].map((i) => (
													<input
														key={i}
														ref={(el) => { if (el) pinRefs.current[i] = el }}
														inputMode="numeric"
														pattern="[0-9]*"
														maxLength={1}
														value={pinDigits[i]}
														onChange={(e) => {
															const v = e.target.value.replace(/[^0-9]/g, '').slice(0,1)
															setPinDigits(prev => {
																const next = [...prev]
																next[i] = v
																return next
															})
															if (v && pinRefs.current[i+1]) pinRefs.current[i+1].focus()
														}}
														onKeyDown={(e) => {
															if (e.key === 'Backspace') {
																if (pinDigits[i]) {
																	setPinDigits(prev => {
																		const next = [...prev]
																		next[i] = ''
																		return next
																	})
																} else if (pinRefs.current[i-1]) {
																	pinRefs.current[i-1].focus()
																	setPinDigits(prev => {
																		const next = [...prev]
																		next[i-1] = ''
																		return next
																	})
																}
															} else if (e.key === 'ArrowLeft' && pinRefs.current[i-1]) {
																pinRefs.current[i-1].focus()
															} else if (e.key === 'ArrowRight' && pinRefs.current[i+1]) {
																pinRefs.current[i+1].focus()
															}
														}}
														className="w-12 h-12 text-center text-lg rounded-md border border-border bg-input"
														aria-label={`PIN digit ${i+1}`}
													/>
												))}
											</div>
											{!hasSavedPin ? (
												<label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
													<input type="checkbox" checked={setPinForFuture} onChange={(e) => setSetPinForFuture(e.target.checked)} className="w-4 h-4 rounded border border-input bg-background" />
													<span>Save this PIN for future Google sign-ins</span>
												</label>
											) : null}
											<div className="flex items-center justify-end gap-2">
												<button type="button" className="px-3 py-2 border border-border rounded-md" onClick={() => { setShowPinModal(false); setGoogleCredential(null); setPinDigits(['', '', '', '']) }}>Cancel</button>
												<button type="submit" className="px-3 py-2 rounded-md bg-primary text-primary-foreground" disabled={googleLoading || pinDigits.some(d => d === '')}>{googleLoading ? 'Signing in…' : 'Continue'}</button>
											</div>
										</form>
									</div>
								</div>
							)}
							</Card>
						</div>
					</div>
				</div>

				<Footer />
			</main>
	)
}

export default Login
