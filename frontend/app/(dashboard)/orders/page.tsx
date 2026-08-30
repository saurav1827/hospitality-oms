'use client'

import { useEffect, useState, useMemo } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useSession } from '@/lib/use-session'
import { useRealtime } from '@/lib/use-realtime'
import { apiFetch, type Order, type MenuItem, type Location, type Room, submitOrder, updateOrder, deleteOrder } from '@/lib/api-client'
import { Plus, X, ShoppingBag, Loader2, Search, CreditCard, ChevronRight, Edit3, Filter, ChevronDown, Check, Trash2, Utensils } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { OrderDetailModal } from '@/components/OrderDetailModal'
import { useFilterState } from '@/lib/use-filter-state'
import { applyFilters, STATUS_OPTIONS } from '@/lib/filters'

const ORDERS_PER_PAGE = 5

// Dot color per status for the filter dropdown. Falls back to the neutral
// "all" style for any status not explicitly listed, so new statuses added to
// STATUS_OPTIONS still render sensibly without a matching entry here.
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

// Replaces the old full-width row of status tabs (which wrapped onto extra
// lines and grew the page once there were 5+ statuses). This is a single
// compact filter button + dropdown that supports selecting more than one
// status at once (the table shows the union of every selected status), with
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
              transition={{ duration: 0.15 }}
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
        className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-zinc-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors backdrop-blur-md"
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
            className="absolute right-0 mt-2 w-48 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-20 p-1.5"
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
    submitted: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
    preparing: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
    ready: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
    served: 'bg-zinc-500/10 text-zinc-400 ring-zinc-500/20',
    paid: 'bg-purple-500/10 text-purple-400 ring-purple-500/20',
    cancelled: 'bg-red-500/10 text-red-400 ring-red-500/20',
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
      <td className="px-6 py-4"><div className="h-4 w-20 bg-white/10 rounded" /></td>
      <td className="px-6 py-4"><div className="h-4 w-24 bg-white/10 rounded" /></td>
      <td className="px-6 py-4"><div className="h-4 w-20 bg-white/10 rounded" /></td>
      <td className="px-6 py-4"><div className="h-4 w-20 bg-white/10 rounded" /></td>
      <td className="px-6 py-4"><div className="h-4 w-32 bg-white/10 rounded" /></td>
      <td className="px-6 py-4"><div className="h-4 w-16 bg-white/10 rounded" /></td>
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

function OrderRow({
  order,
  onClick,
  onEdit,
  onDelete,
  menuItems,
  userRole
}: {
  order: Order
  onClick: () => void
  onEdit: (e: React.MouseEvent, order: Order) => void
  onDelete: (e: React.MouseEvent, order: Order) => void
  menuItems: MenuItem[]
  userRole: string | null
}) {
  let parsedNotes = { orderType: 'dine-in', tableNumber: '', generalNotes: order.notes }
  try {
    if (order.notes && order.notes.startsWith('{')) {
      parsedNotes = { ...parsedNotes, ...JSON.parse(order.notes) }
    }
  } catch (e) { }

  return (
    <motion.tr
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="cursor-pointer hover:bg-white/5 transition-colors"
      onClick={onClick}
    >
      <td className="px-6 py-4">
        <div className="font-semibold text-zinc-200">#{order.number}</div>
        <div className="text-xs text-zinc-500 mt-1 font-mono">{order.id.split('-')[0]}</div>
      </td>
      <td className="px-6 py-4">
        <div className="text-zinc-300">
          {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '-'}
        </div>
        <div className="text-xs text-zinc-500">
          {order.createdAt ? new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
        </div>
      </td>
      <td className="px-6 py-4">
        <StatusBadge status={order.status} />
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
        <div className="font-semibold text-emerald-400">₹{order.total}</div>
      </td>
      <td className="px-6 py-4">
        <div className="max-w-[200px] truncate text-zinc-400">
          {parsedNotes.generalNotes || <span className="italic opacity-50">None</span>}
        </div>
        {parsedNotes.tableNumber && (
          <div className="text-xs text-zinc-500 mt-1">
            {parsedNotes.orderType === 'dine-in' ? 'Table' : 'Room'}: {parsedNotes.tableNumber}
          </div>
        )}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {(userRole === 'admin' || userRole === 'staff' || userRole === 'manager') && (order.status === 'new' || order.status === 'submitted' || order.status === 'preparing') && (
            <button
              onClick={(e) => onEdit(e, order)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-200 bg-white/5 hover:bg-white/10 hover:text-white rounded-md transition-colors border border-white/10"
            >
              <Edit3 size={14} /> Edit
            </button>
          )}
          {userRole === 'admin' && (
            <button
              onClick={(e) => onDelete(e, order)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </td>
    </motion.tr>
  )
}

export default function OrdersPage() {
  const router = useRouter()
  const { session, isLoading: sessionLoading } = useSession()
  const propertyId = session?.propertyId ?? ''

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/login')
  }, [sessionLoading, session, router])

  const { data: locationData } = useSWR<{ locations: Location[] }>(
    propertyId ? `/api/properties/${propertyId}/locations/` : null,
    apiFetch
  )
  const locations = locationData?.locations ?? []
  const locationId = locations[0]?.id ?? ''

  const { data: roomData } = useSWR<{ rooms: Room[] }>(
    propertyId ? `/api/properties/${propertyId}/rooms/` : null,
    apiFetch
  )
  const rooms = roomData?.rooms ?? []

  const { data: ordersData, mutate: mutateOrders, isLoading: isRefreshing } = useSWR<{ orders: Order[] }>(
    propertyId ? `/api/properties/${propertyId}/orders/` : null,
    apiFetch
  )

  const { lastEvent } = useRealtime(propertyId || '')

  useEffect(() => {
    if (lastEvent?.type === 'order_updated' || lastEvent?.type === 'new_notification') {
      mutateOrders()
    }
  }, [lastEvent, mutateOrders])
  const orders = ordersData?.orders ?? []

  const { data: menuData } = useSWR<{ menu: MenuItem[] }>(
    propertyId ? `/api/properties/${propertyId}/menu/` : null,
    apiFetch
  )
  const menuItems = menuData?.menu ?? []

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [cart, setCart] = useState<{ item: MenuItem, quantity: number, note: string }[]>([])
  const [orderType, setOrderType] = useState<'dine-in' | 'room-service'>('dine-in')
  const [locationIdentifier, setLocationIdentifier] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [menuSearch, setMenuSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('All')

  const categories = useMemo(() => {
    const cats = Array.from(new Set(menuItems.map(item => item.category)))
    return ['All', ...cats.sort()]
  }, [menuItems])

  const statusOptions = STATUS_OPTIONS.map(opt => ({ ...opt, count: orders.filter(o => o.status === opt.value).length }))

  const filterState = useFilterState<Order>({
    defaultPageSize: ORDERS_PER_PAGE,
    defaultSortBy: 'createdAt',
    defaultSortOrder: 'desc',
    searchFields: ['number', 'id', 'status', 'total', 'items.0.name', 'notes'],
    persistToUrl: true,
    urlKeyPrefix: 'orders_',
  })

  const { state, setSearchQuery, setFilters, setSort, setPage } = filterState

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

  const filteredOrders = useMemo(() => {
    return applyFilters(orders, {
      ...state,
      searchConfig: { fields: ['number', 'id', 'status', 'total', 'items.0.name', 'notes'] },
    })
  }, [orders, state])

  // Page size is fixed at ORDERS_PER_PAGE (5) so the table (and the page
  // underneath it) never grows tall enough to break the layout the way it
  // did with the old 10/25/50-per-page option.
  const paginatedOrders = useMemo(() => {
    const start = (state.page - 1) * ORDERS_PER_PAGE
    return filteredOrders.slice(start, start + ORDERS_PER_PAGE)
  }, [filteredOrders, state.page])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE))

  useEffect(() => {
    if (state.page > totalPages) {
      setPage(totalPages)
    }
  }, [state.page, totalPages, setPage])

  const handleEdit = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation()
    setEditingOrderId(order.id)
    setOrderType(order.notes?.includes('room-service') ? 'room-service' : 'dine-in')
    try {
      if (order.notes?.startsWith('{')) {
        const notesObj = JSON.parse(order.notes)
        setLocationIdentifier(notesObj.tableNumber || '')
        setOrderNotes(notesObj.generalNotes || '')
        if (notesObj.orderType) setOrderType(notesObj.orderType)
      } else {
        setOrderNotes(order.notes || '')
      }
    } catch {
      setOrderNotes(order.notes || '')
    }

    setCart(order.items.map(item => {
      const menuItem = menuItems.find(m => m.name === item.name)
      if (!menuItem) {
        return {
          item: { id: `legacy-${item.name}`, name: item.name, price: item.unitPrice, description: '', category: 'Other', available: true, prepStation: 'general' },
          quantity: item.quantity,
          note: ''
        }
      }
      return {
        item: menuItem,
        quantity: item.quantity,
        note: ''
      }
    }))
    setIsModalOpen(true)
  }

  const handleDelete = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation()
    if (!window.confirm(`Are you sure you want to delete order #${order.number}?`)) return
    
    try {
      await deleteOrder(order.id)
      toast.success('Order deleted successfully')
      mutateOrders()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete order')
    }
  }

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id)
      return existing
        ? prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
        : [...prev, { item, quantity: 1, note: '' }]
    })
    toast.success(`Added ${item.name} to cart`)
  }

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(c => {
        if (c.item.id === itemId) {
          const newQ = c.quantity + delta
          return newQ > 0 ? { ...c, quantity: newQ } : c
        }
        return c
      })
    })
  }

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(c => c.item.id !== itemId))
  }

  const submitOrderAction = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }
    if (!locationIdentifier.trim()) {
      toast.error(`Please enter a ${orderType === 'dine-in' ? 'Table' : 'Room'} Number`)
      return
    }
    if (!locationId) {
      toast.error('No active service location found. Please configure a location first.')
      return
    }
    setSubmitting(true)

    try {
      const items = cart.map(c => ({
        menuItemId: c.item.id,
        name: c.item.name,
        unitPrice: c.item.price,
        quantity: c.quantity,
        modifiers: [],
        note: c.note,
      }))

      const payloadNotes = JSON.stringify({
        orderType: orderType,
        tableNumber: locationIdentifier,
        waiterName: session?.username || 'Staff',
        generalNotes: orderNotes
      })

      if (editingOrderId) {
        await updateOrder(editingOrderId, items, payloadNotes)
        toast.success('Order successfully updated')
      } else {
        const idempotencyKey = crypto.randomUUID()
        await submitOrder(propertyId, locationId, idempotencyKey, items, payloadNotes)
        toast.success('Order successfully submitted to the kitchen')
      }

      setIsModalOpen(false)
      setEditingOrderId(null)
      setCart([])
      setOrderNotes('')
      setLocationIdentifier('')
      setOrderType('dine-in')
      mutateOrders()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit order')
    } finally {
      setSubmitting(false)
    }
  }

  const cartTotal = cart.reduce((total, c) => total + (parseFloat(c.item.price) * c.quantity), 0)

  const filteredMenu = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
                          item.category.toLowerCase().includes(menuSearch.toLowerCase())
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory
    return matchesSearch && matchesCategory
  })

  if (sessionLoading) return null
  if (!session) return null

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-500">
      <motion.section
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end mb-2"
      >
        <button
          onClick={() => { setEditingOrderId(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-zinc-950 font-bold rounded-xl transition-all focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950 shadow-[0_0_15px_rgba(249,115,22,0.3)] hover:shadow-[0_0_25px_rgba(249,115,22,0.5)]"
        >
          <Plus size={18} />
          <span>New Order</span>
        </button>
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-black/40 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl backdrop-blur-xl"
      >
        <div className="flex flex-col gap-4 p-6 border-b border-white/10 bg-white/5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <StatusFilterMenu
              options={statusOptions}
              selected={activeStatuses}
              onChange={setStatusFilter}
              totalCount={orders.length}
            />
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={state.searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search order #, table, items..."
                  className="w-56 pl-9 pr-3 py-2 bg-black/20 border border-white/10 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all shadow-inner"
                />
              </div>
              <SortMenu sortBy={state.sortBy} sortOrder={state.sortOrder} onChange={setSort} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white/5 text-zinc-400 uppercase tracking-wider text-xs font-semibold border-b border-white/10">
              <tr>
                <th className="px-6 py-4">Order ID</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Items</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Notes</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              <AnimatePresence mode="popLayout">
                {isRefreshing ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : paginatedOrders.length > 0 ? (
                  paginatedOrders.map((order) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      onClick={() => setSelectedOrder(order)}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      menuItems={menuItems}
                      userRole={session?.role ?? null}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12">
                      <EmptyState
                        icon={ShoppingBag}
                        title="No orders found"
                        description={state.searchQuery || activeStatuses.length > 0
                          ? 'Try different filters or search term.'
                          : 'No orders match the current view.'}
                      />
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/5">
          <div className="text-sm text-zinc-500">
            Showing {filteredOrders.length === 0 ? 0 : (state.page - 1) * ORDERS_PER_PAGE + 1} to {Math.min(state.page * ORDERS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} orders
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p: number) => Math.max(1, p - 1))}
              disabled={state.page === 1}
              className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-zinc-300 rounded text-sm transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-zinc-500 px-1">
              Page {state.page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
              disabled={state.page === totalPages}
              className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-zinc-300 rounded text-sm transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </motion.div>

      {isModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full lg:max-w-[1400px] h-[100dvh] lg:h-[90vh] bg-zinc-900/60 backdrop-blur-2xl lg:border border-white/10 lg:rounded-[2rem] shadow-2xl overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row"
          >
            {/* Left side: Menu Selection */}
            <div className="lg:flex-1 flex flex-col lg:min-h-0 min-w-0 relative z-10">
              <div className="p-6 border-b border-white/5 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-white flex items-center gap-3">
                    <ShoppingBag size={24} className="text-orange-500" />
                    Point of Sale
                  </h3>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="flex flex-col lg:flex-row gap-4 items-center">
                  <div className="relative w-full lg:w-72 flex-shrink-0 group">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                    <input
                      type="text"
                      placeholder="Search menu..."
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all shadow-inner"
                    />
                  </div>
                  <div className="flex-1 w-full overflow-x-auto hide-scrollbar [&::-webkit-scrollbar]:hidden relative">
                    <div className="flex items-center gap-2 pr-4">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setActiveCategory(cat)}
                          className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
                            activeCategory === cat 
                              ? 'bg-orange-500 text-zinc-950 shadow-[0_0_15px_rgba(249,115,22,0.4)]' 
                              : 'bg-black/40 text-zinc-400 hover:bg-white/10 hover:text-zinc-100 border border-white/5'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:flex-1 lg:overflow-y-auto p-4 lg:p-6 custom-scrollbar bg-black/20">
                {filteredMenu.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                    <ShoppingBag size={48} className="mb-4 opacity-20" />
                    <p className="text-lg font-bold text-zinc-400">No menu items found</p>
                    <p className="text-sm mt-1">Try adjusting your category or search.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filteredMenu.map(item => (
                      <div
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="group relative bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden hover:border-orange-500/40 cursor-pointer transition-all duration-300 hover:shadow-[0_10px_20px_rgba(0,0,0,0.5)] hover:-translate-y-1 flex flex-col"
                      >
                        <div className="relative h-32 w-full overflow-hidden bg-zinc-950">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-700">
                              <Utensils size={24} />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent"></div>
                          
                          <div className="absolute top-3 right-3 flex gap-1">
                            {item.dietaryPreference === 'veg' && (
                              <div className="bg-emerald-500/20 backdrop-blur-md rounded-md p-1.5 border border-emerald-500/30" title="Vegetarian">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                              </div>
                            )}
                            {item.dietaryPreference === 'non_veg' && (
                              <div className="bg-red-500/20 backdrop-blur-md rounded-md p-1.5 border border-red-500/30" title="Non-Vegetarian">
                                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="p-4 flex-1 flex flex-col justify-between -mt-8 relative z-10">
                          <div className="font-bold text-white text-base group-hover:text-orange-400 transition-colors line-clamp-2 mb-3 drop-shadow-md">{item.name}</div>
                          <div className="flex items-center justify-between mt-auto">
                            <span className="font-black text-lg text-orange-400">₹{item.price}</span>
                            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-zinc-950 transition-colors">
                              <Plus size={16} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Cart */}
            <div className="w-full lg:w-[420px] flex-shrink-0 flex flex-col bg-zinc-950 lg:border-l border-t lg:border-t-0 border-white/10 relative lg:min-h-0">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Current Order
                </h3>
                <span className="text-xs font-bold px-3 py-1 bg-orange-500/20 text-orange-400 rounded-md border border-orange-500/20">{cart.reduce((a, b) => a + b.quantity, 0)} Items</span>
              </div>

              <div className="lg:flex-1 lg:overflow-y-auto p-4 lg:p-5 custom-scrollbar">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                    <ShoppingBag size={56} className="mb-4 opacity-20" />
                    <p className="text-lg font-bold">Cart is empty</p>
                    <p className="text-sm mt-2 text-zinc-500 text-center px-8">Select items from the menu to add them here.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <AnimatePresence>
                      {cart.map(c => (
                        <motion.div 
                          key={c.item.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="flex gap-4 p-4 bg-zinc-900/80 border border-white/5 rounded-2xl hover:border-white/10 transition-colors"
                        >
                          <div className="flex flex-col items-center justify-between bg-black/60 rounded-xl p-1 border border-white/5 w-10">
                            <button onClick={() => updateQuantity(c.item.id, 1)} className="p-1.5 text-zinc-400 hover:text-white transition-colors"><Plus size={14} /></button>
                            <span className="text-sm font-bold text-white">{c.quantity}</span>
                            <button onClick={() => updateQuantity(c.item.id, -1)} className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors"><X size={14} /></button>
                          </div>
                          
                          <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-bold text-sm text-zinc-100 truncate">{c.item.name}</span>
                              <span className="font-black text-sm text-orange-400 whitespace-nowrap">₹{(parseFloat(c.item.price) * c.quantity).toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs font-medium text-zinc-500">₹{c.item.price} each</span>
                              <button
                                onClick={() => removeFromCart(c.item.id)}
                                className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 hover:text-red-400 transition-colors px-2 py-1 bg-white/5 rounded hover:bg-red-500/10"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-white/5 bg-zinc-900/50">
                <div className="space-y-4 mb-6">
                  <div className="flex p-1.5 bg-black/40 border border-white/5 rounded-xl">
                    <button
                      onClick={() => setOrderType('dine-in')}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${orderType === 'dine-in' ? 'bg-orange-500 text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-white'}`}
                    >
                      Dine-In (Table)
                    </button>
                    <button
                      onClick={() => setOrderType('room-service')}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${orderType === 'room-service' ? 'bg-orange-500 text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-white'}`}
                    >
                      Room Service
                    </button>
                  </div>

                  <div className="relative">
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    {orderType === 'dine-in' ? (
                      <select
                        value={locationIdentifier}
                        onChange={e => setLocationIdentifier(e.target.value)}
                        className="w-full p-4 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 font-bold appearance-none cursor-pointer"
                      >
                        <option value="" disabled className="text-zinc-500">Select Table *</option>
                        {locations.filter(l => l.kind === 'table').map(table => (
                          <option key={table.id} value={table.label}>{table.label}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={locationIdentifier}
                        onChange={e => setLocationIdentifier(e.target.value)}
                        className="w-full p-4 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 font-bold appearance-none cursor-pointer"
                      >
                        <option value="" disabled className="text-zinc-500">Select Room *</option>
                        {rooms.map(room => (
                          <option key={room.id} value={room.number}>Room {room.number} {room.guestName ? `(${room.guestName})` : ''}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={orderNotes}
                      onChange={e => setOrderNotes(e.target.value)}
                      placeholder="Order Notes (Optional)"
                      className="w-full p-4 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center mb-6">
                  <span className="text-zinc-400 text-sm font-medium">Total Amount</span>
                  <span className="text-3xl font-black text-orange-400">₹{cartTotal.toFixed(2)}</span>
                </div>
                
                <button
                  onClick={submitOrderAction}
                  disabled={submitting || cart.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-zinc-950 font-black text-base rounded-xl transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)] disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {submitting ? (
                    <><Loader2 size={20} className="animate-spin" /> Processing...</>
                  ) : (
                    <><CreditCard size={20} /> Fire to Kitchen</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  )
}