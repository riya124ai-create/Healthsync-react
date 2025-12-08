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
    // Use Render backend for Socket.IO, separate from Vercel API
    const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string) || (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000'
    
    console.log('🔌 Connecting to Socket.IO at:', SOCKET_URL)
    
    const newSocket = io(SOCKET_URL, {
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
      setIsConnected(true)
    })

    newSocket.on('connected', (data) => {
      console.log('📨 Server connected message:', data.message)
    })

    newSocket.on('disconnect', () => {
      setIsConnected(false)
    })

    newSocket.on('connect_error', () => {
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
