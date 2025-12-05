"use client"

import { Button } from "./ui/button"
import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

export function CTA() {
  return (
    <section className="relative py-20 md:py-32 bg-gradient-to-br from-primary/8 via-accent/8 to-secondary/8 overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.08]"></div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/15 to-cyan-400/15 border border-primary/30 mb-8">
            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 animate-pulse"></div>
            <span className="text-sm font-semibold text-primary">Ready to Get Started?</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 text-balance">
            <span className="text-foreground">Modernize Your</span>
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 via-cyan-400 to-sky-400">Clinical Workflows</span>
          </h2>
          
          <p className="text-lg lg:text-xl text-muted-foreground/90 mb-12 max-w-4xl mx-auto text-balance leading-relaxed">
            Join thousands of healthcare professionals using HealthSync EMR for secure, interoperable clinical workflows. Request a personalized demo or start your free trial today.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" className="px-8 py-4 h-14 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-cyan-400 hover:from-emerald-600 hover:to-cyan-500 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl group">
              Request a Demo 
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
            </Button>
            <Button variant="outline" size="lg" className="px-8 py-4 h-14 text-lg font-semibold border-2 border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 rounded-xl">
              Start Free Trial
            </Button>
          </div>
          
          <div className="mt-12 flex flex-wrap justify-center items-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              <span>HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
              <span>FHIR Integration</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-sky-400"></div>
              <span>24/7 Support</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
