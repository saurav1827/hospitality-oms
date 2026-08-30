'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Printer, AlertCircle } from 'lucide-react'
import { apiFetch, type Order } from '@/lib/api-client'
import { useSession } from '@/lib/use-session'

function formatDate(isoStr: string) {
  return new Date(isoStr).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  })
}

export default function PrintTicketPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.orderId as string
  const { session, isLoading: sessionLoading } = useSession()
  const propertyId = session?.propertyId ?? ''

  // Add a slight delay to trigger print after render
  const [readyToPrint, setReadyToPrint] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/login')
  }, [sessionLoading, session, router])

  // Fetch the specific order
  // Note: For security we pass propertyId to ensure the user has access.
  const { data, error, isLoading } = useSWR<{ order: Order }>(
    propertyId && orderId ? `/api/properties/${propertyId}/orders/${orderId}/` : null,
    apiFetch
  )

  const order = data?.order

  useEffect(() => {
    if (order && !readyToPrint) {
      const timer = setTimeout(() => {
        setReadyToPrint(true)
        window.print()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [order, readyToPrint])

  if (isLoading || sessionLoading) {
    return <div className="flex h-screen items-center justify-center bg-white text-zinc-500 print:hidden">Loading ticket...</div>
  }

  if (error || !order) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-white text-red-500 print:hidden">
        <AlertCircle size={48} className="mb-4" />
        <p className="text-xl font-bold">Ticket not found</p>
        <button onClick={() => window.close()} className="mt-4 px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg">Close Tab</button>
      </div>
    )
  }

  let parsedNotes = { orderType: 'dine-in', tableNumber: 'TBD', waiterName: 'Staff' }
  try {
    if (order.notes && order.notes.startsWith('{')) {
      const p = JSON.parse(order.notes)
      parsedNotes = { ...parsedNotes, ...p }
    }
  } catch (e) { }

  return (
    <div className="min-h-screen bg-zinc-100 p-8 flex justify-center print:p-0 print:bg-white text-black font-sans">
      
      {/* On-screen Print Controls (Hidden in Print) */}
      <div className="fixed top-4 right-4 print:hidden space-x-2">
        <button 
          onClick={() => window.print()}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-colors"
        >
          <Printer size={18} /> Print Now
        </button>
        <button 
          onClick={() => window.close()}
          className="px-4 py-2 bg-zinc-300 hover:bg-zinc-400 text-zinc-900 font-bold rounded-lg shadow-lg transition-colors"
        >
          Close
        </button>
      </div>

      {/* The Printable Ticket Area */}
      <div className="w-[80mm] bg-white border border-zinc-200 shadow-sm print:border-none print:shadow-none p-4 mx-auto" style={{ minHeight: '100vh' }}>
        
        {/* Header */}
        <div className="text-center mb-6 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-black uppercase tracking-wider mb-1">{(session as any)?.propertyName || 'Restaurant'}</h1>
          <p className="text-xs text-zinc-600 uppercase font-semibold tracking-widest">Order Ticket</p>
          <div className="mt-3 bg-black text-white py-1 text-lg font-bold">
            Order #{order.number}
          </div>
        </div>

        {/* Metadata */}
        <div className="text-xs space-y-1 mb-6 border-b border-black pb-4 font-mono">
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{order.createdAt ? formatDate(order.createdAt) : '-'}</span>
          </div>
          <div className="flex justify-between">
            <span>Type:</span>
            <span className="uppercase font-bold">{parsedNotes.orderType.replace('-', ' ')}</span>
          </div>
          <div className="flex justify-between">
            <span>Table/Room:</span>
            <span className="font-bold">{parsedNotes.tableNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Staff:</span>
            <span>{parsedNotes.waiterName}</span>
          </div>
          <div className="flex justify-between mt-2">
            <span>ID:</span>
            <span className="text-[10px] text-zinc-500">{order.id}</span>
          </div>
        </div>

        {/* Items */}
        <div className="mb-6 border-b border-black pb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-300">
                <th className="text-left font-bold pb-2 w-2/3">Item</th>
                <th className="text-center font-bold pb-2 w-1/6">Qty</th>
                <th className="text-right font-bold pb-2 w-1/6">Amt</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2 pr-2 font-medium">{item.name}</td>
                  <td className="py-2 text-center font-bold">{item.quantity}</td>
                  <td className="py-2 text-right">{(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="space-y-1 text-sm border-b-2 border-black pb-4 mb-4">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>₹{order.subtotal}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span>₹{order.taxTotal}</span>
          </div>
          <div className="flex justify-between text-lg font-black mt-2 pt-2 border-t border-zinc-300">
            <span>TOTAL</span>
            <span>₹{order.total}</span>
          </div>
          <div className="flex justify-between text-xs mt-2 text-zinc-600">
            <span>Payment Method</span>
            <span className="uppercase font-bold">{order.paymentMethod || 'UNPAID'}</span>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-xs mt-8 font-semibold uppercase tracking-widest space-y-1">
          <p>Thank You</p>
          <p>Please Come Again</p>
        </div>

      </div>
    </div>
  )
}
