"use client"
import { Link, useLocation } from "react-router-dom"
import { Menu, X, Home, BookOpen, Users, Stethoscope, Settings, Search, LogOut, Bell, Info, AlertCircle, CheckCircle, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "../ui/input"
import ThemeToggle from "../theme-toggle"
import { useAuth } from "@/lib/auth"
import { useState } from "react"
import type { Notification } from "./NotificationCenter"

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
  onToggle: () => void,
  notifications?: Notification[]
  onClearNotifications?: () => void
  onRemoveNotification?: (id: string) => void
}

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/icd11", label: "ICD-11 Codes", icon: BookOpen },
  { href: "/dashboard/patients", label: "Patients", icon: Users },
  // { href: "/dashboard/namaste", label: "NAMASTE", icon: Stethoscope },
]
const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'patient-assigned':
        return <UserPlus className="w-4 h-4" />
      case 'success':
        return <CheckCircle className="w-4 h-4" />
      case 'error':
        return <AlertCircle className="w-4 h-4" />
      case 'warning':
        return <AlertCircle className="w-4 h-4" />
      default:
        return <Info className="w-4 h-4" />
    }
  }
  const formatNotificationTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (seconds < 60) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
export default function Sidebar({ open, onToggle, notifications = [], onClearNotifications, onRemoveNotification }: SidebarProps) {
    const [showNotifications, setShowNotifications] = useState(false)
  const location = useLocation()
  const pathname = location.pathname
  const { user } = useAuth()
  const unreadCount = notifications.length
  const isOrg = user?.role === 'organization'

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`hidden md:flex md:fixed md:top-0 md:left-0 md:h-screen flex-col bg-sidebar/95 backdrop-blur-xl border-r border-sidebar-border/50 z-40 w-64 transform ${
          open ? "translate-x-0" : "-translate-x-64"
        } overflow-hidden transition-all duration-300 ease-out will-change-transform shadow-2xl shadow-sidebar-border/10`}
      >
        <div className="p-6 border-b border-sidebar-border/50 bg-linear-to-r from-sidebar to-sidebar/80">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-primary via-primary/90 to-primary/80 flex items-center justify-center shadow-lg">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold text-sidebar-foreground bg-linear-to-r from-sidebar-foreground via-sidebar-foreground/90 to-sidebar-foreground/80 bg-clip-text">HealthSync</h1>
          </div>
          <p className="text-xs text-sidebar-foreground/70 font-medium tracking-wide">Clinical Management Platform</p>
        </div>

    <nav className="flex-1 p-4 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-sidebar-border/30 scrollbar-track-transparent">
      {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link key={item.href} to={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={`w-full justify-start gap-3 h-11 text-sm font-medium transition-all duration-200 group ${
                    isActive
                      ? "bg-linear-to-r from-sidebar-primary to-sidebar-primary/90 text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20"
                      : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/10 hover:shadow-sm"
                  }`}
                >
                  <Icon className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? "" : "group-hover:scale-110"
                  }`} />
                  <span>{item.label}</span>
                </Button>
              </Link>
            )
          })}
            <Link key="/dashboard/reports" to="/dashboard/reports">
              <Button
                variant={pathname === '/dashboard/reports' ? 'default' : 'ghost'}
                className={`w-full justify-start gap-3 h-11 text-sm font-medium transition-all duration-200 group ${
                  pathname === '/dashboard/reports' 
                    ? 'bg-linear-to-r from-sidebar-primary to-sidebar-primary/90 text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20' 
                    : 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/10 hover:shadow-sm'
                }`}>
                <BookOpen className={`w-5 h-5 transition-transform duration-200 ${
                  pathname === '/dashboard/reports' ? "" : "group-hover:scale-110"
                }`} />
                <span>Reports</span>
              </Button>
            </Link>
          <Link to="/dashboard/settings">
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
        {user?.role === 'doctor' && (
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications)
              }}
              onBlur={() => setTimeout(() => setShowNotifications(false), 200)}
              aria-label="View notifications"
              className="relative w-10 h-10 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center text-foreground transition-all duration-200 hover:scale-105"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-96 max-h-128 bg-popover/95 backdrop-blur-xl border border-border/50 rounded-lg shadow-2xl shadow-border/10 z-50 overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/30">
                <div>
                  <h3 className="font-semibold text-sm">Today's Notifications</h3>
                  <p className="text-xs text-muted-foreground">{unreadCount} notification{unreadCount !== 1 ? 's' : ''}</p>
                </div>
                {unreadCount > 0 && onClearNotifications && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onClearNotifications()
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No notifications today</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">You're all caught up!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="p-4 hover:bg-accent/10 transition-colors relative group"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveNotification?.(notification.id)
                          }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                          aria-label="Dismiss notification"
                        >
                          <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                        </button>

                        <div className="flex gap-3 pr-6">
                          <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm mb-1 leading-tight">
                              {notification.title}
                            </h4>
                            <p className="text-sm text-muted-foreground leading-snug mb-2">
                              {notification.message}
                            </p>

                            {notification.data?.patientName && (
                              <div className="flex items-center gap-2 text-xs mb-2">
                                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                  {notification.data.patientName as string}
                                </span>
                                {notification.data.patientAge && (
                                  <span className="text-muted-foreground">
                                    Age: {notification.data.patientAge}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="text-xs text-muted-foreground/70">
                              {formatNotificationTime(notification.timestamp)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        )}
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
