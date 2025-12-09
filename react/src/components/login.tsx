
"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Card } from "./ui/card"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../lib/auth"
import { Header } from "./header"
import { Footer } from "./footer"
import DarkVeil from './reactBit'

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

		function setRenderedButtonFullWidth() {
			try {
				const root = googleButtonRef.current
				if (!root) return
				const btn = root.querySelector('button') as HTMLButtonElement | null
				if (btn) {
					btn.style.setProperty('width', '100%', 'important')
					btn.style.display = 'flex'
					btn.style.justifyContent = 'center'
					btn.setAttribute('type', 'button')
					btn.classList.add('w-full')
				}
			} catch (err) {
				console.debug('setRenderedButtonFullWidth failed', err)
			}
		}

		// Watch for the SDK to insert its markup (production timing can vary).
		let observer: MutationObserver | null = null
		function observeAndEnsureFullWidth() {
			setRenderedButtonFullWidth()
			try {
				const root = googleButtonRef.current
				if (!root) return
				if (observer) observer.disconnect()
				observer = new MutationObserver(() => setRenderedButtonFullWidth())
				observer.observe(root, { childList: true, subtree: true })
			} catch (err) {
				console.debug('observeAndEnsureFullWidth failed', err)
			}
		}
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

		// load the Google Identity Services library if not already loaded
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
						observeAndEnsureFullWidth()
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
					observeAndEnsureFullWidth()
				}
			} catch (err) { console.debug('google render failed', err) }
		}

		// cleanup observer when the effect is torn down
		return () => {
			try {
				if (observer) observer.disconnect()
			} catch (e) {}
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
		<main className="min-h-screen bg-background relative">
				{isDark && (
						<DarkVeil hueShift={15} noiseIntensity={0.015} scanlineIntensity={0.01} speed={0.25} warpAmount={0.015} />
					  )}
			<div className="relative z-10">
			
			<Header />

			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
					<div className="hidden md:block">
						{/* Enhanced marketing section */}
						<div className="space-y-8 pr-8">
							<div>
								<h1 className="text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
									<span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-500 to-cyan-400">Welcome back</span>
									<span className="block text-2xl lg:text-3xl font-medium text-muted-foreground mt-2">to HealthSync</span>
								</h1>
								<p className="text-lg text-muted-foreground mt-4 leading-relaxed">Secure access to clinical workflows, patient records, and interoperability tools built for modern healthcare teams.</p>
							</div>
							
							<div className="grid gap-4">
								<div className="flex items-start gap-3">
									<div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-1">
										<div className="w-2 h-2 rounded-full bg-primary"></div>
									</div>
									<div>
										<h3 className="font-semibold text-foreground">HIPAA-Compliant Security</h3>
										<p className="text-sm text-muted-foreground">Enterprise-grade access controls and audit trails</p>
									</div>
								</div>
								<div className="flex items-start gap-3">
									<div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-1">
										<div className="w-2 h-2 rounded-full bg-primary"></div>
									</div>
									<div>
										<h3 className="font-semibold text-foreground">FHIR Interoperability</h3>
										<p className="text-sm text-muted-foreground">Seamless integrations with existing systems</p>
									</div>
								</div>
								<div className="flex items-start gap-3">
									<div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-1">
										<div className="w-2 h-2 rounded-full bg-primary"></div>
									</div>
									<div>
										<h3 className="font-semibold text-foreground">Unified Clinical Data</h3>
										<p className="text-sm text-muted-foreground">Centralized patient records and workflows</p>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div>
					<Card className="max-w-md md:max-w-lg w-full mx-auto p-8 md:p-10 rounded-2xl shadow-2xl backdrop-blur-sm bg-card/98 border border-border/60 shadow-black/10">
						<div className="text-center mb-8">
							<h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Welcome back</h2>
							<p className="text-muted-foreground/80">Sign in to continue to HealthSync EMR</p>
						</div>							<form onSubmit={handleSubmit} className="space-y-6">
								{error && <div className="text-sm text-destructive bg-destructive/15 p-3 rounded-md border border-destructive/30 font-medium">{error}</div>}

								<div className="space-y-2">
									<label className="text-sm font-medium text-foreground block">Email</label>
									<Input
										type="email"
										placeholder="you@clinic.org"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										className="h-12 rounded-lg border-border/80 bg-background/80 focus:border-primary/60 focus:ring-2 focus:ring-primary/25 transition-all shadow-sm"
										required
									/>
								</div>

								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<label className="text-sm font-medium text-foreground">Password</label>
										<Link to="/forgot-password" className="text-sm text-primary underline-offset-2 hover:underline font-medium">
											Forgot password?
										</Link>
									</div>
									<Input
										type="password"
										placeholder="••••••••"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										className="h-12 rounded-lg border-border/80 bg-background/80 focus:border-primary/60 focus:ring-2 focus:ring-primary/25 transition-all shadow-sm"
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

								<div className="space-y-3">
									<Button type="submit" size="lg" className="w-full h-12 rounded-lg shadow-lg bg-gradient-to-r from-sky-500 to-cyan-400 hover:from-sky-600 hover:to-cyan-500 transition-all duration-300 font-semibold" disabled={loading}>
										{loading ? "Signing in…" : "Sign in"}
									</Button>
									<p className="text-xs text-muted-foreground text-center">By continuing you agree to our <a href="#" className="text-primary hover:underline font-medium">Terms</a> and <a href="#" className="text-primary hover:underline font-medium">Privacy Policy</a>.</p>
								</div>

								<div className="space-y-4">
									<div className="flex items-center">
										<span className="flex-grow border-t border-border/60" />
										<span className="px-4 text-xs text-muted-foreground font-medium">Or continue with</span>
										<span className="flex-grow border-t border-border/60" />
									</div>
									
									<div className="text-center flex flex-col items-center space-y-2">
										<div ref={googleButtonRef} className="w-full rounded-lg overflow-hidden shadow-sm" />
										<div className="text-xs text-muted-foreground">Sign in with Google. A PIN will be required.</div>
									</div>
								</div>

								{/* <div className="text-center text-sm text-muted-foreground">
									Don’t have an account?{' '}
									<Link to="/signup" className="text-primary hover:underline">
										Get started
									</Link>
								</div> */}
								<div className="text-center text-sm text-muted-foreground pt-4 border-t border-border/30">
									Want to explore the dashboard?{' '}
									<Link to="/signup" onClick={godummy} className="text-primary hover:underline font-semibold">
										Try the demo account
									</Link>
								</div>
							</form>

							{/* Enhanced PIN modal for Google sign-ins */}
							{showPinModal && (
								<div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="pin-modal-title" onKeyDown={(e) => { if (e.key === 'Escape') { setShowPinModal(false); setGoogleCredential(null); setPinDigits(['', '', '', '']) } }}>
									<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowPinModal(false); setGoogleCredential(null); setPinDigits(['', '', '', '']) }} />
									<div className="relative w-full max-w-md mx-4 bg-card/98 border border-border/60 rounded-2xl shadow-2xl p-8 backdrop-blur-sm">
										<button aria-label="Close dialog" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground text-xl font-bold transition-colors" onClick={() => { setShowPinModal(false); setGoogleCredential(null); setPinDigits(['', '', '', '']) }}>×</button>
										<div className="text-center mb-6">
											<h3 id="pin-modal-title" className="text-xl font-bold text-foreground mb-2">{hasSavedPin ? 'Enter your PIN' : 'Create a 4-digit PIN'}</h3>
											<p className="text-muted-foreground">{hasSavedPin ? 'Enter the 4-digit PIN associated with your account.' : 'Create a 4-digit PIN to protect your Google sign-in.'}</p>
										</div>
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
																className="w-14 h-14 text-center text-xl font-bold rounded-lg border-2 border-border/60 bg-background/90 focus:border-primary/70 focus:ring-2 focus:ring-primary/25 transition-all shadow-sm"
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
												<div className="flex items-center justify-end gap-3 pt-6">
													<button type="button" className="px-6 py-3 border border-border rounded-lg hover:bg-muted/50 transition-colors font-medium" onClick={() => { setShowPinModal(false); setGoogleCredential(null); setPinDigits(['', '', '', '']) }}>Cancel</button>
													<button type="submit" className="px-6 py-3 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 text-white font-semibold hover:from-sky-600 hover:to-cyan-500 transition-all shadow-lg" disabled={googleLoading || pinDigits.some(d => d === '')}>{googleLoading ? 'Signing in…' : 'Continue'}</button>
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
				</div>
			</main>
	)
}

export default Login
