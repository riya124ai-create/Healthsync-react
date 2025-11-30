"use client"
import { Link, useLocation } from "react-router-dom"
import { Menu, X, Home, BookOpen, Users, Stethoscope, Settings, Search, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "../ui/input"
import ThemeToggle from "../theme-toggle"
import { useAuth } from "@/lib/auth"

function LogoutButton() {
  const { logout } = useAuth()
  return (
    <Button
      variant="destructive"
      size="lg"
      className="w-full justify-start gap-3 text-white"
      onClick={() => void logout()}
      aria-label="Logout"
    >
      <LogOut className="w-5 h-5" />
      <span className="text-base">Logout</span>
    </Button>
  )
}

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/icd11", label: "ICD-11 Codes", icon: BookOpen },
  { href: "/dashboard/patients", label: "Patients", icon: Users },
  { href: "/dashboard/namaste", label: "NAMASTE", icon: Stethoscope },
]

export default function Sidebar({ open, onToggle }: SidebarProps) {
  const location = useLocation()
  const pathname = location.pathname
  const { user } = useAuth()
  const isOrg = user?.role === 'organization'

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`hidden md:flex md:fixed md:top-0 md:left-0 md:h-screen flex-col bg-sidebar border-r border-sidebar-border z-40 w-64 transform ${
          open ? "translate-x-0" : "-translate-x-64"
        } overflow-hidden transition-transform duration-300 ease-in-out will-change-transform`}
      >
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-bold text-sidebar-foreground">EMR System</h1>
          <p className="text-xs text-sidebar-foreground/60 mt-1">Traditional Medicine Integrated</p>
        </div>

    <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
      {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link key={item.href} to={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={`w-full justify-start gap-3 ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/10"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Button>
              </Link>
            )
          })}
          {isOrg && (
            <Link key="/dashboard/reports" to="/dashboard/reports">
              <Button
                variant={pathname === '/dashboard/reports' ? 'default' : 'ghost'}
                className={`w-full justify-start gap-3 ${pathname === '/dashboard/reports' ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/10'}`}>
                <BookOpen className="w-5 h-5" />
                <span>Reports</span>
              </Button>
            </Link>
          )}
          <Link to="/dashboard/settings" onClick={onToggle}>
                <Button
                  variant={pathname === '/dashboard/settings' ? "default" : "ghost"}
                  className={`w-full justify-start gap-3 ${
                    pathname === '/dashboard/settings'
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/10"
                  }`}
                >
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </Button>
              </Link>
        </nav>
        <div className="p-4">
          
          <LogoutButton />
        </div>
      </div>

      {/* Mobile Sidebar Toggle */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-sidebar border-b border-sidebar-border flex items-center px-4 gap-4">
        <Button variant="ghost" size="sm" onClick={onToggle} className="text-sidebar-foreground">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
        <div className="flex flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search patients, codes..." className="pl-10 h-9 bg-input" />
        </div>
        <ThemeToggle />
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <img src="/logo-white.png" alt="HealthSync" className="w-5 h-5" />
          </div>
        </Link>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/50 transition-opacity duration-200" />
          <div className={`relative w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transform transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : '-translate-x-64'}`}>
            <div className="p-6 border-b border-sidebar-border mt-16">
              <h1 className="text-xl font-bold text-sidebar-foreground">EMR System</h1>
            </div>

            <nav className="flex-1 p-4 space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <Link key={item.href} to={item.href} onClick={onToggle}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      className={`w-full justify-start gap-3 ${
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/10"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Button>
                  </Link>
                )
              })}
              {isOrg && (
                <Link key="/dashboard/reports" to="/dashboard/reports" onClick={onToggle}>
                  <Button
                    variant={pathname === '/dashboard/reports' ? 'default' : 'ghost'}
                    className={`w-full justify-start gap-3 ${pathname === '/dashboard/reports' ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/10'}`}>
                    <BookOpen className="w-5 h-5" />
                    <span>Reports</span>
                  </Button>
                </Link>
              )}
              <Link to="/dashboard/settings" onClick={onToggle}>
                <Button
                  variant={pathname === '/dashboard/settings' ? "default" : "ghost"}
                  className={`w-full justify-start gap-3 ${
                    pathname === '/dashboard/settings'
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/10"
                  }`}
                >
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </Button>
              </Link>
            </nav>
            <div className="p-4">
              <LogoutButton />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
