"use client"

import { Button } from "./ui/button"
import ThemeToggle from './theme-toggle'
import { Link } from 'react-router-dom'
import { useAuth } from "../lib/auth"

export function Header() {
  return (
    <header className="sticky opacity-85 top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <img src="/logo-red.png" alt="HealthSync Logo" className="w-8 h-8" />
          <Link to="/">
          <span className="text-xl font-semibold text-foreground">HealthSync</span>
          </Link>
        </div> 

        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition">
            Features
          </a>
          <a href="#community" className="text-sm text-muted-foreground hover:text-foreground transition">
            Community
          </a>
          <a href="#about" className="text-sm text-muted-foreground hover:text-foreground transition">
            About
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {(() => {
            const { user, loading } = useAuth()
            if (loading) {
              return (
                <div className="flex items-center gap-3">
                  <div className="w-24 h-8 bg-muted/20 rounded animate-pulse" />
                  <ThemeToggle />
                </div>
              )
            }

            if (user) {
              return (
                <>
                  <Link to="/dashboard">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Go to dashboard</Button>
                  </Link>
                  <ThemeToggle />
                </>
              )
            }

            return (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-sm hidden md:block">
                    Sign In
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Get Started</Button>
                </Link>
                <ThemeToggle />
              </>
            )
          })()}
        </div>
      </div>
    </header>
  )
}