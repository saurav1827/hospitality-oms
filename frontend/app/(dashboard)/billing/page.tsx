'use client'

import { useEffect, useState, useMemo } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { toast } from 'sonner'
import { useSession } from '@/lib/use-session'
import { useRealtime } from '@/lib/use-realtime'
import { apiFetch, type RevenueSummary, type Order, processPayment } from '@/lib/api-client'
import { ReceiptText, RefreshCw, IndianRupee, CreditCard, Wallet, QrCode, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { useFilterState } from '@/lib/use-filter-state'

export default function BillingPage() {
  const router = useRouter()
  const { session, isLoading: sessionLoading } = useSession()
  const propertyId = session?.propertyId ?? ''

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/login')
  }, [sessionLoading, session, router])

  const { data: revenueData, mutate: mutateStats, isValidating: isRefreshingStats } = useSWR<{ revenueSummary: RevenueSummary }>(
    propertyId ? `/api/properties/${propertyId}/revenue-summary/` : null,
    apiFetch
  )
  const stats = revenueData?.revenueSummary

  const { data: ordersData, mutate: mutateOrders, isValidating: isRefreshingOrders } = useSWR<{ orders: Order[] }>(
    propertyId ? `/api/properties/${propertyId}/orders/` : null,
    apiFetch
  )

  const { lastEvent } = useRealtime(propertyId || '')

  useEffect(() => {
    if (lastEvent?.type === 'order_updated' || lastEvent?.type === 'new_notification') {
      mutateOrders()
      mutateStats()
    }
  }, [lastEvent, mutateOrders, mutateStats])
  // Show only delivered/served orders that haven't been paid/cancelled
  const openOrders = (ordersData?.orders || []).filter(o => o.status === 'delivered' || o.status === 'served')

  const filterState = useFilterState<Order>({
    defaultPageSize: 5,
    defaultSortBy: 'createdAt',
    defaultSortOrder: 'desc',
    searchFields: [],
    persistToUrl: false,
    urlKeyPrefix: 'billing_',
  })

  const { state } = filterState

  const paginatedOrders = useMemo(() => {
    const start = (state.page - 1) * state.pageSize
    return openOrders.slice(start, start + state.pageSize)
  }, [openOrders, state.page, state.pageSize])

  const totalPages = Math.max(1, Math.ceil(openOrders.length / state.pageSize))

  const [settlingOrder, setSettlingOrder] = useState<Order | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<string>('card')
  const [processing, setProcessing] = useState(false)

  const handleSettle = async () => {
    if (!settlingOrder) return
    setProcessing(true)
    
    try {
      const idempotencyKey = crypto.randomUUID()
      const result = await processPayment(settlingOrder.id, settlingOrder.total, paymentMethod, idempotencyKey)
      
      if (paymentMethod === 'razorpay' && result.payment?.razorpayOrderId) {
        const { payment } = result
        const options = {
          key: payment.keyId,
          amount: payment.amount,
          currency: payment.currency,
          name: "Hospitality System",
          description: `Settle Order #${settlingOrder.number}`,
          order_id: payment.razorpayOrderId,
          handler: async function (response: any) {
            try {
              await apiFetch(`/api/orders/${settlingOrder.id}/verify-payment/`, {
                method: 'POST',
                body: JSON.stringify({
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpaySignature: response.razorpay_signature,
                  idempotencyKey
                })
              })
              toast.success(`Payment of ₹${settlingOrder.total} processed via Razorpay!`)
              setSettlingOrder(null)
              mutateOrders()
              mutateStats()
            } catch (err: any) {
              toast.error(err.message || 'Verification failed')
            } finally {
              setProcessing(false)
            }
          },
          theme: { color: "#9333ea" },
          modal: {
            ondismiss: function() {
              setProcessing(false)
            }
          }
        }
        const rzp = new (window as any).Razorpay(options)
        rzp.on('payment.failed', function (response: any) {
          toast.error(response.error.description || 'Payment failed')
          setProcessing(false)
        })
        rzp.open()
      } else {
        toast.success(`Payment of ₹${settlingOrder.total} processed successfully!`)
        setSettlingOrder(null)
        mutateOrders()
        mutateStats()
        setProcessing(false)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Payment processing failed')
      setProcessing(false)
    }
  }

  const isRefreshing = isRefreshingStats || isRefreshingOrders

  const handleRefresh = () => {
    mutateStats()
    mutateOrders()
  }

  if (sessionLoading) return null
  if (!session) return null

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-500">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      {/* Page Header */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-semibold tracking-wider text-orange-400 uppercase flex items-center gap-2">
            <IndianRupee size={14} /> Financial Operations
          </span>
          <h2 className="text-3xl font-bold tracking-tight mt-1 text-zinc-50">Billing & Revenue</h2>
        </div>
        <button 
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors shadow-sm hover:bg-white/10 backdrop-blur-md"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-orange-400' : ''} />
          Sync Data
        </button>
      </section>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 relative overflow-hidden group backdrop-blur-xl shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-orange-400">
            <IndianRupee size={80} />
          </div>
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">Gross Revenue</h3>
          <div className="text-4xl font-bold text-zinc-50">₹{stats ? stats.grossRevenue : '-'}</div>
          <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1"><CheckCircle2 size={12} /> Today's collections</p>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 relative overflow-hidden group backdrop-blur-xl shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-orange-400">
            <ReceiptText size={80} />
          </div>
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">Paid Orders</h3>
          <div className="text-4xl font-bold text-zinc-50">{stats ? stats.paidCount : '-'}</div>
          <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1"><CheckCircle2 size={12} /> Settled checks</p>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 relative overflow-hidden group backdrop-blur-xl shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-orange-400">
            <AlertCircle size={80} />
          </div>
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">Open Tabs</h3>
          <div className="text-4xl font-bold text-zinc-50">{stats ? stats.openOrders : '-'}</div>
          <p className="text-xs text-amber-400 mt-2 flex items-center gap-1"><AlertCircle size={12} /> Pending payment</p>
        </div>
      </div>

      {/* Open Checks Table */}
      <div className="bg-black/40 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl mt-4 backdrop-blur-xl">
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">Open Checks</h3>
            <p className="text-sm text-zinc-400">Process payments for active tables and orders.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white/5 text-zinc-400 uppercase tracking-wider text-xs font-semibold border-b border-white/10">
              <tr>
                <th className="px-6 py-4">Order Ref</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Items</th>
                <th className="px-6 py-4 text-right">Amount Due</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {openOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-zinc-500">
                    <ReceiptText size={40} className="mx-auto mb-4 opacity-20 text-purple-500" />
                    <p className="text-base font-medium">No open checks.</p>
                    <p className="text-xs mt-1">All active orders have been paid.</p>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-zinc-200">#{order.number}</div>
                      <div className="text-xs text-zinc-500 mt-0.5 font-mono">{order.id.substring(0,8)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset bg-amber-500/10 text-amber-400 ring-amber-500/20 capitalize">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-zinc-300">
                        {order.items.length} items
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-lg text-orange-400">₹{order.total}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">Includes Tax</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => setSettlingOrder(order)}
                        className="inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-zinc-950 font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:shadow-[0_0_25px_rgba(249,115,22,0.4)] focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
                      >
                        Settle Bill
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-zinc-800/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-zinc-500">
            Showing {openOrders.length === 0 ? 0 : (state.page - 1) * state.pageSize + 1} to {Math.min(state.page * state.pageSize, openOrders.length)} of {openOrders.length} checks
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
      </div>

      {/* Payment Modal Overlay */}
      {settlingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !processing && setSettlingOrder(null)} />
          
          <div className="relative w-full max-w-md bg-black/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
            
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                Checkout Order #{settlingOrder.number}
              </h3>
              <button 
                onClick={() => !processing && setSettlingOrder(null)}
                disabled={processing}
                className="p-1.5 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 border border-white/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <div className="mb-6 bg-white/5 rounded-xl border border-white/10 p-4">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Order Summary</p>
                <div className="max-h-[150px] overflow-y-auto pr-2 space-y-2 mb-3 custom-scrollbar">
                  {settlingOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start text-sm">
                      <div className="flex gap-2">
                        <span className="text-zinc-500">{item.quantity}x</span>
                        <span className="text-zinc-300">{item.name}</span>
                      </div>
                      <span className="text-zinc-400 font-medium">₹{(Number(item.unitPrice) * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between items-center text-sm mb-1">
                  <span className="text-zinc-400">Subtotal</span>
                  <span className="text-zinc-300">₹{settlingOrder.subtotal}</span>
                </div>
                <div className="flex justify-between items-center text-sm mb-3">
                  <span className="text-zinc-400">Taxes</span>
                  <span className="text-zinc-300">₹{settlingOrder.taxTotal}</span>
                </div>
                <div className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5">
                  <span className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Total Due</span>
                  <span className="text-2xl font-bold text-orange-400">₹{settlingOrder.total}</span>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <p className="text-sm font-medium text-zinc-300">Select Payment Method</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setPaymentMethod('card')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'card' 
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400' 
                        : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <CreditCard size={24} className="mb-2" />
                    <span className="text-sm font-semibold">Card</span>
                  </button>

                  <button 
                    onClick={() => setPaymentMethod('upi')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'upi' 
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400' 
                        : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <QrCode size={24} className="mb-2" />
                    <span className="text-sm font-semibold">UPI</span>
                  </button>

                  <button 
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'cash' 
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400' 
                        : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <Wallet size={24} className="mb-2" />
                    <span className="text-sm font-semibold">Cash</span>
                  </button>

                  <button 
                    onClick={() => setPaymentMethod('razorpay')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'razorpay' 
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400' 
                        : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <ReceiptText size={24} className="mb-2" />
                    <span className="text-sm font-semibold">Razorpay</span>
                  </button>
                </div>
              </div>

              {/* Show Dynamic QR Code when UPI is selected */}
              {paymentMethod === 'upi' && (
                <div className="flex flex-col items-center justify-center p-6 bg-white rounded-[2rem] shadow-2xl mb-6 border-4 border-white/10 animate-in fade-in zoom-in duration-300">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Scan to Pay ₹{settlingOrder.total}</p>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=upi://pay?pa=restaurant@upi&am=${settlingOrder.total}`} alt="QR Code" className="w-40 h-40 rounded-lg" />
                  <p className="text-xs font-medium text-emerald-500 mt-2">Waiting for payment...</p>
                </div>
              )}

              <button 
                onClick={handleSettle}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-zinc-950 font-bold rounded-xl transition-all disabled:opacity-50 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-900 shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:shadow-[0_0_25px_rgba(249,115,22,0.4)]"
              >
                {processing ? (
                  <><Loader2 size={18} className="animate-spin" /> Processing...</>
                ) : (
                  <><CheckCircle2 size={18} /> {paymentMethod === 'razorpay' ? 'Initiate Razorpay Checkout' : paymentMethod === 'upi' ? 'Confirm Scan Received' : 'Confirm Payment'}</>
                )}
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  )
}