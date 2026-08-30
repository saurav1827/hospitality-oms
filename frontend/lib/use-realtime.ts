'use client'

import { useEffect, useState, useRef } from 'react'

export type RealtimeEvent = { type: string; eventId?: string; payload?: Record<string, unknown> }

export function useRealtime(propertyId: string) {
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)

  useEffect(() => {
    if (!propertyId) return;

    const connect = () => {
      // Clear any pending reconnects
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      const baseUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws/operations/'
      const url = `${baseUrl}?property_id=${propertyId}`
      
      const socket = new WebSocket(url)
      wsRef.current = socket

      socket.onopen = () => {
        setConnected(true)
        reconnectAttemptsRef.current = 0 // reset attempts on successful connection
      }
      
      socket.onclose = () => {
        setConnected(false)
        wsRef.current = null
        
        // Exponential backoff reconnect
        const timeout = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000)
        reconnectAttemptsRef.current += 1
        reconnectTimeoutRef.current = setTimeout(connect, timeout)
      }
      
      socket.onerror = () => {
        // Will trigger onclose immediately after
      }
      
      socket.onmessage = (message) => {
        try { 
          setLastEvent(JSON.parse(message.data) as RealtimeEvent) 
        } catch { 
          setLastEvent({ type: 'malformed_event' }) 
        }
      }
    }

    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [propertyId])

  return { connected, lastEvent }
}
