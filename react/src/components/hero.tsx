"use client"

import { Button } from "./ui/button"
import { Users, MessageCircle, BookOpen, Shield, Search } from "lucide-react"
import { motion } from "framer-motion"

import { useRef, useState, useEffect } from "react"
import { Card } from "./ui/card"
import DarkVeil from "./reactBit"

const features = [
  {
    icon: Users,
    title: "Patient Registry",
    description: "Maintain a secure, searchable registry of patient records with structured clinical data.",
  },
  {
    icon: MessageCircle,
    title: "Care Coordination",
    description: "Streamline referrals, messaging, and care plans across teams and facilities.",
  },
  {
    icon: BookOpen,
    title: "Clinical Resources",
    description: "Provide evidence-based guidelines, clinical pathways, and decision support.",
  },
  {
    icon: Shield,
    title: "Privacy & Security",
    description: "HIPAA-compliant controls, audit logs, and encrypted storage.",
  },
]

export function Hero() {
  const containerRef = useRef(null)
  const [, setIsMobile] = useState(false)

  // State for ICD-11 API data and UI states
  const [query, setQuery] = useState("")
  const [diseaseCatalog, setDiseaseCatalog] = useState<Array<any>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selected, setSelected] = useState<any | null>(null)
  const [saved, setSaved] = useState<Array<any>>([])
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const [showList, setShowList] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendLog, setSendLog] = useState<string | null>(null)

  // Detect mobile screens
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Fetch ICD-11 API data when query changes, debounce to avoid overloading API
  useEffect(() => {
    if (!query.trim()) {
      setDiseaseCatalog([])
      setError(null)
      return
    }
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`https://clinicaltables.nlm.nih.gov/api/icd11_codes/v3/search?terms=${encodeURIComponent(query)}&maxList=15`)
        if (!res.ok) throw new Error('Network response not OK')
        const data = await res.json()
        /* data format:
          [
            totalCount,
            code array,
            extra data object with properties including 'title' which stores display names,
            array of display strings, e.g. ['code', 'title', 'parent', ...]
          ]
        */
        const codes = data[1]
        const titles = data[3].map((entry: string[]) => entry[1]) // title is at index 1 of each entry
        // Map API results into a format similar to your previous static array
        const catalog = codes.map((code: string, idx: number) => ({
          id: code,
          icd: code,
          title: titles[idx],
          description: '', // API does not provide description here
        }))
        setDiseaseCatalog(catalog)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setError(err.message || 'Error fetching data')
        setDiseaseCatalog([])
      } finally {
        setLoading(false)
      }
    }

    // Debounce fetch by 300ms
    const debounce = setTimeout(fetchData, 300)
    return () => clearTimeout(debounce)
  }, [query])

  const filtered = query
    ? diseaseCatalog.filter((d) => {
        const q = query.toLowerCase()
        return (
          d.title.toLowerCase().includes(q) ||
          d.icd.toLowerCase().includes(q)
        )
      })
    : diseaseCatalog

  useEffect(() => {
    // reset highlighted index when filtered results change
    setHighlightedIndex(filtered.length > 0 ? 0 : -1)
    setShowList(filtered.length > 0 && query.trim() !== '')
  }, [filtered.length])

  const listboxId = 'icd-listbox'

  const onInputKeyDown = (e: any) => {
    if (filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        const sel = filtered[highlightedIndex]
        setSelected(sel)
        setShowList(false)
        setHighlightedIndex(-1)
        setQuery('')
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setHighlightedIndex(-1)
      setShowList(false)
    }
  }

  function convertToFHIR(diagnosis: any) {
    const fhir = {
      resourceType: 'Condition',
      id: `cond-${diagnosis.id}`,
      clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
      verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
      code: {
        coding: [
          { system: 'http://who.int/icd', code: diagnosis.icd, display: diagnosis.title },
        ],
        text: diagnosis.title,
      },
      subject: { reference: 'Patient/sample-patient', display: 'Sample Patient' },
      onsetDateTime: new Date().toISOString(),
    }
    return fhir
  }

  async function handleSave() {
    if (!selected) return
    setSaved((s) => {
      if (s.find((it) => it.id === selected.id)) return s
      return [...s, selected]
    })
  }

  async function handleMockSend() {
    if (!selected) return
    setSending(true)
    setSendLog(null)

    await new Promise((r) => setTimeout(r, 700))
    setSending(false)
    setSendLog('Navigating to ICD-11 dashboard...')
    
    // Navigate to dashboard/icd11 page
    window.location.href = '/dashboard/icd11'
  }


  // Mobile animation ranges and spring configs as before (omitted here for brevity)
  // ... (copy your existing scroll and animation related code)

  // For brevity, I keep animation code unchanged — insert your previous code here

  return (
    <div ref={containerRef} className="overflow-hidden relative">

      {/* Hero Section with Split Layout and Interactive Elements */}
      <section className="relative py-8 md:py-12 lg:py-16">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_80%,rgba(14,165,233,0.05),transparent_50%),radial-gradient(circle_at_70%_20%,rgba(16,185,129,0.05),transparent_50%)] dark:bg-[radial-gradient(circle_at_30%_80%,rgba(14,165,233,0.1),transparent_50%),radial-gradient(circle_at_70%_20%,rgba(16,185,129,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(14,165,233,0.01)_1px,transparent_1px),linear-gradient(rgba(14,165,233,0.01)_1px,transparent_1px)] bg-[size:4rem_4rem] dark:bg-[linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-8 md:py-12">
            
            {/* Left Column - Brand & Navigation */}
            <motion.div 
              className="lg:col-span-5 space-y-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="space-y-6">
                {/* Brand Header */}
                <div className="space-y-3">
                  
                  <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight">
                    <motion.span 
                      className="mb-2"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.3 }}
                    >
                      <span className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-100 dark:to-white bg-clip-text text-transparent">
                        Health
                      </span>
                    </motion.span>
                    <motion.span 
                      className="bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.4 }}
                    >
                      Sync
                    </motion.span>
                  </h1>
                </div>

                {/* Value Proposition */}
                <motion.div 
                  className="space-y-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  <p className="text-xl font-medium text-foreground/80 dark:text-foreground/90">
                    Clinical intelligence meets seamless workflow
                  </p>
                  <p className="text-lg text-foreground/60 dark:text-foreground/70 max-w-lg leading-relaxed">
                    Transform patient care with our ICD-11 integrated EMR. Real-time FHIR compliance, intelligent diagnostics, and secure team collaboration in one unified platform.
                  </p>
                </motion.div>


                {/* Call to Action */}
                <motion.div 
                  className="flex flex-col sm:flex-row gap-4 items-start"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.7 }}
                >
                  <Button 
                    size="lg" 
                    className="bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white px-8 py-6 text-lg shadow-xl shadow-sky-500/25 hover:shadow-sky-500/40 transition-all duration-300"
                    onClick={() => window.location.href = '/dashboard'}
                  >
                    Go to Dashboard
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="border-2 border-foreground/20 dark:border-foreground/30 px-8 py-6 text-lg hover:bg-foreground/5 dark:hover:bg-foreground/10"
                    onClick={() => window.location.href = '/about'}
                  >
                    Read about us
                  </Button>
                </motion.div>

                {/* Saved Diagnoses Preview */}
                <motion.div 
                  className="space-y-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                    <span className="text-sm font-medium text-foreground/70 dark:text-foreground/80">Recent Diagnoses</span>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {saved.length === 0 ? (
                      <p className="text-sm text-foreground/50 dark:text-foreground/60 italic">Try the search to save diagnoses</p>
                    ) : (
                      saved.slice(0, 3).map((s, idx) => (
                        <motion.div 
                          key={s.id} 
                          className="p-3 rounded-lg bg-gradient-to-r from-sky-50/50 to-emerald-50/50 dark:from-sky-950/20 dark:to-emerald-950/20 border border-sky-200/30 dark:border-sky-800/30 backdrop-blur-sm"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: idx * 0.1 }}
                          whileHover={{ scale: 1.02 }}
                        >
                          <div className="text-sm font-medium text-foreground/90 dark:text-foreground">{s.title}</div>
                          <div className="text-xs text-foreground/60 dark:text-foreground/70">ICD-11: {s.icd}</div>
                        </motion.div>
                      ))
                    )}
                  </div>
                  {sendLog && (
                    <motion.p 
                      className="text-sm text-emerald-600 dark:text-emerald-400 font-medium"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      ✓ {sendLog}
                    </motion.p>
                  )}
                </motion.div>
              </div>
            </motion.div>

            {/* Right Column - Interactive ICD Search Terminal */}
            <motion.div 
              className="lg:col-span-7"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <div className="relative">
                {/* Terminal Window */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 rounded-2xl shadow-2xl border border-slate-700/50 dark:border-slate-800/50 overflow-hidden">
                  {/* Terminal Header */}
                  <div className="flex items-center justify-between px-6 py-4 bg-slate-800/50 dark:bg-slate-900/50 border-b border-slate-700/50 dark:border-slate-800/50">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      </div>
                      <span className="text-sm font-mono text-slate-400 ml-4">ICD-11 Clinical Terminal</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      HealthSync v2024.1
                    </div>
                  </div>

                  {/* Terminal Content */}
                  <div className="p-6 space-y-6">
                    {/* Search Interface */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm">
                        <span>healthcare@terminal:~$</span>
                        <span className="text-slate-400">search-icd11</span>
                      </div>
                      
                      <div className="relative">
                        <input
                          aria-label="Search ICD-11 diagnoses"
                          role="combobox"
                          aria-controls={listboxId}
                          aria-expanded={filtered.length > 0}
                          aria-autocomplete="list"
                          aria-activedescendant={highlightedIndex >= 0 && filtered[highlightedIndex] ? `icd-option-${highlightedIndex}` : undefined}
                          type="search"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          onKeyDown={onInputKeyDown}
                          placeholder="Enter diagnosis or ICD code..."
                          className="w-full bg-slate-800/50 dark:bg-slate-900/50 border border-slate-600/50 dark:border-slate-700/50 rounded-lg px-4 py-3 text-slate-100 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/25 transition-all font-mono"
                        />
                        {query && (
                          <motion.div 
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400"
                            animate={{ rotate: loading ? 360 : 0 }}
                            transition={{ duration: 1, repeat: loading ? Infinity : 0 }}
                          >
                            <Search className="w-4 h-4" />
                          </motion.div>
                        )}
                      </div>

                      {/* Search Results */}
                      {filtered.length > 0 && (
                        <motion.div 
                          className="space-y-2 max-h-64 overflow-y-auto"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <div className="text-xs text-slate-400 font-mono mb-2">
                            Found {filtered.length} matches:
                          </div>
                          {filtered.slice(0, 5).map((d, idx) => (
                            <motion.button
                              key={d.id}
                              onClick={() => {
                                setSelected(d)
                                setShowList(false)
                                setHighlightedIndex(-1)
                                setQuery('')
                              }}
                              className={`w-full text-left p-3 rounded-lg transition-all ${
                                highlightedIndex === idx 
                                  ? 'bg-emerald-400/10 border-emerald-400/30' 
                                  : 'bg-slate-800/30 dark:bg-slate-900/30 hover:bg-slate-700/30 dark:hover:bg-slate-800/30'
                              } border border-slate-600/30 dark:border-slate-700/30`}
                              onMouseEnter={() => setHighlightedIndex(idx)}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2, delay: idx * 0.05 }}
                              whileHover={{ scale: 1.02 }}
                            >
                              <div className="text-sm font-medium text-slate-100 dark:text-slate-200">{d.title}</div>
                              <div className="text-xs text-emerald-400 font-mono mt-1">ICD-11: {d.icd}</div>
                            </motion.button>
                          ))}
                        </motion.div>
                      )}

                      {loading && (
                        <div className="flex items-center gap-2 text-slate-400 text-sm font-mono">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                          Searching ICD-11 database...
                        </div>
                      )}

                      {error && (
                        <div className="text-red-400 text-sm font-mono bg-red-950/20 border border-red-800/30 rounded-lg p-3">
                          Error: {error}
                        </div>
                      )}
                    </div>

                    {/* Selected Diagnosis Display */}
                    <div className="bg-slate-800/30 dark:bg-slate-900/30 rounded-lg p-4 border border-slate-600/30 dark:border-slate-700/30">
                      <div className="text-xs text-slate-400 font-mono mb-2">SELECTED DIAGNOSIS:</div>
                      {selected ? (
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-slate-100 dark:text-slate-200">{selected.title}</div>
                          <div className="text-xs text-slate-400">{selected.description}</div>
                          <div className="text-xs text-emerald-400 font-mono">ICD-11: {selected.icd}</div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400 italic">No diagnosis selected</div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleSave} 
                        disabled={!selected}
                        className="border-emerald-400/50 text-emerald-400 hover:bg-emerald-400/10"
                      >
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={handleMockSend} 
                        disabled={!selected || sending}
                        className="bg-sky-400/20 text-sky-300 hover:bg-sky-400/30"
                      >
                        {sending ? 'Opening Dashboard...' : 'Send to EMR'}
                      </Button>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section with Modern Cards */}
      <section id="features" className="relative py-20 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/20 to-background"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              Built for <span className="bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">Healthcare</span> Excellence
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every feature designed with clinical workflows and patient outcomes in mind
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="group"
                >
                  <Card className="p-8 bg-gradient-to-br from-card/80 via-card to-card/80 hover:shadow-2xl transition-all duration-500 border border-border/60 backdrop-blur-sm h-full">
                    <div className="space-y-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-sky-400/10 via-emerald-400/10 to-cyan-400/10 border border-sky-200/20 dark:border-sky-800/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Icon className="w-6 h-6 text-sky-500 dark:text-sky-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
