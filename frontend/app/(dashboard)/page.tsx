'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/use-session'
import { useRealtime } from '@/lib/use-realtime'
import { fetchRevenueSummary, fetchOrders, fetchDeliveries, type RevenueSummary } from '@/lib/api-client'
import { Clock3, CircleAlert, ShoppingBag, ChefHat, ReceiptText, Users, Plus, RefreshCw, X, TrendingUp, Package, Filter, ChevronDown, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { OrderDetailModal } from '@/components/OrderDetailModal'
import { useFilterState } from '@/lib/use-filter-state'
import { applyFilters, STATUS_OPTIONS } from '@/lib/filters'
import type { Delivery, Order } from '@/lib/api-client'

type DeliveryWithMeta = Delivery & { createdAt?: string; total?: string }

const ORDERS_PER_PAGE = 5
const ATTENTION_PREVIEW_COUNT = 5

// Order notes are stored as a JSON string (see the POS "Fire to Kitchen"
// flow) shaped like { orderType: 'dine-in' | 'room-service', tableNumber }.
// Deliveries don't carry orderType themselves, so we look the parent order
// up by id and read it from there to know whether to label a queue item
// "Table" or "Room" instead of showing both.
function getServiceInfo(order: Order | undefined, fallbackNumber: string): { typeLabel: string; identifier: string } {
  let orderType = 'dine-in'
  let tableNumber = fallbackNumber
  try {
    if (order?.notes && order.notes.startsWith('{')) {
      const parsed = JSON.parse(order.notes)
      if (parsed.orderType) orderType = parsed.orderType
      if (parsed.tableNumber) tableNumber = parsed.tableNumber
    }
  } catch (e) { }
  return {
    typeLabel: orderType === 'room-service' ? 'Room' : 'Table',
    identifier: tableNumber,
  }
}

// Dot color accent per status. Falls back to the neutral "all" style for any
// status not explicitly listed here, so new statuses added to STATUS_OPTIONS
// don't need a matching entry to render correctly.
const STATUS_TAB_STYLES: Record<string, { dot: string }> = {
  all: { dot: 'bg-zinc-400' },
  new: { dot: 'bg-blue-400' },
  submitted: { dot: 'bg-blue-400' },
  preparing: { dot: 'bg-amber-400' },
  assigned: { dot: 'bg-amber-400' },
  ready: { dot: 'bg-emerald-400' },
  served: { dot: 'bg-zinc-400' },
  paid: { dot: 'bg-purple-400' },
  cancelled: { dot: 'bg-red-400' },
}

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'total:desc', label: 'Highest amount' },
  { value: 'total:asc', label: 'Lowest amount' },
]

// Replaces the old full-width row of status tabs (which wrapped/overflowed
// and pushed the whole page taller once there were 5+ statuses). This is a
// single compact filter button + dropdown that supports selecting more than
// one status at once (results are the union of every selected status), with
// the current selection shown as small removable chips next to the button.
function StatusFilterMenu({
  options,
  selected,
  onChange,
  totalCount,
}: {
  options: { value: string; label: string; count: number }[]
  selected: string[]
  onChange: (next: string[]) => void
  totalCount: number
}) {
  const [open, setOpen] = useState(false)
  const allSelected = selected.length === 0

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value])
  }

  const buttonLabel = allSelected
    ? 'All statuses'
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label ?? selected[0]
      : `${selected.length} statuses`

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-zinc-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors backdrop-blur-md"
        >
          <Filter size={15} className="text-zinc-500" />
          <span className="capitalize">{buttonLabel}</span>
          {!allSelected && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 tabular-nums">
              {selected.length}
            </span>
          )}
          <ChevronDown size={14} className={`text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute left-0 mt-2 w-56 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-20 p-1.5"
            >
              <button
                onClick={() => onChange([])}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${allSelected ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                  All
                </span>
                <span className="text-xs tabular-nums text-zinc-500">{totalCount}</span>
              </button>
              <div className="my-1 h-px bg-zinc-800" />
              {options.map(opt => {
                const isChecked = selected.includes(opt.value)
                const style = STATUS_TAB_STYLES[opt.value] || STATUS_TAB_STYLES.all
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggle(opt.value)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${isChecked ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                  >
                    <span className="flex items-center gap-2 capitalize">
                      <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${isChecked ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-700'}`}>
                        {isChecked && <Check size={10} className="text-zinc-950" />}
                      </span>
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                      {opt.label}
                    </span>
                    <span className="text-xs tabular-nums text-zinc-500">{opt.count}</span>
                  </button>
                )
              })}
            </motion.div>
          </>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {selected.map(value => {
            const opt = options.find(o => o.value === value)
            const style = STATUS_TAB_STYLES[value] || STATUS_TAB_STYLES.all
            return (
              <span
                key={value}
                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 text-xs font-medium text-zinc-300 bg-zinc-800/70 border border-zinc-700/50 rounded-full"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                <span className="capitalize">{opt?.label ?? value}</span>
                <button
                  onClick={() => toggle(value)}
                  className="p-0.5 text-zinc-500 hover:text-white hover:bg-zinc-700 rounded-full transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            )
          })}
          <button onClick={() => onChange([])} className="text-xs text-zinc-500 hover:text-zinc-300 px-1 transition-colors">
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

function SortMenu({
  sortBy,
  sortOrder,
  onChange,
}: {
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void
}) {
  const [open, setOpen] = useState(false)
  const current = SORT_OPTIONS.find(o => o.value === `${sortBy}:${sortOrder}`) || SORT_OPTIONS[0]

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
      >
        <Filter size={15} className="text-zinc-500" />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-20 p-1.5"
          >
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  const [by, order] = opt.value.split(':') as [string, 'asc' | 'desc']
                  onChange(by, order)
                  setOpen(false)
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${opt.value === current.value ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
              >
                {opt.label}
                {opt.value === current.value && <Check size={14} />}
              </button>
            ))}
          </motion.div>
        </>
      )}
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4"><div className="h-4 w-24 bg-zinc-800 rounded" /></td>
      <td className="px-6 py-4"><div className="h-4 w-20 bg-zinc-800 rounded" /></td>
      <td className="px-6 py-4"><div className="h-4 w-16 bg-zinc-800 rounded" /></td>
      <td className="px-6 py-4"><div className="h-4 w-20 bg-zinc-800 rounded" /></td>
      <td className="px-6 py-4"><div className="h-4 w-24 bg-zinc-800 rounded" /></td>
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

// Single-row layout (icon + value + label side by side) instead of the old
// stacked label/icon → value → trend-label layout. This is roughly half the
// height of the original card, freeing up vertical room for a full 5-row
// order table underneath without pushing the page height past the fold.
function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  color = 'emerald',
  loading = false
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ size?: number }>
  trend?: number
  trendLabel?: string
  color?: 'emerald' | 'amber' | 'blue' | 'orange' | 'purple'
  loading?: boolean
}) {
  const colorClasses = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  }

  const iconBgClasses = {
    emerald: 'bg-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/20 text-amber-400',
    blue: 'bg-blue-500/20 text-blue-400',
    orange: 'bg-orange-500/20 text-orange-400',
    purple: 'bg-purple-500/20 text-purple-400',
  }

  const cardClass = colorClasses[color]
  const iconBgClass = iconBgClasses[color]

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`animate-pulse ${cardClass} border rounded-lg p-3 backdrop-blur-sm transition-all duration-300`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-5 w-14 bg-zinc-800 rounded mb-1.5" />
            <div className="h-2.5 w-20 bg-zinc-800 rounded" />
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`${cardClass} border rounded-lg p-3 backdrop-blur-sm transition-all duration-300 hover:shadow-[0_0_16px_rgba(234,179,8,0.08)]`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${iconBgClass} flex items-center justify-center flex-shrink-0`}>
          <Icon size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <strong className="text-lg font-bold tabular-nums text-zinc-100 leading-none">{value}</strong>
            {trend !== undefined && (
              <span className={`flex items-center gap-0.5 text-[10px] font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                <TrendingUp size={10} className={trend < 0 ? 'rotate-180' : ''} />
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 truncate">{label}</span>
            {trendLabel && <span className="text-[10px] text-zinc-600 truncate">· {trendLabel}</span>}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function OrderRow({
  order,
  onClick,
  onQuickAction,
  isNew = false,
  index = 0,
}: {
  order: Order
  onClick: () => void
  onQuickAction?: (action: string, order: Order) => void
  isNew?: boolean
  index?: number
}) {
  const statusTones: Record<string, string> = {
    new: 'new',
    submitted: 'new',
    preparing: 'preparing',
    ready: 'ready',
    assigned: 'preparing',
    served: 'neutral',
    paid: 'positive',
    cancelled: 'negative',
  }

  return (
    <motion.tr
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.03 }}
      className="cursor-pointer transition-colors group"
      whileHover={{ backgroundColor: 'rgba(39, 39, 42, 0.5)' }}
      onClick={onClick}
    >
      <motion.td
        className="px-6 py-4"
        animate={{ backgroundColor: isNew ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0)' }}
        transition={{ duration: 2 }}
      >
        <div className="flex items-center gap-3">
          <strong className="text-zinc-100">#{order.number}</strong>
          <span className="text-xs text-zinc-500 font-mono bg-zinc-800/50 px-1.5 py-0.5 rounded">
            {order.id.split('-')[0]}
          </span>
          {isNew && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
              New
            </span>
          )}
        </div>
      </motion.td>
      <td className="px-6 py-4">
        <div className="text-zinc-300">
          {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '-'}
        </div>
        <div className="text-xs text-zinc-500">
          {order.createdAt ? new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1 text-zinc-300">
          {order.items.slice(0, 2).map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="font-medium text-emerald-400">{item.quantity}x</span>
              <span className="truncate max-w-[150px]">{item.name}</span>
            </div>
          ))}
          {order.items.length > 2 && (
            <div className="text-xs text-zinc-500 italic">+ {order.items.length - 2} more items</div>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <strong className="text-emerald-400">₹{order.total}</strong>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <span className={`status-pill status-${statusTones[order.status] || 'new'}`}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); onQuickAction?.('print', order) }}
              className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              title="Print ticket"
            >
              <Package size={14} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onQuickAction?.('assign', order) }}
              className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              title="Assign runner"
            >
              <Clock3 size={14} />
            </button>
          </div>
        </div>
      </td>
    </motion.tr>
  )
}

// Compact single-row attention card. The previous version stacked title,
// badge, description and two full-size buttons across ~4 lines per item;
// this collapses it to one row (marker + text + actions) so 3 items no
// longer pushes the side panel taller than the orders table next to it.
function AttentionItem({
  delivery,
  order,
  onAssign,
  onView,
  index = 0,
}: {
  delivery: DeliveryWithMeta
  order?: Order
  onAssign: () => void
  onView: () => void
  index?: number
}) {
  const waitTime = delivery.createdAt
    ? Math.floor((Date.now() - new Date(delivery.createdAt).getTime()) / 60000)
    : 0
  const isUrgent = waitTime > 10
  const { typeLabel, identifier } = getServiceInfo(order, delivery.roomNumber)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, x: -12 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -8, x: 12 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      className={`group relative flex items-center gap-3 p-3 rounded-xl border transition-colors backdrop-blur-sm ${isUrgent
        ? 'bg-red-500/10 border-red-500/20'
        : 'bg-black/40 border-white/10 hover:bg-white/5'
        }`}
    >
      {isUrgent && (
        <motion.div
          className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${isUrgent ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-400'
        }`}>
        <Clock3 size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <strong className="text-sm text-zinc-100 truncate">{typeLabel} {identifier}</strong>
          {isUrgent && (
            <span className="flex-shrink-0 text-[10px] font-bold text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded-full">
              {waitTime}m wait
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 truncate">
          Ready · <code className="text-zinc-400">{delivery.orderId.substring(0, 8)}</code>
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onAssign}
          className="px-2.5 py-1.5 text-xs font-semibold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors"
        >
          Assign
        </button>
        <button
          onClick={onView}
          className="px-2 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5"
        >
          View
        </button>
      </div>
    </motion.div>
  )
}

export default function OverviewDashboard() {
  const router = useRouter()
  const { session, isLoading: sessionLoading } = useSession()
  const propertyId = session?.propertyId ?? ''

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/login')
  }, [sessionLoading, session, router])

  const { data: revenueData, mutate: mutateStats } = useSWR<{ revenueSummary: RevenueSummary }>(
    propertyId ? [`/api/properties/${propertyId}/revenue-summary/`] : null,
    () => fetchRevenueSummary(propertyId)
  )
  const stats = revenueData?.revenueSummary

  const { data: liveData, mutate: mutateOrders, isLoading: ordersLoading } = useSWR<{ orders: Order[] }>(
    propertyId ? [`/api/properties/${propertyId}/orders/`] : null,
    () => fetchOrders(propertyId)
  )
  const liveOrders = liveData?.orders ?? []

  const { data: deliveriesData, mutate: mutateDeliveries, isLoading: deliveriesLoading } = useSWR<{ deliveries: Delivery[] }>(
    propertyId ? [`/api/properties/${propertyId}/deliveries/`] : null,
    () => fetchDeliveries(propertyId)
  )
  const allDeliveries = deliveriesData?.deliveries ?? []

  const { lastEvent } = useRealtime(propertyId || '')

  useEffect(() => {
    if (lastEvent?.type === 'order_updated' || lastEvent?.type === 'new_notification') {
      mutateOrders()
      mutateDeliveries()
      mutateStats()
    }
  }, [lastEvent, mutateOrders, mutateDeliveries, mutateStats])

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showAllAttention, setShowAllAttention] = useState(false)
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())

  // --- Track genuinely new orders arriving from the live poll, so we can
  // highlight them briefly instead of a dead `newOrderIds` state that was
  // never actually populated before.
  const knownOrderIdsRef = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!liveData?.orders) return
    const currentIds = new Set(liveData.orders.map(o => o.id))

    if (knownOrderIdsRef.current) {
      const arrived = liveData.orders
        .filter(o => !knownOrderIdsRef.current!.has(o.id))
        .map(o => o.id)

      if (arrived.length > 0) {
        setNewOrderIds(prev => new Set([...prev, ...arrived]))
        const timer = setTimeout(() => {
          setNewOrderIds(prev => {
            const next = new Set(prev)
            arrived.forEach(id => next.delete(id))
            return next
          })
        }, 4000)
        knownOrderIdsRef.current = currentIds
        return () => clearTimeout(timer)
      }
    }
    knownOrderIdsRef.current = currentIds
  }, [liveData])

  const statusOptions = STATUS_OPTIONS.map(opt => ({ ...opt, count: liveOrders.filter(o => o.status === opt.value).length }))

  const filterState = useFilterState<Order>({
    defaultPageSize: ORDERS_PER_PAGE,
    defaultSortBy: 'createdAt',
    defaultSortOrder: 'desc',
    searchFields: ['number', 'id', 'status', 'total', 'items.0.name'],
    persistToUrl: true,
    urlKeyPrefix: 'overview_',
  })

  const { state, setFilters, setPage, setSort } = filterState

  // Status filtering now supports selecting more than one status at once.
  // Each selected status becomes an OR'd condition inside the same 'status'
  // filter group, so the table shows the union of every selected status.
  const activeStatuses = state.filters.find(f => f.id === 'status')?.conditions?.map(c => c.value as string) ?? []

  const setStatusFilter = (next: string[]) => {
    setPage(1)
    const otherFilters = state.filters.filter(f => f.id !== 'status')
    if (next.length === 0) {
      setFilters(otherFilters)
      return
    }
    const conditions = next.map(value => {
      const opt = statusOptions.find(o => o.value === value)
      return { field: 'status', operator: 'equals' as const, value, label: opt?.label || value }
    })
    setFilters([
      ...otherFilters,
      { id: 'status', label: 'Status', conditions, logic: 'OR' as const },
    ])
  }

  // applyFilters() already sorts according to state.sortBy / state.sortOrder
  // (newest-first by default) — no extra .reverse() needed here. The previous
  // .reverse() silently undid that sort, which is why "recent orders first"
  // looked broken.
  const filteredOrders = useMemo(() => {
    return applyFilters(liveOrders, {
      ...state,
      searchConfig: { fields: ['number', 'id', 'status', 'total', 'items.0.name'] },
    })
  }, [liveOrders, state])

  // Page size is fixed at ORDERS_PER_PAGE (5) — letting people bump it up to
  // 10/25/50 was what made the table (and the page underneath it) grow tall
  // enough to break the layout, so that control has been removed rather than
  // just hidden.
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE))

  const paginatedOrders = useMemo(() => {
    const start = (state.page - 1) * ORDERS_PER_PAGE
    return filteredOrders.slice(start, start + ORDERS_PER_PAGE)
  }, [filteredOrders, state.page])

  // If a filter/search shrinks the result set below the current page, snap
  // back into range instead of showing a blank "no orders" table.
  useEffect(() => {
    if (state.page > totalPages) {
      setPage(totalPages)
    }
  }, [state.page, totalPages, setPage])

  const attentionDeliveries = useMemo(() =>
    (allDeliveries as DeliveryWithMeta[]).filter(d => ['new', 'ready', 'assigned'].includes(d.status))
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
    , [allDeliveries])

  const orderLookup = useMemo(() => new Map(liveOrders.map(o => [o.id, o] as const)), [liveOrders])

  const handleQuickAction = (action: string, order: Order) => {
    switch (action) {
      case 'print':
        window.open(`/print/${order.id}`, '_blank')
        break
      case 'assign':
        router.push(`/requests?requests_search=${order.id}`)
        break
    }
  }

  const openDeliveryDetail = (delivery: DeliveryWithMeta) => {
    setSelectedOrder({
      id: delivery.orderId,
      number: parseInt(delivery.orderId.slice(-6), 16),
      status: 'ready',
      total: '0',
      subtotal: '0',
      taxTotal: '0',
      notes: '',
      createdAt: delivery.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paymentMethod: null,
      deliveredAt: null,
      items: [],
    } as Order)
  }

  if (sessionLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-emerald-500">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Package size={32} />
          <span className="text-sm font-medium text-zinc-400">Loading workspace...</span>
        </div>
      </div>
    )
  }
  if (!session) return null

  return (
    <>


      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="metrics-grid"
        aria-label="Operational summary"
      >
        <MetricCard
          label="Open Orders"
          value={stats?.openOrders ?? '-'}
          icon={ShoppingBag}
          color="blue"
          trendLabel="vs last hour"
          loading={!stats}
        />
        <MetricCard
          label="In Kitchen"
          value={stats?.preparingOrders ?? '-'}
          icon={ChefHat}
          color="amber"
          trendLabel="preparing now"
          loading={!stats}
        />
        <MetricCard
          label="Today's Revenue"
          value={`₹${stats?.grossRevenue ?? '-'}`}
          icon={ReceiptText}
          color="emerald"
          trendLabel="paid orders"
          loading={!stats}
        />
        <MetricCard
          label="Total Orders"
          value={stats?.orderCount ?? '-'}
          icon={Users}
          color="purple"
          trendLabel="all time"
          loading={!stats}
        />
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="space-y-6"
      >
        <div className="content-grid">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="panel orders-panel"
          >
            <div className="panel-heading flex flex-col gap-4">
              <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="eyebrow">Real-time queue</span>
                  <h3>Order Activity</h3>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => mutateOrders()}
                    disabled={ordersLoading}
                    className="ghost-button flex items-center gap-2"
                  >
                    <RefreshCw size={15} className={ordersLoading ? 'animate-spin text-emerald-400' : ''} />
                    Refresh
                  </button>
                  <Link href="/orders" className="primary-button inline-flex items-center gap-2">
                    <Plus size={17} /> New order
                  </Link>
                </div>
              </div>

              {/* Status filtering lives in one compact dropdown now instead
                  of a row of tabs — selecting a status (or several) shows as
                  chips here, and the table shows the union of whatever's
                  selected. The sort menu on the right covers newest/oldest/
                  amount sorting. */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-zinc-800/50 sm:border-t-0 sm:pt-0">
                <StatusFilterMenu
                  options={statusOptions}
                  selected={activeStatuses}
                  onChange={setStatusFilter}
                  totalCount={liveOrders.length}
                />
                <SortMenu sortBy={state.sortBy} sortOrder={state.sortOrder} onChange={setSort} />
              </div>
            </div>

            <div className="table-wrap overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900/50 text-zinc-400 uppercase tracking-wider text-xs font-semibold border-b border-zinc-800/50">
                  <tr>
                    <th className="px-6 py-4">Order</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Items</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  <AnimatePresence mode="popLayout">
                    {ordersLoading && liveOrders.length === 0 ? (
                      Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                    ) : paginatedOrders.length > 0 ? (
                      paginatedOrders.map((order, index) => (
                        <OrderRow
                          key={order.id}
                          order={order}
                          index={index}
                          onClick={() => setSelectedOrder(order)}
                          onQuickAction={handleQuickAction}
                          isNew={newOrderIds.has(order.id)}
                        />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12">
                          <EmptyState
                            icon={ShoppingBag}
                            title="No orders found"
                            description={activeStatuses.length > 0
                              ? 'Try different filters.'
                              : 'No active orders at the moment.'}
                          />
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            <div className="panel-footer flex flex-col sm:flex-row justify-between items-center p-4 border-t border-zinc-800 gap-4">
              <div className="text-sm text-zinc-500">
                Showing {filteredOrders.length === 0 ? 0 : (state.page - 1) * ORDERS_PER_PAGE + 1} to{' '}
                {Math.min(state.page * ORDERS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} orders
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                  disabled={state.page === 1}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded text-sm transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-zinc-500 px-1">
                  Page {state.page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                  disabled={state.page === totalPages}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded text-sm transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="panel attention-panel"
          >
            <div className="panel-heading flex items-center justify-between">
              <div>
                <span className="eyebrow">Requires action</span>
                <h3>Attention Queue</h3>
              </div>
              <span className="queue-count bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-sm font-medium">
                {attentionDeliveries.length}
              </span>
            </div>

            <div className="attention-list space-y-2">
              <AnimatePresence mode="popLayout">
                {deliveriesLoading && allDeliveries.length === 0 ? (
                  Array.from({ length: ATTENTION_PREVIEW_COUNT }).map((_, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 animate-pulse">
                      <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0" />
                      <div className="flex-1"><div className="h-3.5 w-2/3 bg-white/10 rounded mb-2" /><div className="h-3 w-1/3 bg-white/10 rounded" /></div>
                    </motion.div>
                  ))
                ) : attentionDeliveries.length > 0 ? (
                  attentionDeliveries.slice(0, ATTENTION_PREVIEW_COUNT).map((delivery, index) => (
                    <AttentionItem
                      key={delivery.id}
                      delivery={delivery}
                      order={orderLookup.get(delivery.orderId)}
                      index={index}
                      onAssign={() => router.push(`/requests?orderId=${delivery.orderId}`)}
                      onView={() => openDeliveryDetail(delivery)}
                    />
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="attention-item text-center py-8"
                  >
                    <div className="attention-marker green mx-auto mb-3 w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CircleAlert size={24} className="text-emerald-400" />
                    </div>
                    <div>
                      <strong className="text-zinc-100">All caught up</strong>
                      <p className="text-zinc-500 mt-1">No immediate attention required.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {attentionDeliveries.length > ATTENTION_PREVIEW_COUNT && (
                <button
                  onClick={() => setShowAllAttention(true)}
                  className="w-full p-3 text-sm text-center text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/30 transition-colors border-t border-zinc-800/50 font-medium"
                >
                  View all {attentionDeliveries.length} items
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}

      {showAllAttention && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setShowAllAttention(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-lg bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
          >
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
              <h3 className="text-lg font-bold text-zinc-100">All Attention Items</h3>
              <button onClick={() => setShowAllAttention(false)} className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              <div className="attention-list space-y-2">
                {attentionDeliveries.map((delivery, index) => (
                  <AttentionItem
                    key={delivery.id}
                    delivery={delivery}
                    order={orderLookup.get(delivery.orderId)}
                    index={Math.min(index, 10)}
                    onAssign={() => { setShowAllAttention(false); router.push(`/requests?requests_search=${delivery.orderId}`) }}
                    onView={() => openDeliveryDetail(delivery)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  )
}