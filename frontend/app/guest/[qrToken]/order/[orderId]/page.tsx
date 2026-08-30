'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Script from 'next/script'
import { toast } from 'sonner'
import {
  Clock, ChefHat as ChefIcon, CheckCircle2, PartyPopper, User,
  ArrowLeft, Download, FileText, CreditCard, XCircle, Banknote
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export default function OrderTrackingPage() {
  const params = useParams()
  const router = useRouter()
  const qrToken = params.qrToken as string
  const orderId = params.orderId as string

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isPaying, setIsPaying] = useState(false)

  const [cashRequested, setCashRequested] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isRequested = localStorage.getItem(`cash_requested_${orderId}`)
      if (isRequested) setCashRequested(true)
    }
  }, [orderId])

  const handleCashPayment = () => {
    setCashRequested(true)
    localStorage.setItem(`cash_requested_${orderId}`, 'true')
    toast.success('Cash payment selected')
  }

  const handleCancelCashPayment = () => {
    setCashRequested(false)
    localStorage.removeItem(`cash_requested_${orderId}`)
  }

  useEffect(() => {
    fetchOrder()
    const interval = setInterval(fetchOrder, 5000)
    return () => clearInterval(interval)
  }, [qrToken, orderId])

  const fetchOrder = async () => {
    try {
      const res = await fetch(`${API_URL}/api/guest/${qrToken}/order/${orderId}/`)
      if (res.ok) {
        const data = await res.json()
        setOrder(data)
      } else if (res.status === 404) {
        toast.error('Order not found')
        router.push(`/guest/${qrToken}`)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handlePayNow = async () => {
    setIsPaying(true)
    try {
      const res = await fetch(`${API_URL}/api/guest/${qrToken}/order/${orderId}/pay/`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to initiate payment')
      const data = await res.json()
      const { payment } = data
      
      const options = {
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        name: "Order Payment",
        description: `Order #${order.number}`,
        order_id: payment.razorpayOrderId,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch(`${API_URL}/api/guest/${qrToken}/verify-payment/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: order.id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature
              })
            })
            if (verifyRes.ok) {
              setOrder((prev: any) => ({ ...prev, payment_status: 'paid' }))
              setCashRequested(false)
              localStorage.removeItem(`cash_requested_${orderId}`)
              toast.success('Payment successful!')
            }
          } catch (err: any) {
            toast.error('Payment verification failed.')
          }
        },
        theme: { color: "#F2A93B" }
      }
      const rzp = new (window as any).Razorpay(options)
      rzp.on('payment.failed', function () {
        toast.error('Payment failed')
      })
      rzp.open()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsPaying(false)
    }
  }

  const handleDownloadInvoice = () => {
    window.open(`${API_URL}/api/guest/${qrToken}/order/${orderId}/invoice/`, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0a08] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F2A93B]"></div>
      </div>
    )
  }

  if (!order) return null

  const isCancelled = order.status === 'cancelled'
  
  const statuses = [
    { id: 'submitted', label: 'Order Placed', icon: Clock, desc: 'We have received your order.' },
    { id: 'preparing', label: 'In Kitchen', icon: ChefIcon, desc: 'Chefs are preparing your meal.' },
    { id: 'ready', label: 'Ready for Delivery', icon: CheckCircle2, desc: 'Order is ready to be served.' },
    { id: 'served', label: 'Served', icon: PartyPopper, desc: 'Enjoy your meal!' }
  ]
  
  // If paid or delivered, map to served.
  const mappedStatus = (order.status === 'paid' || order.status === 'delivered') ? 'served' : order.status
  const currentIdx = statuses.findIndex(s => s.id === mappedStatus)
  const activeIdx = currentIdx >= 0 ? currentIdx : 0

  return (
    <div className="min-h-screen bg-[#0b0a08] flex flex-col relative font-body text-[#F5EFE6]">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      
      {/* Immersive background gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(242,169,59,0.15),_transparent_60%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02] pointer-events-none mix-blend-overlay" />
      
      <div className="w-full max-w-lg mx-auto px-6 pt-10 pb-32 relative z-10">
        <button onClick={() => router.push(`/guest/${qrToken}`)} className="flex items-center gap-2 text-[#A79C8D] hover:text-[#F5EFE6] transition-colors mb-8 text-sm font-semibold uppercase tracking-wider">
          <ArrowLeft size={16} /> Back to Menu
        </button>

        <div className="flex justify-between items-end mb-10">
          <div>
            <h1 className="font-display text-[42px] leading-none font-semibold text-[#F5EFE6] drop-shadow-md">Order #{order.number}</h1>
            <p className="text-[#A79C8D] mt-2 font-medium tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#F2A93B] animate-pulse"></span>
              {order.location_label}
            </p>
          </div>
          <div className="text-right bg-white/[0.03] p-3 rounded-2xl border border-white/5 shadow-inner">
            <p className="text-[11px] text-[#A79C8D] uppercase tracking-widest font-bold mb-1">Total Amount</p>
            <p className="font-display text-2xl font-bold text-[#F2A93B]">₹{parseFloat(order.total).toFixed(2)}</p>
          </div>
        </div>

        {/* Live Timeline */}
        {isCancelled ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-[2rem] p-8 text-center shadow-2xl mb-8 flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 mb-4 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
              <XCircle size={32} />
            </div>
            <h2 className="text-2xl font-display font-semibold text-red-500 mb-2">Order Cancelled</h2>
            <p className="text-red-400/80 text-sm">We're sorry, but your order has been cancelled. Please contact the staff for assistance.</p>
          </div>
        ) : (
          <div className="bg-[#12110e]/80 backdrop-blur-xl rounded-[2rem] border border-white/[0.04] p-8 shadow-2xl relative mb-8">
            <h2 className="text-xs font-bold text-[#A79C8D] uppercase tracking-widest mb-8 flex items-center gap-3">
              <div className="w-4 h-px bg-[#F2A93B]" /> Live Tracker
            </h2>
            
            <div className="space-y-0 relative z-10">
              {statuses.map((step, idx) => {
                const isPast = idx < activeIdx
                const isCurrent = idx === activeIdx
                const isFuture = idx > activeIdx
                const isLast = idx === statuses.length - 1
                const isSolid = isPast || (isCurrent && isLast)
                const Icon = step.icon
                
                return (
                  <div key={step.id} className="flex items-start gap-6 group relative">
                    {/* Connecting line using standard border */}
                    {!isLast && (
                      <div className={`absolute left-6 top-12 bottom-0 w-0.5 -ml-[1px] ${
                        isSolid ? 'bg-gradient-to-b from-[#F2A93B] to-[#E4572E]' : 'bg-white/[0.03]'
                      }`} />
                    )}
                    
                    <div className="relative mt-1 pb-10">
                      {isCurrent && !isLast && (
                        <div className="absolute inset-0 bg-[#F2A93B] rounded-full animate-ping opacity-20" />
                      )}
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all duration-700 relative z-10 ${
                        isSolid ? 'bg-gradient-to-br from-[#F2A93B] to-[#E4572E] text-[#0b0a08] shadow-[0_0_20px_rgba(242,169,59,0.4)]' :
                        isCurrent ? 'bg-[#12110e] border-[3px] border-[#F2A93B] text-[#F2A93B] shadow-[0_0_25px_rgba(242,169,59,0.5)]' :
                        'bg-white/[0.02] border border-white/5 text-[#4a453d]'
                      }`}>
                        <Icon size={20} strokeWidth={isSolid || isCurrent ? 2.5 : 2} className={isCurrent && !isLast ? 'animate-pulse' : ''} />
                      </div>
                    </div>

                    <div className={`flex-1 pt-1.5 transition-all duration-500 ${isFuture ? 'opacity-40' : 'opacity-100'}`}>
                      <h3 className={`font-semibold text-[18px] tracking-tight ${isSolid || isCurrent ? 'text-[#F5EFE6]' : 'text-[#6b6357]'}`}>
                        {step.label}
                      </h3>
                      <p className={`text-[13.5px] mt-1 ${isCurrent && !isLast ? 'text-[#F2A93B]' : 'text-[#8a8175]'}`}>
                        {isCurrent && !isLast ? 'Happening now...' : step.desc}
                      </p>

                      {/* Prepared by / Waiter Details Card */}
                      {isCurrent && (step.id === 'preparing' || step.id === 'ready' || step.id === 'served') && (
                        <div className="mt-4 grid gap-3 animate-in slide-in-from-top-2 fade-in duration-300">
                          {order.ready_by_name && (step.id === 'preparing' || step.id === 'ready') && (
                            <div className="bg-[#1a1814] p-3 rounded-2xl border border-white/5 flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F2A93B]/20 to-[#E4572E]/20 border border-[#F2A93B]/30 flex items-center justify-center text-[#F2A93B]">
                                <ChefIcon size={18} />
                              </div>
                              <div>
                                <p className="text-[11px] text-[#A79C8D] uppercase tracking-widest font-bold">Kitchen Staff</p>
                                <p className="text-sm font-semibold text-[#F5EFE6]">{order.ready_by_name}</p>
                              </div>
                            </div>
                          )}
                          
                          {order.runner_name && (step.id === 'ready' || step.id === 'served') && (
                            <div className="bg-[#1a1814] p-3 rounded-2xl border border-white/5 flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F2A93B]/20 to-[#E4572E]/20 border border-[#F2A93B]/30 flex items-center justify-center text-[#F2A93B]">
                                <User size={18} />
                              </div>
                              <div>
                                <p className="text-[11px] text-[#A79C8D] uppercase tracking-widest font-bold">Assigned Waiter</p>
                                <p className="text-sm font-semibold text-[#F5EFE6]">{order.runner_name}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Premium Receipt-style Bill */}
        <div className="receipt-container bg-[#12110e] border border-white/[0.04] p-8 pb-10 shadow-2xl mb-8 relative">
          <div className="text-center mb-8 border-b border-white/10 pb-6 border-dashed">
            <h2 className="text-xl font-display font-bold text-[#F5EFE6] tracking-wider uppercase mb-1">Receipt</h2>
            <p className="text-xs text-[#A79C8D] font-mono">{order.created_at ? new Date(order.created_at).toLocaleString() : ''}</p>
          </div>
          
          <div className="space-y-5 mb-8">
            {order.items.map((item: any, i: number) => (
              <div key={i} className="flex justify-between items-start group">
                <div className="flex gap-4 items-start">
                  <div className="text-[14px] font-mono text-[#F2A93B] font-bold mt-0.5 min-w-[24px]">
                    {item.quantity}x
                  </div>
                  <p className="text-[#e3dcd1] text-[15px] font-medium leading-relaxed group-hover:text-white transition-colors">{item.name}</p>
                </div>
                <p className="text-[#A79C8D] text-[15px] font-mono shrink-0 ml-4 pt-0.5">
                  ₹{(parseFloat(item.unitPrice) * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-5 space-y-3 border-dashed">
            <div className="flex justify-between text-[14px] text-[#A79C8D] font-medium">
              <span>Subtotal</span>
              <span className="font-mono">₹{parseFloat(order.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[14px] text-[#A79C8D] font-medium">
              <span>Tax (5%)</span>
              <span className="font-mono">₹{parseFloat(order.tax_total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[18px] font-bold text-[#F5EFE6] pt-4 mt-2 border-t border-white/5">
              <span>Grand Total</span>
              <span className="font-mono text-[#F2A93B]">₹{parseFloat(order.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment & Invoice Action */}
        {order.payment_status === 'pending' ? (
          cashRequested ? (
            <div className="bg-[#1a1814] border border-[#F2A93B]/30 rounded-[1.5rem] p-6 flex flex-col items-center justify-center gap-3 text-center animate-in zoom-in-95 duration-300 shadow-[0_0_30px_rgba(242,169,59,0.1)]">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#F2A93B]/20 to-[#E4572E]/20 flex items-center justify-center text-[#F2A93B] mb-2">
                <Banknote size={28} />
              </div>
              <p className="text-[#F5EFE6] font-display font-semibold text-xl">Cash Payment Selected</p>
              <p className="text-[#A79C8D] text-sm">Please pay at the counter or give cash to your waiter when they arrive.</p>
              <button 
                onClick={handleCancelCashPayment}
                className="mt-4 text-[13px] font-bold text-[#F2A93B] uppercase tracking-wider hover:text-white transition-colors"
              >
                Change Payment Method
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={handlePayNow}
                disabled={isPaying || isCancelled}
                className="w-full btn-shimmer group bg-gradient-to-r from-[#F2A93B] to-[#E4572E] text-black py-4 rounded-[1.5rem] font-extrabold text-[17px] flex items-center justify-center gap-3 transition-all shadow-[0_8px_30px_rgba(228,87,46,0.25)] hover:shadow-[0_12px_40px_rgba(228,87,46,0.4)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              >
                {isPaying ? 'Processing Secure Payment...' : (
                  <>Pay Bill Online <CreditCard size={20} className="group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
              
              <button
                onClick={handleCashPayment}
                disabled={isCancelled}
                className="w-full group bg-[#1a1814] border border-white/[0.08] hover:border-white/20 text-[#F5EFE6] py-4 rounded-[1.5rem] font-bold text-[16px] flex items-center justify-center gap-3 transition-all hover:bg-white/[0.03] active:scale-[0.99] shadow-lg disabled:opacity-50 disabled:pointer-events-none"
              >
                <Banknote size={20} className="text-[#A79C8D] group-hover:text-[#F2A93B] transition-colors" /> Pay by Cash
              </button>
            </div>
          )
        ) : (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[1.5rem] p-5 flex items-center justify-center gap-4 backdrop-blur-sm shadow-inner">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 size={24} />
              </div>
              <div className="text-left">
                <p className="text-emerald-400 font-bold text-[17px]">Payment Completed</p>
                <p className="text-emerald-500/70 text-[13px] font-medium">Thank you for dining with us</p>
              </div>
            </div>
            <button
              onClick={handleDownloadInvoice}
              className="w-full group bg-[#1a1814] border border-white/[0.08] hover:border-white/20 text-[#F5EFE6] py-4 rounded-[1.5rem] font-bold text-[16px] flex items-center justify-center gap-3 transition-all hover:bg-white/[0.03] active:scale-[0.99] shadow-lg"
            >
              <Download size={18} className="text-[#A79C8D] group-hover:text-[#F5EFE6] transition-colors" /> Download PDF Invoice
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .font-display { font-family: 'Fraunces', ui-serif, Georgia, serif; }
        .font-body { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        
        .receipt-container {
          position: relative;
          border-radius: 12px;
        }
        
        /* Zig-zag top and bottom effect for receipt */
        .receipt-container::before, .receipt-container::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          height: 12px;
          background-size: 24px 100%;
        }
        .receipt-container::before {
          top: -12px;
          background-image: radial-gradient(circle at 12px 0, transparent 12px, #12110e 13px);
        }
        .receipt-container::after {
          bottom: -12px;
          background-image: radial-gradient(circle at 12px 12px, transparent 12px, #12110e 13px);
        }

        .btn-shimmer {
          position: relative;
          overflow: hidden;
        }
        .btn-shimmer::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            to bottom right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.1) 40%,
            rgba(255, 255, 255, 0.4) 50%,
            rgba(255, 255, 255, 0.1) 60%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: rotate(30deg);
          animation: shimmer 4s infinite linear;
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%) rotate(30deg); }
          100% { transform: translateX(100%) rotate(30deg); }
        }
      `}</style>
    </div>
  )
}
