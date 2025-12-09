"use client"

import { useEffect, useState, useRef } from "react"
import { Search, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type ICDItem = {
	id: string
	icd: string
	title: string
	description?: string
}

type ICDDetail = {
	code: string
	title: string
	definition?: string
	longDefinition?: string
	synonyms?: string[]
	symptoms?: string[]
	causes?: string[]
	riskFactors?: string[]
	diagnosis?: string[]
	treatment?: string[]
	prevention?: string[]
	prognosis?: string
	complications?: string[]
	prevalence?: string
	clinicalNotes?: string[]
}

export default function ICD11Sidebar({ onSelectAction }: { onSelectAction?: (item: ICDItem) => void }) {
	const [query, setQuery] = useState("")
	const [results, setResults] = useState<ICDItem[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [detailedInfo, setDetailedInfo] = useState<ICDDetail | null>(null)
	const [loadingDetails, setLoadingDetails] = useState(false)
	const [showResults, setShowResults] = useState(true)
	const [isSelectionActive, setIsSelectionActive] = useState(false)
	const [canScrollUp, setCanScrollUp] = useState(false)
	const [canScrollDown, setCanScrollDown] = useState(false)
	const scrollRef = useRef<HTMLDivElement>(null)
	const detailScrollRef = useRef<HTMLDivElement>(null)

	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const element = e.currentTarget
		setCanScrollUp(element.scrollTop > 0)
		setCanScrollDown(
			element.scrollTop < element.scrollHeight - element.clientHeight - 1
		)
	}

	useEffect(() => {
		if (!query.trim()) {
			setResults([])
			setError(null)
			setShowResults(true)
			setIsSelectionActive(false)
			return
		}

		// Don't fetch results if a selection is active
		if (isSelectionActive) {
			return
		}

		// Show results when user types
		setShowResults(true)

		const timer = setTimeout(() => {
			fetchResults(query)
		}, 300)

		return () => clearTimeout(timer)
	}, [query, isSelectionActive])

	async function fetchResults(q: string) {
		setLoading(true)
		setError(null)
		try {
			const res = await fetch(
				`https://clinicaltables.nlm.nih.gov/api/icd11_codes/v3/search?terms=${encodeURIComponent(q)}&maxList=12`
			)
			if (!res.ok) throw new Error("Network error")
			const data = await res.json()
			const codes = data[1] || []
			const entries = (data[3] || []).map((e: any[]) => ({ title: e[1] }))
			const mapped = codes.map((code: string, i: number) => ({
				id: code,
				icd: code,
				title: entries[i]?.title || code,
				description: "",
			}))
			setResults(mapped)
			// Check scroll after results are rendered
			setTimeout(() => {
				if (scrollRef.current) {
					const el = scrollRef.current
					setCanScrollDown(el.scrollHeight > el.clientHeight)
					setCanScrollUp(false)
				}
			}, 100)
		} catch (err: any) {
			setError(err?.message || "Error searching ICD-11")
			setResults([])
		} finally {
			setLoading(false)
		}
	}

	async function fetchDetailedInfo(icdCode: string) {
		setLoadingDetails(true)
		const selectedItem = results.find(r => r.icd === icdCode)
		const diseaseName = selectedItem?.title || icdCode
		
		try {
			const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000'
			
			// Call backend Gemini API endpoint
			const response = await fetch(`${API_BASE}/api/groq/disease-info`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					icdCode,
					diseaseName
				})
			})

			if (!response.ok) {
				throw new Error('Failed to generate disease information')
			}

			const result = await response.json()
			
			if (result.success && result.data) {
				const aiData = result.data
				const detail: ICDDetail = {
					code: icdCode,
					title: aiData.title || diseaseName,
					definition: aiData.definition || '',
					longDefinition: aiData.longDefinition || '',
					synonyms: aiData.synonyms || [],
					symptoms: aiData.symptoms || [],
					causes: aiData.causes || [],
					riskFactors: aiData.riskFactors || [],
					diagnosis: aiData.diagnosis || [],
					treatment: aiData.treatment || [],
					prevention: aiData.prevention || [],
					prognosis: aiData.prognosis || '',
					complications: aiData.complications || [],
					prevalence: aiData.prevalence || '',
					clinicalNotes: aiData.clinicalNotes || []
				}
				
				setDetailedInfo(detail)
			} else {
				throw new Error('Invalid response format')
			}
		} catch (err) {
			console.error('Error fetching disease details:', err)
			// Fallback with basic information
			setDetailedInfo({
				code: icdCode,
				title: diseaseName,
				definition: `${diseaseName} is classified under ICD-11 code ${icdCode}.`,
				clinicalNotes: [
					'AI-generated medical information could not be retrieved at this time.',
					'Please refer to medical databases or consult with healthcare professionals for detailed information.'
				]
			})
		} finally {
			setLoadingDetails(false)
		}
	}

	function handleSelect(item: ICDItem) {
		setSelectedId(item.id)
		setShowResults(false) // Hide search results
		setIsSelectionActive(true) // Mark that a selection is active
		setQuery(`${item.title} (${item.icd})`) // Set selected item in input
		setCanScrollUp(false) // Reset scroll indicators
		setCanScrollDown(false)
		fetchDetailedInfo(item.icd)
		onSelectAction?.(item)
		// Check scroll for detail section after data loads
		setTimeout(() => {
			if (detailScrollRef.current) {
				const el = detailScrollRef.current
				setCanScrollDown(el.scrollHeight > el.clientHeight)
			}
		}, 500)
	}

	return (
		<Card className="p-3 bg-card border-border">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-sm font-semibold text-foreground">ICD-11 Lookup</h3>
			</div>

			<div className="relative">
				<input   
					aria-label="Search ICD-11"
					value={query}
					onChange={(e) => {
						setIsSelectionActive(false) // Allow new searches when user types
						setQuery(e.target.value)
					}}
					placeholder="Search ICD-11 — e.g. diabetes, heart"
					className="w-full pl-9 pr-3 h-9 rounded-md border border-border bg-input text-sm"
				/>
				<div className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
					<Search className="w-4 h-4" />
				</div> 
			</div>

		{showResults && (
			<div className="relative mt-3">
				{canScrollUp && (
					<div className="absolute top-0 left-0 right-0 h-8 bg-linear-to-b from-card to-transparent z-10 flex items-start justify-center pointer-events-none">
						<ChevronUp className="w-5 h-5 text-primary" />
					</div>
				)}
				<div 
					ref={scrollRef}
					className="max-h-56 overflow-auto" 
					style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
					onScroll={handleScroll}
				>
					{loading && <p className="text-xs text-muted-foreground">Searching…</p>}
					{error && <p className="text-xs text-destructive">{error}</p>}
					{!loading && results.length === 0 && query.trim() !== "" && (
						<p className="text-xs text-muted-foreground">No matches</p>
					)}

					<ul className="space-y-2">
					{results.map((r) => (
						<li key={r.id}>
							<div
								role="button"
								tabIndex={0}
								onClick={() => handleSelect(r)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault()
										handleSelect(r)
									}
								}}
								className={`w-full text-left p-2 rounded-md transition hover:bg-accent/5 ${selectedId === r.id ? 'bg-accent/10' : ''}`}
							>
								<div className="flex items-center justify-between">
									<div>
										<div className="text-sm font-medium text-foreground">{r.title}</div>
										<div className="text-xs text-muted-foreground">ICD: {r.icd}</div>
									</div>
									<div>
										<Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); handleSelect(r) }}>
											View Details
										</Button>
									</div>
								</div>
							</div>
							</li>
					))}
				</ul>
			</div>
			{canScrollDown && (
				<div className="absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-card to-transparent flex items-end justify-center pointer-events-none">
					<ChevronDown className="w-5 h-5 text-primary" />
				</div>
			)}
		</div>
		)}

		{/* Detailed Information Section */}
			{loadingDetails && (
				<div className="mt-4 p-4 border border-border rounded-lg bg-accent/5">
					<p className="text-sm text-muted-foreground">Loading detailed information...</p>
				</div>
			)}

		{detailedInfo && !loadingDetails && (
			<div className="relative mt-4">
				{canScrollUp && (
					<div className="absolute top-0 left-0 right-0 h-10 bg-linear-to-b from-card to-transparent z-10 flex items-start justify-center pointer-events-none rounded-t-lg">
						<ChevronUp className="w-5 h-5 text-primary mt-2" />
					</div>
				)}
				<div 
					ref={detailScrollRef}
					className="p-4 border border-border rounded-lg bg-accent/5 space-y-4 max-h-128 overflow-y-auto" 
					style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
					onScroll={(e) => {
						const element = e.currentTarget
						setCanScrollUp(element.scrollTop > 0)
						setCanScrollDown(
							element.scrollTop < element.scrollHeight - element.clientHeight - 1
						)
					}}
				>
					<div>
						<h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
							Medical Information
						</h4>
						<div className="space-y-4">
							<div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
								<p className="text-xs font-semibold text-primary uppercase mb-1">ICD-11 Code</p>
								<p className="text-base font-mono font-bold text-primary">{detailedInfo.code}</p>
							</div>

							<div>
								<p className="text-xs font-semibold text-muted-foreground uppercase">Disease Name</p>
								<p className="text-base font-bold text-foreground mt-1">{detailedInfo.title}</p>
							</div>

							{detailedInfo.definition && (
								<div>
									<p className="text-xs font-semibold text-muted-foreground uppercase">📝 Definition</p>
									<p className="text-sm text-foreground mt-1 leading-relaxed">{detailedInfo.definition}</p>
								</div>
							)}

							{detailedInfo.longDefinition && (
								<div>
									<p className="text-xs font-semibold text-muted-foreground uppercase">📖 Detailed Description</p>
									<p className="text-sm text-foreground mt-1 leading-relaxed">{detailedInfo.longDefinition}</p>
								</div>
							)}

							{detailedInfo.symptoms && detailedInfo.symptoms.length > 0 && (
								<div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-200 dark:border-red-800/30">
									<p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase mb-2">🩺 Common Symptoms</p>
									<ul className="space-y-1.5">
										{detailedInfo.symptoms.map((symptom, idx) => (
											<li key={idx} className="text-sm text-foreground flex items-start gap-2">
												<span className="text-red-600 dark:text-red-400 mt-0.5">•</span>
												<span>{symptom}</span>
											</li>
										))}
									</ul>
								</div>
							)}

							{detailedInfo.causes && detailedInfo.causes.length > 0 && (
								<div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800/30">
									<p className="text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase mb-2">🔬 Causes & Etiology</p>
									<ul className="space-y-1.5">
										{detailedInfo.causes.map((cause, idx) => (
											<li key={idx} className="text-sm text-foreground flex items-start gap-2">
												<span className="text-orange-600 dark:text-orange-400 mt-0.5">→</span>
												<span>{cause}</span>
											</li>
										))}
									</ul>
								</div>
							)}

							{detailedInfo.riskFactors && detailedInfo.riskFactors.length > 0 && (
								<div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800/30">
									<p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase mb-2">⚠️ Risk Factors</p>
									<ul className="space-y-1.5">
										{detailedInfo.riskFactors.map((risk, idx) => (
											<li key={idx} className="text-sm text-foreground flex items-start gap-2">
												<span className="text-amber-600 dark:text-amber-400 mt-0.5">⚡</span>
												<span>{risk}</span>
											</li>
										))}
									</ul>
								</div>
							)}

							{detailedInfo.diagnosis && detailedInfo.diagnosis.length > 0 && (
								<div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800/30">
									<p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase mb-2">🔍 Diagnostic Methods</p>
									<ul className="space-y-1.5">
										{detailedInfo.diagnosis.map((method, idx) => (
											<li key={idx} className="text-sm text-foreground flex items-start gap-2">
												<span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span>
												<span>{method}</span>
											</li>
										))}
									</ul>
								</div>
							)}

							{detailedInfo.treatment && detailedInfo.treatment.length > 0 && (
								<div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800/30">
									<p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase mb-2">💊 Treatment Options</p>
									<ul className="space-y-1.5">
										{detailedInfo.treatment.map((treatment, idx) => (
											<li key={idx} className="text-sm text-foreground flex items-start gap-2">
												<span className="text-green-600 dark:text-green-400 mt-0.5">+</span>
												<span>{treatment}</span>
											</li>
										))}
									</ul>
								</div>
							)}

							{detailedInfo.prevention && detailedInfo.prevention.length > 0 && (
								<div className="bg-teal-50 dark:bg-teal-950/20 p-3 rounded-lg border border-teal-200 dark:border-teal-800/30">
									<p className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase mb-2">🛡️ Prevention Strategies</p>
									<ul className="space-y-1.5">
										{detailedInfo.prevention.map((prevention, idx) => (
											<li key={idx} className="text-sm text-foreground flex items-start gap-2">
												<span className="text-teal-600 dark:text-teal-400 mt-0.5">✓</span>
												<span>{prevention}</span>
											</li>
										))}
									</ul>
								</div>
							)}

							{detailedInfo.prognosis && (
								<div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800/30">
									<p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase mb-2">📊 Prognosis & Outlook</p>
									<p className="text-sm text-foreground leading-relaxed">{detailedInfo.prognosis}</p>
								</div>
							)}

							{detailedInfo.complications && detailedInfo.complications.length > 0 && (
								<div className="bg-rose-50 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-200 dark:border-rose-800/30">
									<p className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase mb-2">⚠️ Potential Complications</p>
									<ul className="space-y-1.5">
										{detailedInfo.complications.map((complication, idx) => (
											<li key={idx} className="text-sm text-foreground flex items-start gap-2">
												<span className="text-rose-600 dark:text-rose-400 mt-0.5">!</span>
												<span>{complication}</span>
											</li>
										))}
									</ul>
								</div>
							)}

							{detailedInfo.prevalence && (
								<div>
									<p className="text-xs font-semibold text-muted-foreground uppercase">📈 Prevalence & Epidemiology</p>
									<p className="text-sm text-foreground mt-1 leading-relaxed">{detailedInfo.prevalence}</p>
								</div>
							)}

							{detailedInfo.synonyms && detailedInfo.synonyms.length > 0 && (
								<div>
									<p className="text-xs font-semibold text-muted-foreground uppercase">🔤 Alternative Names</p>
									<div className="mt-1 flex flex-wrap gap-2">
										{detailedInfo.synonyms.map((syn, idx) => (
											<span key={idx} className="inline-flex px-2 py-1 bg-accent rounded text-xs text-foreground">
												{syn}
											</span>
										))}
									</div>
								</div>
							)}

							{detailedInfo.clinicalNotes && detailedInfo.clinicalNotes.length > 0 && (
								<div className="bg-slate-50 dark:bg-slate-950/20 p-3 rounded-lg border border-slate-200 dark:border-slate-800/30">
									<p className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase mb-2">📋 Clinical Notes</p>
									<div className="space-y-2">
										{detailedInfo.clinicalNotes.map((note, idx) => (
											<p key={idx} className="text-sm text-foreground italic leading-relaxed">{note}</p>
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
				{canScrollDown && (
					<div className="absolute bottom-0 left-0 right-0 h-10 bg-linear-to-t from-card to-transparent flex items-end justify-center pointer-events-none rounded-b-lg">
						<ChevronDown className="w-5 h-5 text-primary mb-2" />
					</div>
				)}
			</div>
			)}
		</Card>
	)
}

