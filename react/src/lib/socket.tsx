import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { SocketContext } from './socketContext'

interface SocketProviderProps {
  children: ReactNode
  token: string | null
}

export const SocketProvider = ({ children, token }: SocketProviderProps) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!token) {
      // No token, disconnect if connected
      if (socket) {
        socket.disconnect()
        setSocket(null)
        setIsConnected(false)
      }
      return
    }

    // Connect to Socket.IO server with authentication
    // For Socket.IO, we need to use the actual backend server, not the API proxy
    const BACKEND_URL = 'http://localhost:4000'
    
    console.log('🔌 Connecting to Socket.IO server at:', BACKEND_URL)
    console.log('🔑 Using token:', token ? 'Token present' : 'No token')
    
    const newSocket = io(BACKEND_URL, {
      auth: {
        token,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    })

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('✅ Connected to HealthSync real-time service')
      console.log('Socket ID:', newSocket.id)
      setIsConnected(true)
    })

    newSocket.on('connected', (data) => {
      console.log('📨 Server connected message:', data.message)
    })

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from HealthSync real-time service. Reason:', reason)
      setIsConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.error('🚨 Socket connection error:', error.message)
      console.error('Error details:', error)
      setIsConnected(false)
    })

    setSocket(newSocket)

    // Cleanup on unmount or when token changes
    return () => {
      if (newSocket) {
        newSocket.disconnect()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}
