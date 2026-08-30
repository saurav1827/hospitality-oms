'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useSession } from '@/lib/use-session'
import { useRealtime } from '@/lib/use-realtime'
import { apiFetch, type Order, markOrderReady } from '@/lib/api-client'
import { Clock3, UtensilsCrossed, RefreshCw, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

function StatusBadge({ status }: { status: string }) {
  const isPrep = status === 'preparing' || status === 'submitted'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset uppercase tracking-wider ${isPrep ? 'bg-amber-500/10 text-amber-400 ring-amber-500/20' : 'bg-blue-500/10 text-blue-400 ring-blue-500/20'
      }`}>
      {status === 'submitted' ? 'New' : 'Prep'}
    </span>
  )
}

function ElapsedTime({ createdAt }: { createdAt: string }) {
  const [mins, setMins] = useState(0)

  useEffect(() => {
    const calc = () => {
      const ms = Date.now() - new Date(createdAt).getTime()
      setMins(Math.floor(ms / 60000))
    }
    calc()
    const interval = setInterval(calc, 30000)
    return () => clearInterval(interval)
  }, [createdAt])

  const isWarning = mins > 15
  const isCritical = mins > 25

  return (
    <div className={`flex items-center gap-1.5 text-xs font-semibold ${isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-zinc-500'
      }`}>
      {isCritical ? <AlertCircle size={14} /> : <Clock3 size={14} />}
      {mins} min
    </div>
  )
}

export default function KitchenPage() {
  const router = useRouter()
  const { session, isLoading: sessionLoading } = useSession()
  const propertyId = session?.propertyId ?? ''

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/login')
  }, [sessionLoading, session, router])

  const { data: liveData, mutate: mutateOrders, isValidating: isRefreshing } = useSWR<{ orders: Order[] }>(
    propertyId ? `/api/properties/${propertyId}/orders/` : null,
    apiFetch
  )

  const { lastEvent } = useRealtime(propertyId || '')

  useEffect(() => {
    if (lastEvent?.type === 'order_updated' || lastEvent?.type === 'new_notification') {
      mutateOrders()
    }
  }, [lastEvent, mutateOrders])

  // SWR currently returns all orders, and my backend returns them sorted.
  // Filter active kitchen tickets client-side to ensure cache sharing with Orders tab
  const orders = liveData?.orders?.filter(o => o.status === 'submitted' || o.status === 'preparing') ?? []

  const [processing, setProcessing] = useState<string | null>(null)

  const handleMarkReady = async (orderId: string) => {
    setProcessing(orderId)
    try {
      await markOrderReady(orderId)
      toast.success(`Order marked as ready. Sent to Service Requests!`)
      mutateOrders()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update order status')
    } finally {
      setProcessing(null)
    }
  }

  if (sessionLoading) return null
  if (!session) return null

  return (
    <div className="flex flex-col gap-8 pb-12 h-full animate-in fade-in duration-500">

      {/* Page Header */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-semibold tracking-wider text-amber-400 uppercase flex items-center gap-2">
            <UtensilsCrossed size={14} /> Kitchen Display System
          </span>
          <h2 className="text-3xl font-bold tracking-tight mt-1 text-zinc-50">Active Tickets</h2>
        </div>
        <button
          onClick={() => mutateOrders()}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors shadow-sm backdrop-blur-md hover:bg-white/10"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-amber-400' : ''} />
          Sync Queue
        </button>
      </section>

      {/* Ticket Kanban Board */}
      <div className="flex-1 overflow-y-auto pb-4 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">

          {orders.length === 0 ? (
            <div className="w-full md:col-span-2 lg:col-span-3 xl:col-span-4 flex flex-col items-center justify-center py-24 text-zinc-500 bg-white/5 border border-white/10 rounded-2xl border-dashed backdrop-blur-sm">
              <CheckCircle2 size={48} className="mb-4 opacity-20 text-emerald-500" />
              <p className="text-lg font-medium text-zinc-400">The line is clear!</p>
              <p className="text-sm mt-1">No active tickets require preparation.</p>
            </div>
          ) : (
            orders.map(order => {
              // Parse notes JSON if it exists
              let parsedNotes = { tableNumber: 'TBD', waiterName: 'Staff', generalNotes: order.notes }
              try {
                if (order.notes && order.notes.startsWith('{')) {
                  parsedNotes = JSON.parse(order.notes)
                }
              } catch (e) {
                // fallback to raw notes if not JSON
              }

              return (
                <div
                  key={order.id}
                  className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full backdrop-blur-xl relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
                  {/* Ticket Header */}
                  <div className="p-4 border-b border-white/10 bg-white/5 flex flex-col gap-3">
                    <div className="flex justify-between items-start relative z-10">
                      <div>
                        <div className="font-bold text-2xl text-white tracking-tight">
                          {/^\d+$/.test(String(parsedNotes.tableNumber)) ? `Table ${parsedNotes.tableNumber}` : parsedNotes.tableNumber}
                        </div>
                        <div className="text-xs text-zinc-400 mt-1.5 font-mono bg-black/20 px-2 py-0.5 rounded-md inline-block">#{order.number} • {parsedNotes.waiterName}</div>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>

                    {order.createdAt ? (
                      <div className="bg-black/30 backdrop-blur-md w-fit px-2.5 py-1.5 rounded-lg border border-white/10 relative z-10 shadow-inner">
                        <ElapsedTime createdAt={order.createdAt} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 bg-zinc-900 w-fit px-2 py-1 rounded-md">
                        <Clock3 size={14} className="text-amber-500" /> In Progress
                      </div>
                    )}
                  </div>

                  {/* Ticket Items */}
                  <div className="flex-1 p-5 overflow-y-auto max-h-[320px] custom-scrollbar relative z-10">
                    <ul className="space-y-1">
                      {order.items.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0 last:pb-0">
                          <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-400 font-bold flex items-center justify-center flex-shrink-0 border border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.1)]">
                            {item.quantity}
                          </div>
                          <div className="flex-1">
                            <span className="font-semibold text-zinc-100 block text-[15px] tracking-wide">{item.name}</span>
                            {/* Modifiers would go here */}
                          </div>
                        </li>
                      ))}
                    </ul>

                    {parsedNotes.generalNotes && (
                      <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Order Notes</div>
                        <p className="text-sm text-red-200 leading-relaxed font-medium">{parsedNotes.generalNotes}</p>
                      </div>
                    )}
                  </div>

                  {/* Ticket Footer */}
                  <div className="p-4 border-t border-white/5 bg-white/[0.02] relative z-10">
                    <button
                      onClick={() => handleMarkReady(order.id)}
                      disabled={processing === order.id}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-zinc-950 font-bold rounded-xl transition-all disabled:opacity-50 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950 shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:shadow-[0_0_25px_rgba(249,115,22,0.4)]"
                    >
                      {processing === order.id ? (
                        <><Loader2 size={18} className="animate-spin" /> Updating...</>
                      ) : (
                        <><CheckCircle2 size={18} /> Mark as Ready</>
                      )}
                    </button>
                  </div>
                </div>
              )
            })
          )}

        </div>
      </div>
    </div>
  )
}
