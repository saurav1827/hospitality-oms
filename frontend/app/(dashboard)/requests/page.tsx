'use client'

import { useEffect, useState, useMemo } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useSession } from '@/lib/use-session'
import { useRealtime } from '@/lib/use-realtime'
import { apiFetch, type Delivery, type Runner, type Order, assignDelivery, completeDelivery } from '@/lib/api-client'
import { RefreshCw, CheckCircle2, User, Loader2, QrCode, Navigation, PackageCheck, CheckCircle, Filter, Calendar, Search, Clock3, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { OrderDetailModal } from '@/components/OrderDetailModal'

import { GlobalSearch } from '@/components/GlobalSearch'
import { MultiSelectFilter, FilterTrigger } from '@/components/MultiSelectFilter'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { ActiveFiltersDisplay, FilterBar } from '@/components/FilterChips'
import { useFilterState } from '@/lib/use-filter-state'
import { applyFilters, DELIVERY_STATUS_OPTIONS, type FilterState } from '@/lib/filters'

type DeliveryWithMeta = Delivery & { createdAt?: string; total?: string }

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
    ready: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
    assigned: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
    delivered: 'bg-zinc-500/10 text-zinc-400 ring-zinc-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  }
  const style = styles[status] || styles.new
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${style} capitalize`}>
      {status}
    </span>
  )
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4"><div className="h-4 w-24 bg-white/10 rounded" /></td>
      <td className="px-6 py-4"><div className="h-4 w-16 bg-white/10 rounded" /></td>
      <td className="px-6 py-4"><div className="h-4 w-20 bg-white/10 rounded" /></td>
      <td className="px-6 py-4"><div className="h-4 w-24 bg-white/10 rounded" /></td>
      <td className="px-6 py-4"><div className="h-4 w-24 bg-white/10 rounded" /></td>
    </tr>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{ size?: number }>; title: string; description: string }) {
  return (
    <div className="text-center py-12">
      <span className="mx-auto mb-4 opacity-20 text-zinc-500 inline-block">
        <Icon size={48} />
      </span>
      <h4 className="font-medium text-zinc-300 mb-1">{title}</h4>
      <p className="text-sm text-zinc-500">{description}</p>
    </div>
  )
}

export default function ServiceRequestsPage() {
  const router = useRouter()
  const { session, isLoading: sessionLoading } = useSession()
  const propertyId = session?.propertyId ?? ''

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/login')
  }, [sessionLoading, session, router])

  const { data: deliveriesData, mutate, isLoading: isRefreshing } = useSWR<{ deliveries: Delivery[] }>(
    propertyId ? `/api/properties/${propertyId}/deliveries/` : null,
    apiFetch
  )

  const { lastEvent } = useRealtime(propertyId || '')

  useEffect(() => {
    if (lastEvent?.type === 'order_updated' || lastEvent?.type === 'new_notification') {
      mutate()
    }
  }, [lastEvent, mutate])
  const deliveries = deliveriesData?.deliveries ?? []

  const { data: runnersData } = useSWR<{ runners: Runner[] }>(
    propertyId ? `/api/properties/${propertyId}/runners/` : null,
    apiFetch
  )
  const runners = runnersData?.runners ?? []

  const { data: ordersData } = useSWR<{ orders: Order[] }>(
    propertyId ? `/api/properties/${propertyId}/orders/` : null,
    apiFetch
  )
  const orders = ordersData?.orders ?? []

  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending')
  const [assigning, setAssigning] = useState<string | null>(null)
  const [completing, setCompleting] = useState<string | null>(null)
  const [selectedRunners, setSelectedRunners] = useState<Record<string, number>>({})
  const [showQR, setShowQR] = useState<{ deliveryId: string, tableNumber: string, total: string } | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const deliveryStatusOptions = DELIVERY_STATUS_OPTIONS.map(opt => ({ 
    ...opt, 
    count: deliveries.filter(d => d.status === opt.value).length 
  }))

  const filterState = useFilterState<DeliveryWithMeta>({
    defaultPageSize: 5,
    defaultSortBy: 'createdAt',
    defaultSortOrder: 'desc',
    searchFields: ['orderId', 'roomNumber', 'runnerId', 'status'],
    persistToUrl: true,
    urlKeyPrefix: 'requests_',
  })

  const { state, setSearchQuery, setFilters, setDateRange, clearAllFilters, activeFilterCount } = filterState

  const filteredDeliveries = useMemo(() => {
    let result = applyFilters(deliveries, {
      ...state,
      searchConfig: { fields: ['orderId', 'roomNumber', 'runnerId', 'status'] },
    })

    if (activeTab === 'pending') {
      result = result.filter(d => ['new', 'ready', 'assigned'].includes(d.status))
    } else {
      result = result.filter(d => ['delivered', 'completed'].includes(d.status))
    }

    return result
  }, [deliveries, state, activeTab])

  const paginatedDeliveries = useMemo(() => {
    const start = (state.page - 1) * state.pageSize
    return (filteredDeliveries as DeliveryWithMeta[]).slice(start, start + state.pageSize)
  }, [filteredDeliveries, state.page, state.pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredDeliveries.length / state.pageSize))

  const handleSearchResults = async (query: string) => {
    if (!query.trim()) return []
    return deliveries
      .filter(d => 
        d.orderId.toLowerCase().includes(query.toLowerCase()) ||
        d.roomNumber.toLowerCase().includes(query.toLowerCase()) ||
        d.status.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 10)
      .map(delivery => ({
        id: delivery.id,
        title: `Table ${delivery.roomNumber}`,
        subtitle: `Order ${delivery.orderId.substring(0, 8)} • ${delivery.status}`,
        category: 'Delivery',
        badge: delivery.status,
        action: () => {},
      }))
  }

  const handleRunnerSelect = (deliveryId: string, runnerId: number) => {
    setSelectedRunners(prev => ({ ...prev, [deliveryId]: runnerId }))
  }

  const handleAssign = async (deliveryId: string) => {
    const runnerId = selectedRunners[deliveryId]
    if (!runnerId) {
      toast.error('Please select a runner first')
      return
    }

    setAssigning(deliveryId)
    try {
      await assignDelivery(deliveryId, runnerId)
      const runnerName = runners.find(r => r.id === runnerId)?.name
      toast.success(`Delivery assigned to ${runnerName || 'runner'}!`)
      mutate()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign delivery')
    } finally {
      setAssigning(null)
    }
  }

  const handleComplete = async (deliveryId: string, tableNumber: string) => {
    setCompleting(deliveryId)
    try {
      await completeDelivery(deliveryId)
      toast.success('Delivered to table!')
      const delivery = (deliveries as DeliveryWithMeta[]).find(d => d.id === deliveryId)
      setShowQR({ deliveryId, tableNumber, total: delivery?.total || '0' })
      mutate()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to complete delivery')
    } finally {
      setCompleting(null)
    }
  }

  if (sessionLoading) return null
  if (!session) return null

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-500">
      <motion.section
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <span className="text-xs font-semibold tracking-wider text-orange-400 uppercase flex items-center gap-2">
            <QrCode size={14} /> Table Service & Dispatch
          </span>
          <h2 className="text-3xl font-bold tracking-tight mt-1 text-zinc-50">Service Requests</h2>
          <p className="text-sm text-zinc-400 mt-1">Dispatch waiters to deliver food and process payments at the table.</p>
        </div>
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-black/40 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl backdrop-blur-xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-white/10 gap-4">
          <div className="flex gap-6">
            <button
              onClick={() => { setActiveTab('pending'); filterState.setPage(1); }}
              className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${activeTab === 'pending' ? 'border-orange-500 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              Pending Dispatch
            </button>
            <button
              onClick={() => { setActiveTab('completed'); filterState.setPage(1); }}
              className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${activeTab === 'completed' ? 'border-orange-500 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              Completed
            </button>
          </div>
          <button
            onClick={() => mutate()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors border border-white/5"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-orange-400' : ''} />
            Refresh List
          </button>
        </div>



        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white/5 text-zinc-400 uppercase tracking-wider text-xs font-semibold border-b border-white/10">
              <tr>
                <th className="px-6 py-4">Destination</th>
                <th className="px-6 py-4">Order Ref</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Assigned Runner</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence mode="popLayout">
                {isRefreshing ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : paginatedDeliveries.length > 0 ? (
                  paginatedDeliveries.map((delivery, index) => {
                    const order = orders.find(o => o.id === delivery.orderId)
                    return (
                    <motion.tr
                      key={delivery.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => {
                        if (order) {
                          setSelectedOrder(order)
                        } else {
                          toast.error(`Order details not found for ID: ${delivery.orderId}`)
                        }
                      }}
                      className="hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 border border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.1)]">
                            <Navigation size={18} />
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-200">Table {delivery.roomNumber}</div>
                            <div className="text-xs text-zinc-500 mt-0.5">Dine-in Order</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => {
                            const order = orders.find(o => o.id === delivery.orderId)
                            if (order) {
                              setSelectedOrder(order)
                            } else {
                              toast.error(`Order details not found for ID: ${delivery.orderId}`)
                            }
                          }}
                          className="flex flex-col gap-1 text-left hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-orange-500/50 rounded-lg p-1 -ml-1 group"
                        >
                          <div className="font-mono text-zinc-300 text-sm font-semibold flex items-center gap-1.5">
                            #{delivery.orderNumber ?? '???'}
                            <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-orange-400 transition-opacity" />
                          </div>
                          {delivery.orderCreatedAt && (
                            <div className="text-xs text-zinc-500">
                              Placed: {new Date(delivery.orderCreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                          {delivery.timeToReadyMs != null && (
                            <div className="text-xs text-emerald-500/90 font-medium">
                              Ready in: {Math.max(1, Math.round(delivery.timeToReadyMs / 60000))}m
                            </div>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={delivery.status} />
                      </td>
                      <td className="px-6 py-4">
                        {['assigned', 'delivered', 'completed'].includes(delivery.status) && delivery.runnerId ? (
                          <div className="flex items-center gap-2 text-zinc-300">
                            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                              <User size={12} />
                            </div>
                            <span className="font-medium">
                              {runners.find(r => r.id === delivery.runnerId)?.name || `Runner #${delivery.runnerId}`}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select
                              onClick={(e) => e.stopPropagation()}
                              value={selectedRunners[delivery.id] || ''}
                              onChange={(e) => handleRunnerSelect(delivery.id, parseInt(e.target.value))}
                              className="bg-black/20 border border-white/10 text-zinc-300 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2 max-w-[200px]"
                              disabled={delivery.status !== 'ready'}
                            >
                              <option className="bg-zinc-900 text-zinc-100" value="" disabled>Select a runner...</option>
                              {runners.map(runner => (
                                <option className="bg-zinc-900 text-zinc-100" key={runner.id} value={runner.id}>
                                  {runner.name} ({runner.role})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {delivery.status === 'ready' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAssign(delivery.id); }}
                            disabled={assigning === delivery.id || !selectedRunners[delivery.id]}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-zinc-950 font-bold rounded-xl transition-all disabled:opacity-50 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950 shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:shadow-[0_0_25px_rgba(249,115,22,0.4)]"
                          >
                            {assigning === delivery.id ? (
                              <><Loader2 size={16} className="animate-spin" /> Assigning...</>
                            ) : (
                              <><CheckCircle2 size={16} /> Dispatch</>
                            )}
                          </button>
                        )}
                        {delivery.status === 'assigned' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleComplete(delivery.id, delivery.roomNumber); }}
                            disabled={completing === delivery.id}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-zinc-950 font-bold rounded-xl transition-all disabled:opacity-50 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
                          >
                            {completing === delivery.id ? (
                              <><Loader2 size={16} className="animate-spin" /> Finishing...</>
                            ) : (
                              <><CheckCircle size={16} /> Mark Delivered</>
                            )}
                          </button>
                        )}
                        {delivery.status === 'delivered' && (
                          <span className="text-zinc-500 text-sm font-medium">Completed</span>
                        )}
                        {delivery.status === 'completed' && (
                          <span className="text-emerald-500 text-sm font-medium">Settled</span>
                        )}
                      </td>
                    </motion.tr>
                  )})
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-zinc-500">
                      <EmptyState
                        icon={PackageCheck}
                        title={`No ${activeTab} deliveries`}
                        description={state.searchQuery || state.filters.length > 0 || state.dateRange?.from
                          ? 'Try adjusting your filters or search terms.'
                          : activeTab === 'pending'
                            ? 'When the kitchen marks an order as ready, it will appear here.'
                            : 'Completed deliveries will appear here.'}
                      />
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-zinc-800/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-zinc-500">
            Showing {filteredDeliveries.length === 0 ? 0 : (state.page - 1) * state.pageSize + 1} to {Math.min(state.page * state.pageSize, filteredDeliveries.length)} of {filteredDeliveries.length} requests
          </div>
          <div className="flex items-center gap-2">
            <select
              value={state.pageSize}
              onChange={e => filterState.setPageSize(Number(e.target.value))}
              className="bg-black/20 border border-white/10 text-zinc-300 text-sm rounded-lg px-3 py-1.5 focus:ring-orange-500 focus:border-orange-500 shadow-inner"
            >
              <option className="bg-zinc-900 text-zinc-100" value={5}>5 per page</option>
              <option className="bg-zinc-900 text-zinc-100" value={10}>10 per page</option>
              <option className="bg-zinc-900 text-zinc-100" value={25}>25 per page</option>
              <option className="bg-zinc-900 text-zinc-100" value={50}>50 per page</option>
            </select>
            <button
              onClick={() => filterState.setPage((p: number) => Math.max(1, p - 1))}
              disabled={state.page === 1}
              className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-zinc-300 rounded text-sm transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => filterState.setPage((p: number) => Math.min(totalPages, p + 1))}
              disabled={state.page === totalPages}
              className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-zinc-300 rounded text-sm transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </motion.div>

      {showQR && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowQR(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-sm bg-black/80 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col p-8 items-center text-center"
          >
            <h4 className="text-xl font-bold text-zinc-100 mb-2">Check Settlement</h4>
            <p className="text-sm text-zinc-400 mb-8">Scan to pay or settle in cash.</p>

            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-[2rem] shadow-2xl mb-6 border-4 border-white/10">
              <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">Scan to Pay ₹{showQR.total}</p>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=restaurant@upi&am=${showQR.total}`} alt="QR Code" className="w-48 h-48 rounded-lg" />
              <p className="text-sm font-medium text-emerald-500 mt-4">Awaiting customer payment...</p>
            </div>

            <button
              onClick={() => setShowQR(null)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl transition-all focus:ring-2 focus:ring-zinc-600"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}

      {selectedOrder && (
        <OrderDetailModal
          onClose={() => setSelectedOrder(null)}
          order={selectedOrder}
        />
      )}
    </div>
  )
}