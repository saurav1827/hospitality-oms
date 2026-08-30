import React from 'react'
import { X, Clock3, CheckCircle2, ChevronRight, Utensils, IndianRupee } from 'lucide-react'
import type { Order } from '@/lib/api-client'

export function StatusBadge({ status }: { status: string }) {
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

function formatDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 0) return '0 min'
  const mins = Math.floor(ms / 60000)
  return `${mins} min${mins !== 1 ? 's' : ''}`
}

function formatDate(isoStr: string) {
  return new Date(isoStr).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  })
}

export function OrderDetailModal({ order, onClose }: { order: Order; onClose: () => void }) {
  let parsedNotes = { orderType: 'dine-in', tableNumber: 'TBD', waiterName: 'Guest/System', generalNotes: order.notes }
  try {
    if (order.notes && order.notes.startsWith('{')) {
      const p = JSON.parse(order.notes)
      parsedNotes = { ...parsedNotes, ...p }
      if (!parsedNotes.waiterName && p.orderType === 'dine-in') parsedNotes.waiterName = 'Staff'
    }
  } catch (e) { }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div>
            <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
              Order #{order.number}
              <StatusBadge status={order.status} />
            </h3>
            <p className="text-xs text-zinc-500 font-mono mt-1">{order.id}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          
          {/* Order Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Date &amp; Time</p>
              <p className="text-sm font-medium text-zinc-200">{formatDate(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Order Type</p>
              <p className="text-sm font-medium text-zinc-200 capitalize">{parsedNotes.orderType.replace('-', ' ')}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                {parsedNotes.orderType === 'dine-in' ? 'Table' : 'Room'}
              </p>
              <p className="text-sm font-medium text-zinc-200">{parsedNotes.tableNumber}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Created By</p>
              <p className="text-sm font-medium text-zinc-200">{parsedNotes.waiterName}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8 border border-white/10 rounded-xl overflow-hidden">
            <div className="bg-white/5 p-3 border-b border-white/10 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Order Items
            </div>
            <div className="divide-y divide-white/5">
              {order.items.map((item, idx) => (
                <div key={idx} className="p-3 flex justify-between items-center bg-black/20">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-zinc-300 w-6 text-right">{item.quantity}x</span>
                    <span className="text-sm font-medium text-zinc-200">{item.name}</span>
                  </div>
                  <div className="text-sm text-zinc-400">
                    ₹{(parseFloat(item.unitPrice || '0') * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline & Financials */}
          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            {/* Timeline */}
            <div className="bg-black/40 rounded-xl p-4 border border-white/10">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Timeline</p>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="mt-0.5"><Clock3 size={16} className="text-blue-400" /></div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Order Placed</p>
                    <p className="text-xs text-zinc-500">{formatDate(order.createdAt)}</p>
                  </div>
                </div>
                {order.deliveredAt && (
                  <div className="flex gap-3">
                    <div className="mt-0.5"><CheckCircle2 size={16} className="text-emerald-400" /></div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">Delivered</p>
                      <p className="text-xs text-zinc-500">{formatDate(order.deliveredAt)}</p>
                      <p className="text-xs text-amber-400 font-medium mt-1">
                        Turnaround: {formatDuration(order.createdAt, order.deliveredAt)}
                      </p>
                    </div>
                  </div>
                )}
                {!order.deliveredAt && (
                  <div className="flex gap-3 opacity-50">
                    <div className="mt-0.5"><Utensils size={16} className="text-zinc-500" /></div>
                    <div>
                      <p className="text-sm font-medium text-zinc-400">In Progress...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-black/40 rounded-xl p-4 border border-white/10 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Payment Summary</p>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm text-zinc-400">
                    <span>Subtotal</span>
                    <span>₹{order.subtotal}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-400">
                    <span>Tax (5%)</span>
                    <span>₹{order.taxTotal}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-zinc-100 pt-2 border-t border-zinc-800/50">
                    <span>Total</span>
                    <span className="text-emerald-400">₹{order.total}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-zinc-800/50">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Method</span>
                <span className={`text-sm font-bold capitalize ${order.paymentMethod ? 'text-purple-400' : 'text-zinc-500'}`}>
                  {order.paymentMethod || 'Unpaid'}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {parsedNotes.generalNotes && (
            <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Order Notes</p>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">{parsedNotes.generalNotes}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
