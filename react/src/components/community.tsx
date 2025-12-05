"use client"

import { Card } from "./ui/card"
import { Star } from "lucide-react"
import { motion } from "framer-motion"

const testimonials = [
  {
    name: "Sarah M.",
    role: "Clinic Administrator",
    content: "HealthSync EMR helped our clinic reduce documentation time and improve patient handoffs.",
    rating: 5,
  },
  {
    name: "James T.",
    role: "Physician",
    content: "Integrations with labs and imaging streamlined our workflow and reduced turnaround.",
    rating: 5,
  },
  {
    name: "Emma L.",
    role: "Nurse Manager",
    content: "Secure, easy-to-use EMR that supports our clinical workflows.",
    rating: 5,
  },
]

export function Community() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  }

  return (
    <section id="community" className="relative py-20 md:py-32 bg-gradient-to-b from-background via-muted/30 to-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 text-balance">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 via-cyan-400 to-sky-400">Trusted by Care Teams</span>
          </h2>
          <p className="text-lg lg:text-xl text-muted-foreground/90 max-w-3xl mx-auto text-balance leading-relaxed">
            Hear from clinics and hospitals using HealthSync EMR to improve care coordination and patient outcomes.
          </p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-3 gap-6 lg:gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {testimonials.map((testimonial, index) => (
            <motion.div key={index} variants={itemVariants}>
              <Card className="p-8 lg:p-10 bg-card/98 backdrop-blur-sm border border-border/60 hover:border-border/80 hover:shadow-2xl hover:shadow-primary/8 transition-all duration-300 rounded-2xl group">
                <div className="flex gap-1 mb-6">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-emerald-400 text-emerald-400 group-hover:scale-110 transition-transform duration-300" style={{animationDelay: `${i * 100}ms`}} />
                  ))}
                </div>
                <p className="text-muted-foreground/90 mb-8 leading-relaxed text-lg font-medium">"{testimonial.content}"</p>
                <div className="border-t border-border/40 pt-6">
                  <p className="font-bold text-foreground text-lg">{testimonial.name}</p>
                  <p className="text-sm text-primary font-semibold">{testimonial.role}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
