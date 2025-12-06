"use client"

import { useState, useEffect } from "react"
import Sidebar from "./sidebar"
import Header from "./dashboard-header"
import { Outlet } from "react-router-dom"
import NotificationCenter from "./NotificationCenter"
import type { Notification } from "./NotificationCenter"
import { useSocket } from "@/lib/useSocket"
import { useAuth } from "@/lib/auth"

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]) // Persistent notifications for bell
  const [toastNotifications, setToastNotifications] = useState<Notification[]>([]) // Auto-closing toasts
  const [loadingNotifications, setLoadingNotifications] = useState(true)
  const { socket, isConnected } = useSocket()
  const { authFetch } = useAuth()

  // Listen for real-time patient assignment notifications
  useEffect(() => {
    if (!socket) return

    const handlePatientAssigned = async (data: {
      patientId: string
      patientName: string
      patientAge?: number
      assignedBy: string
      organizationName: string
      timestamp: string
      message: string
    }) => {
      console.log('📢 Real-time patient assignment notification received:', data)
      
      // Fetch the latest notification from database to get the proper ID
      // This ensures we use the same notification that was saved to DB
      try {
        const response = await authFetch('/api/notifications')
        if (response.ok) {
          const result = await response.json()
          const latestNotification = result.notifications[0]
          
          if (latestNotification && latestNotification.data.patientId === data.patientId) {
            const newNotification: Notification = {
              id: latestNotification.id,
              type: latestNotification.type,
              title: latestNotification.title,
              message: latestNotification.message,
              timestamp: new Date(latestNotification.timestamp),
              read: latestNotification.read,
              autoClose: true,
              duration: 8000,
              data: latestNotification.data
            }

            // Check if this notification already exists (avoid duplicates)
            setAllNotifications((prev) => {
              const exists = prev.some(n => n.id === newNotification.id)
              if (exists) return prev
              return [newNotification, ...prev]
            })
            
            // Add to toast notifications (will auto-close)
            setToastNotifications((prev) => [newNotification, ...prev])

            // Play notification sound
            try {
              const audio = new Audio('/notification.mp3')
              audio.volume = 0.3
              audio.play().catch(() => {
                // Ignore if audio fails to play
              })
            } catch {
              // Ignore audio errors
            }
          }
        }
      } catch (error) {
        console.error('Error syncing notification:', error)
        
        // Fallback: create notification with temporary ID if DB fetch fails
        const notificationId = `notification-${Date.now()}-${Math.random()}`
        const newNotification: Notification = {
          id: notificationId,
          type: 'patient-assigned',
          title: 'New Patient Assigned',
          message: data.message,
          timestamp: new Date(data.timestamp),
          autoClose: true,
          duration: 8000,
          data: {
            patientId: data.patientId,
            patientName: data.patientName,
            patientAge: data.patientAge,
            assignedBy: data.assignedBy,
            organizationName: data.organizationName,
          },
        }
        
        setAllNotifications((prev) => [newNotification, ...prev])
        setToastNotifications((prev) => [newNotification, ...prev])
      }
    }

    socket.on('patient:assigned', handlePatientAssigned)

    return () => {
      socket.off('patient:assigned', handlePatientAssigned)
    }
  }, [socket, authFetch])

  // Fetch notifications from database on mount
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoadingNotifications(true)
        const response = await authFetch('/api/notifications')
        if (!response.ok) {
          console.error('Failed to fetch notifications:', response.statusText)
          return
        }
        
        const data = await response.json()
        const notifications: Notification[] = (data.notifications || []).map((n: any) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          timestamp: new Date(n.timestamp),
          read: n.read,
          autoClose: false, // Persisted notifications don't auto-close
          data: n.data || {}
        }))
        
        setAllNotifications(notifications)
        console.log(`Loaded ${notifications.length} notifications from database`)
      } catch (error) {
        console.error('Error fetching notifications:', error)
      } finally {
        setLoadingNotifications(false)
      }
    }

    fetchNotifications()
  }, [authFetch])

  const removeToastNotification = (id: string) => {
    // Only remove from toast display, keep in persistent list
    setToastNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const removeNotification = async (id: string) => {
    // Remove from both lists and delete from database
    setAllNotifications((prev) => prev.filter((n) => n.id !== id))
    setToastNotifications((prev) => prev.filter((n) => n.id !== id))
    
    // Delete from database
    try {
      const response = await authFetch(`/api/notifications/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        console.error('Failed to delete notification from database')
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const clearAllNotifications = async () => {
    setAllNotifications([])
    setToastNotifications([])
    
    // Clear from database
    try {
      const response = await authFetch('/api/notifications', { method: 'DELETE' })
      if (!response.ok) {
        console.error('Failed to clear notifications from database')
      }
    } catch (error) {
      console.error('Error clearing notifications:', error)
    }
  }

  // Get today's notifications only
  const getTodaysNotifications = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return allNotifications.filter(n => {
      const notifDate = new Date(n.timestamp)
      notifDate.setHours(0, 0, 0, 0)
      return notifDate.getTime() === today.getTime()
    })
  }

  return (
    <div className={`flex min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(14,165,233,0.02),transparent_50%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.02),transparent_50%)] dark:bg-[radial-gradient(circle_at_20%_80%,rgba(14,165,233,0.05),transparent_50%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.05),transparent_50%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(14,165,233,0.005)_1px,transparent_1px),linear-gradient(rgba(14,165,233,0.005)_1px,transparent_1px)] bg-[size:6rem_6rem] dark:bg-[linear-gradient(90deg,rgba(14,165,233,0.01)_1px,transparent_1px),linear-gradient(rgba(14,165,233,0.01)_1px,transparent_1px)]" />
      
      {/* Notification Center - Toast notifications that auto-close */}
      <NotificationCenter notifications={toastNotifications} onRemove={removeToastNotification} />
      
      {/* Connection Status Indicator (optional) */}
      {!isConnected && (
        <div className="fixed bottom-4 right-4 z-50 bg-yellow-500/10 border border-yellow-500/50 text-yellow-900 dark:text-yellow-100 px-4 py-2 rounded-lg text-sm backdrop-blur-xl">
          ⚠️ Real-time notifications offline
        </div>
      )}

      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} notifications={getTodaysNotifications()}
          onClearNotifications={clearAllNotifications}
          onRemoveNotification={removeNotification}/>

      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-out relative z-10 ${
        sidebarOpen ? 'md:ml-64' : 'md:ml-0'
      }`}>
        <Header 
          onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} 
          notifications={getTodaysNotifications()}
          onClearNotifications={clearAllNotifications}
          onRemoveNotification={removeNotification}
        />

        <main className="flex-1 overflow-auto backdrop-blur-sm">
          <div className="max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
