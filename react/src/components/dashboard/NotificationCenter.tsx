"use client"

import { useEffect, useState } from 'react'
import { X, UserPlus, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type NotificationData = {
  patientName?: string
  patientAge?: number
}

export type Notification = {
  id: string
  type: 'success' | 'info' | 'warning' | 'error' | 'patient-assigned'
  title: string
  message: string
  timestamp: Date
  read?: boolean
  autoClose?: boolean
  duration?: number
  data?: NotificationData
}

interface NotificationCenterProps {
  notifications: Notification[]
  onRemove: (id: string) => void
}

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
  switch (type) {
    case 'patient-assigned':
      return <UserPlus className="w-5 h-5" />
    case 'success':
      return <CheckCircle className="w-5 h-5" />
    case 'error':
      return <AlertCircle className="w-5 h-5" />
    case 'warning':
      return <AlertCircle className="w-5 h-5" />
    default:
      return <Info className="w-5 h-5" />
  }
}

const getNotificationStyles = (type: Notification['type']) => {
  switch (type) {
    case 'patient-assigned':
      return 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/50 text-blue-900 dark:text-blue-100'
    case 'success':
      return 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/50 text-green-900 dark:text-green-100'
    case 'error':
      return 'bg-gradient-to-r from-red-500/10 to-rose-500/10 border-red-500/50 text-red-900 dark:text-red-100'
    case 'warning':
      return 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/50 text-yellow-900 dark:text-yellow-100'
    default:
      return 'bg-gradient-to-r from-gray-500/10 to-slate-500/10 border-gray-500/50 text-gray-900 dark:text-gray-100'
  }
}

export default function NotificationCenter({ notifications, onRemove }: NotificationCenterProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div className="fixed top-20 right-4 md:right-6 z-50 flex flex-col gap-3 w-[calc(100vw-2rem)] max-w-md pointer-events-none">
      <AnimatePresence>
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onRemove={onRemove}
            isHovered={hoveredId === notification.id}
            onHover={setHoveredId}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

interface NotificationItemProps {
  notification: Notification
  onRemove: (id: string) => void
  isHovered: boolean
  onHover: (id: string | null) => void
}

function NotificationItem({ notification, onRemove, isHovered, onHover }: NotificationItemProps) {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (!notification.autoClose) return

    const duration = notification.duration || 5000
    const interval = 50
    const decrement = (interval / duration) * 100

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer)
          onRemove(notification.id)
          return 0
        }
        return isHovered ? prev : prev - decrement
      })
    }, interval)

    return () => clearInterval(timer)
  }, [notification, onRemove, isHovered])

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => onHover(notification.id)}
      onMouseLeave={() => onHover(null)}
      className="pointer-events-auto"
    >
      <div
        className={`
          relative overflow-hidden rounded-xl border-2 backdrop-blur-xl shadow-2xl
          ${getNotificationStyles(notification.type)}
          transition-all duration-200
          ${isHovered ? 'scale-105' : 'scale-100'}
        `}
      >
        {/* Progress bar */}
        {notification.autoClose && (
          <div className="absolute bottom-0 left-0 h-1 bg-current opacity-20 transition-all duration-50"
            style={{ width: `${progress}%` }}
          />
        )}

        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5 opacity-80">
              <NotificationIcon type={notification.type} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="font-semibold text-sm leading-tight">
                  {notification.title}
                </h4>
                <button
                  onClick={() => onRemove(notification.id)}
                  className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="Close notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <p className="text-sm opacity-90 leading-snug mb-2">
                {notification.message}
              </p>

              {notification.data?.patientName && (
                <div className="flex items-center gap-2 text-xs opacity-75 mb-2">
                  <span className="font-medium">Patient:</span>
                  <span className="px-2 py-0.5 rounded-full bg-current/10">
                    {notification.data.patientName as string}
                  </span>
                  {notification.data.patientAge && (
                    <span className="opacity-60">
                      Age: {notification.data.patientAge}
                    </span>
                  )}
                </div>
              )}

              <div className="text-xs opacity-60">
                {formatTime(notification.timestamp)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
