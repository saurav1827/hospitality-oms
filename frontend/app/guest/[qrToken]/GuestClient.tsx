'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { toast } from 'sonner'
import {
  Loader2, Plus, Minus, ShoppingBag, Send, Utensils, X, Check,
  Flame, ChefHat, IceCream, Coffee, Wheat, Salad, Fish, Sparkles, LayoutGrid,
  MapPin, Star, User, PenLine, UtensilsCrossed, Search, Filter, CreditCard, Banknote,
  Clock, ChefHat as ChefIcon, CheckCircle2, PartyPopper
} from 'lucide-react'

// Fetch wrapper for public routes - needed for submit and verify
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface GuestClientProps {
  qrToken: string
  initialData: any
}

// Picks a fitting icon for a category name so the nav and image placeholders
// read like a menu, not a generic settings panel.
function getCategoryIcon(category: string) {
  const c = (category || '').toLowerCase()
  if (c === 'all') return LayoutGrid
  if (c.includes('biryani') || c.includes('rice')) return ChefHat
  if (c.includes('chaat') || c.includes('snack')) return Sparkles
  if (c.includes('chinese')) return UtensilsCrossed
  if (c.includes('starter') || c.includes('appetiser') || c.includes('appetizer')) return Flame
  if (c.includes('bread') || c.includes('naan') || c.includes('roti')) return Wheat
  if (c.includes('salad')) return Salad
  if (c.includes('seafood') || c.includes('fish') || c.includes('prawn')) return Fish
  if (c.includes('dessert') || c.includes('sweet')) return IceCream
  if (c.includes('beverage') || c.includes('drink') || c.includes('bar') || c.includes('juice')) return Coffee
  return Utensils
}

// Formats a price with Indian thousands separators; falls back to the raw
// value if it isn't numeric so we never crash on odd data.
function formatPrice(value: any) {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value)
  if (!Number.isFinite(num)) return value
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export default function GuestClient({ qrToken, initialData }: GuestClientProps) {
  const { property, location, menu } = initialData

  const router = useRouter()
  const [cart, setCart] = useState<{ item: any; quantity: number; note: string }[]>([])
  const [guestName, setGuestName] = useState('')
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [dietaryFilter, setDietaryFilter] = useState<string>('All') // 'All', 'veg', 'non-veg'
  const [paymentMethod, setPaymentMethod] = useState<'pay_now' | 'pay_later'>('pay_now')
  
  // Indicator tracking for wrapped tabs isn't practical, removing refs
  
  // Group menu by category
  const categories = ['All', ...Array.from(new Set(menu.map((item: any) => item.category || 'Other')))] as string[]

  const filteredMenu = menu.filter((item: any) => {
    const matchesCategory = activeCategory === 'All' || (item.category || 'Other') === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDietary = dietaryFilter === 'All' || (item.dietaryPreference && item.dietaryPreference.toLowerCase() === dietaryFilter);
    return matchesCategory && matchesSearch && matchesDietary;
  });



  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id)
      if (existing) {
        return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      }
      return [...prev, { item, quantity: 1, note: '' }]
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
      }).filter(c => c.quantity > 0)
    })
  }

  const getCartQuantity = (itemId: string) => cart.find(c => c.item.id === itemId)?.quantity || 0

  const cartTotal = cart.reduce((sum, c) => sum + (parseFloat(c.item.price) * c.quantity), 0)
  const cartItemsCount = cart.reduce((s, c) => s + c.quantity, 0)

  const submitOrder = async () => {
    if (cart.length === 0) return
    if (!guestName.trim()) {
      toast.error('Please enter your name')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        idempotencyKey: crypto.randomUUID(),
        items: cart.map(c => ({
          menuItemId: c.item.id,
          name: c.item.name,
          unitPrice: c.item.price,
          quantity: c.quantity,
          note: c.note || ''
        })),
        notes: JSON.stringify({
          orderType: location.kind === 'room' ? 'room-service' : 'dine-in',
          tableNumber: location.label,
          waiterName: `Guest: ${guestName}`,
          generalNotes: specialInstructions
        }),
        paymentMethod: paymentMethod
      }

      const res = await fetch(`${API_URL}/api/guest/${qrToken}/submit/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to submit order')
      }

      const result = await res.json()
      const { order, payment } = result.submitOrder

      if (payment) {
        const options = {
          key: payment.keyId,
          amount: payment.amount,
          currency: payment.currency,
          name: property.name,
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
              if (!verifyRes.ok) {
                const errData = await verifyRes.json().catch(() => ({}))
                throw new Error(errData.error || 'Payment verification failed')
              }
              setCart([])
              setIsCartOpen(false)
              router.push(`/guest/${qrToken}/order/${order.id}`)
            } catch (err: any) {
              toast.error(err.message || 'Payment verification failed. Please contact staff.')
            }
          },
          prefill: { name: guestName },
          theme: { color: "#F2A93B" } // Matches the redesigned marigold/paprika theme
        }

        const rzp = new (window as any).Razorpay(options)
        rzp.on('payment.failed', function (response: any) {
          toast.error(response.error.description || 'Payment failed')
        })
        rzp.open()
      } else {
        setCart([])
        setIsCartOpen(false)
        router.push(`/guest/${qrToken}/order/${order.id}`)
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to place order')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0a08] pb-32 font-body text-[#F5EFE6] selection:bg-[#F2A93B]/30 relative">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {/* Ambient background glow */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-24 w-[420px] h-[420px] rounded-full bg-[#F2A93B]/[0.07] blur-[120px] motion-safe:animate-[driftA_18s_ease-in-out_infinite] motion-reduce:animate-none" />
        <div className="absolute top-1/3 -right-32 w-[380px] h-[380px] rounded-full bg-[#E4572E]/[0.06] blur-[120px] motion-safe:animate-[driftB_22s_ease-in-out_infinite] motion-reduce:animate-none" />
      </div>

      {/* Dynamic Header */}
      <div className="sticky top-0 z-30 bg-[#0b0a08]/70 backdrop-blur-2xl border-b border-white/[0.06] pt-safe pb-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between pt-5">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#F2A93B] font-bold mb-1">Digital Menu</p>
              <h1 className="font-display text-[26px] leading-none font-semibold text-[#F5EFE6] truncate">{property.name}</h1>
              <div className="flex items-center gap-2 mt-2.5">
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[#F2A93B] text-[11px] font-bold uppercase tracking-wider">
                  <MapPin size={11} /> {location.kind}
                </span>
                <span className="text-sm text-[#A79C8D] font-medium truncate">{location.label}</span>
              </div>
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
              aria-label="Open cart"
              className="relative shrink-0 p-3.5 bg-gradient-to-br from-[#F2A93B] to-[#E4572E] text-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_8px_24px_rgba(228,87,46,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a08]"
            >
              <ShoppingBag size={22} strokeWidth={2.3} />
              {cartItemsCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#F5EFE6] text-black text-[11px] font-black w-6 h-6 flex items-center justify-center rounded-full shadow-lg border-2 border-[#0b0a08] animate-in zoom-in duration-300">
                  {cartItemsCount}
                </span>
              )}
            </button>
          </div>

          {/* Search and Filter */}
          <div className="mt-6 flex gap-3 px-1">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search size={16} className="text-[#A79C8D]" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dishes..."
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[14px] text-[#F5EFE6] placeholder:text-[#6b6357] focus:outline-none focus:border-[#F2A93B]/50 transition-colors"
              />
            </div>
            <button
              onClick={() => setDietaryFilter(prev => prev === 'All' ? 'veg' : prev === 'veg' ? 'non-veg' : 'All')}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-[13px] font-bold uppercase tracking-wider transition-all ${
                dietaryFilter === 'veg' 
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                  : dietaryFilter === 'non-veg'
                  ? 'bg-[#B23A2E]/10 border-[#B23A2E]/50 text-[#B23A2E]'
                  : 'bg-white/[0.04] border-white/10 text-[#A79C8D] hover:bg-white/[0.08]'
              }`}
            >
              <Filter size={14} />
              {dietaryFilter === 'All' ? 'Any' : dietaryFilter}
            </button>
          </div>

          {/* Category Navigation */}
          {categories.length > 1 && (
            <div className="relative mt-4">
              <div className="flex flex-wrap gap-2 pb-3">
                {categories.map((cat) => {
                  const Icon = getCategoryIcon(cat)
                  const isActive = activeCategory === cat
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A93B] ${isActive
                          ? 'text-black bg-[#F2A93B] shadow-[0_4px_15px_rgba(242,169,59,0.3)] scale-105'
                          : 'text-[#A79C8D] bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:text-[#F5EFE6]'
                        }`}
                    >
                      <Icon size={14} strokeWidth={2.4} />
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu List */}
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4 mt-4">
        {filteredMenu.length === 0 ? (
          <div className="text-center py-24 animate-in fade-in duration-500">
            <div className="w-20 h-20 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto mb-6">
              <Utensils size={30} className="text-[#6b6357]" />
            </div>
            <p className="text-[#F5EFE6] font-semibold text-lg">No dishes in this category yet</p>
            <p className="text-[#A79C8D] text-sm mt-1.5">Browse another category from the menu above.</p>
          </div>
        ) : (
          filteredMenu.map((item: any, i: number) => {
            const Icon = getCategoryIcon(item.category || 'Other')
            const qty = getCartQuantity(item.id)
            return (
              <div
                key={item.id}
                onClick={() => addToCart(item)}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addToCart(item) } }}
                className="group relative flex gap-4 p-4 bg-[#15130f]/70 backdrop-blur-xl border border-white/[0.06] rounded-[2rem] hover:border-[#F2A93B]/40 hover:bg-[#18150f] cursor-pointer transition-all duration-300 animate-in slide-in-from-bottom-8 fade-in shadow-2xl shadow-black/40 hover:shadow-[0_14px_44px_rgba(242,169,59,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A93B]"
                style={{ animationDelay: `${i * 45}ms`, animationFillMode: 'both' }}
              >
                <div className="relative w-32 h-32 shrink-0">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full rounded-3xl object-cover bg-black/40 shadow-inner" />
                  ) : (
                    <div className="w-full h-full rounded-3xl bg-gradient-to-br from-[#241d13] to-[#0f0d09] border border-white/[0.05] flex items-center justify-center">
                      <Icon size={30} className="text-[#F2A93B]/30" strokeWidth={1.5} />
                    </div>
                  )}
                  {item.isBestseller && (
                    <span className="absolute -top-2 -left-2 flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold bg-[#F2A93B] text-black px-2 py-1 rounded-full shadow-[0_4px_14px_rgba(242,169,59,0.5)]">
                      <Star size={10} className="fill-black" /> Popular
                    </span>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-center py-1 min-w-0">
                  <div className="flex items-start gap-2">
                    {item.dietaryPreference && (
                      <span className={`mt-1.5 shrink-0 w-3.5 h-3.5 border-2 rounded-[3px] flex items-center justify-center ${item.dietaryPreference.toLowerCase() === 'veg' ? 'border-emerald-500' : 'border-[#B23A2E]'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.dietaryPreference.toLowerCase() === 'veg' ? 'bg-emerald-500' : 'bg-[#B23A2E]'}`} />
                      </span>
                    )}
                    <h3 className="font-bold text-[#F5EFE6] text-[17px] leading-tight truncate group-hover:text-[#F2A93B] transition-colors">{item.name}</h3>
                  </div>

                  <p className="text-sm text-[#8f8577] line-clamp-2 mt-1.5 leading-relaxed">{item.description}</p>

                  {item.spiceLevel ? (
                    <div className="flex items-center gap-0.5 mt-2">
                      {Array.from({ length: Math.min(Number(item.spiceLevel), 3) }).map((_, idx) => (
                        <Flame key={idx} size={12} className="text-[#E4572E] fill-[#E4572E]/40" />
                      ))}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between mt-auto pt-3">
                    <span className="font-display font-semibold text-lg text-[#F5EFE6]">₹{formatPrice(item.price)}</span>

                    {qty > 0 ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2.5 bg-black/50 border border-[#F2A93B]/30 rounded-full px-1 py-1"
                      >
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          aria-label={`Remove one ${item.name}`}
                          className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[#F5EFE6] hover:bg-white/10 active:scale-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A93B]"
                        >
                          <Minus size={13} className="stroke-[3]" />
                        </button>
                        <span className="font-bold text-sm w-4 text-center tabular-nums">{qty}</span>
                        <button
                          onClick={() => addToCart(item)}
                          aria-label={`Add one more ${item.name}`}
                          className="w-7 h-7 rounded-full bg-[#F2A93B] flex items-center justify-center text-black hover:bg-[#f5b654] active:scale-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A93B] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                        >
                          <Plus size={13} className="stroke-[3]" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.06] border border-white/10 text-[#F5EFE6] text-xs font-bold group-hover:bg-[#F2A93B] group-hover:text-black group-hover:border-[#F2A93B] transition-all transform group-hover:scale-105">
                        <Plus size={14} className="stroke-[3]" /> ADD
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Floating Action Cart Button */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-6 left-0 right-0 px-4 z-40 flex justify-center animate-in slide-in-from-bottom-8 fade-in duration-300">
          <button
            onClick={() => setIsCartOpen(true)}
            className="btn-shimmer w-full max-w-md bg-gradient-to-r from-[#F2A93B] to-[#E4572E] text-black px-6 py-4 rounded-[1.75rem] font-extrabold shadow-[0_16px_44px_rgba(228,87,46,0.35)] flex items-center justify-between transition-all hover:-translate-y-1 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a08]"
          >
            <span className="flex items-center gap-3">
              <span className="bg-black/15 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black">
                {cartItemsCount}
              </span>
              <span className="text-left leading-tight">
                <span className="block text-[11px] uppercase tracking-wider opacity-70 font-bold">₹{formatPrice(cartTotal)}</span>
                <span className="block text-base">View order</span>
              </span>
            </span>
            <span className="flex items-center gap-2 text-lg">
              <ShoppingBag size={20} className="stroke-[2.5]" />
            </span>
          </button>
        </div>
      )}

      {/* Modern Cart Bottom Sheet / Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Your order">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsCartOpen(false)}
          />

          <div className="w-full max-w-md bg-[#100f0c] sm:rounded-[2.5rem] rounded-t-[2rem] h-[92vh] sm:h-auto sm:max-h-[88vh] flex flex-col shadow-[0_-20px_70px_rgba(0,0,0,0.7)] relative animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-[400ms] ease-out border border-white/10 overflow-hidden">

            {/* Sheet Handle (Mobile) */}
            <div className="w-full flex justify-center pt-3.5 pb-1 sm:hidden absolute top-0 z-20 bg-gradient-to-b from-[#100f0c] to-transparent">
              <div className="w-10 h-1.5 bg-white/20 rounded-full" />
            </div>

            <div className="px-6 pt-9 pb-5 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#100f0c]/90 backdrop-blur-xl z-10">
              <h2 className="font-display text-2xl font-semibold flex items-center gap-3 text-[#F5EFE6]">
                <span className="w-10 h-10 rounded-2xl bg-[#F2A93B]/15 flex items-center justify-center text-[#F2A93B]">
                  <ShoppingBag size={20} />
                </span>
                Your Order
              </h2>
              <button
                onClick={() => setIsCartOpen(false)}
                aria-label="Close cart"
                className="p-2.5 text-[#A79C8D] hover:text-[#F5EFE6] bg-white/5 hover:bg-white/10 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A93B]"
              >
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 hide-scroll space-y-8">
              {cart.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShoppingBag size={38} className="opacity-40 text-[#A79C8D]" />
                  </div>
                  <p className="text-lg font-semibold text-[#F5EFE6]">Your cart is empty</p>
                  <p className="text-sm text-[#A79C8D] mt-1.5">Add a few things you're craving.</p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="mt-6 text-[#F2A93B] font-bold px-6 py-3 bg-[#F2A93B]/10 rounded-full hover:bg-[#F2A93B]/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A93B]"
                  >
                    Browse Menu
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3.5">
                    {cart.map(c => {
                      const CartIcon = getCategoryIcon(c.item.category || 'Other')
                      return (
                        <div key={c.item.id} className="flex gap-3.5 p-3.5 bg-white/[0.025] border border-white/[0.06] rounded-3xl">
                          {c.item.imageUrl ? (
                            <img src={c.item.imageUrl} alt={c.item.name} className="w-16 h-16 rounded-2xl object-cover shrink-0" />
                          ) : (
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#241d13] to-[#0f0d09] border border-white/[0.05] flex items-center justify-center shrink-0">
                              <CartIcon size={20} className="text-[#F2A93B]/30" strokeWidth={1.5} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <div className="font-bold text-[#F5EFE6] leading-tight truncate">{c.item.name}</div>
                              <div className="text-[#F5EFE6] font-display font-semibold shrink-0">₹{formatPrice(parseFloat(c.item.price) * c.quantity)}</div>
                            </div>
                            <div className="flex items-center justify-between mt-2.5 gap-3">
                              <input
                                type="text"
                                placeholder="Add a note..."
                                value={c.note}
                                onChange={(e) => {
                                  setCart(cart.map(ci => ci.item.id === c.item.id ? { ...ci, note: e.target.value } : ci))
                                }}
                                className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[13px] text-[#F5EFE6] placeholder:text-[#6b6357] focus:outline-none focus:border-[#F2A93B]/50 transition-colors"
                              />
                              <div className="flex items-center gap-2 bg-black/50 border border-white/10 rounded-full px-1 py-1 shrink-0">
                                <button
                                  onClick={() => updateQuantity(c.item.id, -1)}
                                  aria-label={`Remove one ${c.item.name}`}
                                  className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[#F5EFE6] hover:bg-white/10 active:scale-90 transition-all"
                                >
                                  <Minus size={12} className="stroke-[3]" />
                                </button>
                                <span className="font-bold text-sm w-4 text-center tabular-nums">{c.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(c.item.id, 1)}
                                  aria-label={`Add one more ${c.item.name}`}
                                  className="w-7 h-7 rounded-full bg-[#F2A93B] flex items-center justify-center text-black hover:bg-[#f5b654] active:scale-90 transition-all"
                                >
                                  <Plus size={12} className="stroke-[3]" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="pt-1 space-y-5">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#A79C8D] uppercase tracking-wider ml-1 flex items-center gap-1.5"><User size={12} /> Your name</label>
                      <input
                        type="text"
                        placeholder="e.g. Mihir Jha"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-[#F5EFE6] placeholder:text-[#6b6357] focus:outline-none focus:border-[#F2A93B]/60 focus:ring-1 focus:ring-[#F2A93B]/40 transition-all text-[15px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#A79C8D] uppercase tracking-wider ml-1 flex items-center gap-1.5"><PenLine size={12} /> Special instructions</label>
                      <textarea
                        placeholder="Allergies, seating preferences, etc."
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-[#F5EFE6] placeholder:text-[#6b6357] focus:outline-none focus:border-[#F2A93B]/60 focus:ring-1 focus:ring-[#F2A93B]/40 transition-all min-h-[92px] resize-none text-sm"
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-3">
                    <label className="text-xs font-bold text-[#A79C8D] uppercase tracking-wider ml-1">Payment Method</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setPaymentMethod('pay_now')}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                          paymentMethod === 'pay_now'
                            ? 'bg-[#F2A93B]/10 border-[#F2A93B] text-[#F2A93B]'
                            : 'bg-black/40 border-white/10 text-[#6b6357] hover:border-white/20 hover:text-[#F5EFE6]'
                        }`}
                      >
                        <CreditCard size={20} className="mb-1.5" />
                        <span className="font-semibold text-[13px]">Pay Now</span>
                        <span className="text-[10px] opacity-70">Online</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('pay_later')}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                          paymentMethod === 'pay_later'
                            ? 'bg-[#F2A93B]/10 border-[#F2A93B] text-[#F2A93B]'
                            : 'bg-black/40 border-white/10 text-[#6b6357] hover:border-white/20 hover:text-[#F5EFE6]'
                        }`}
                      >
                        <Banknote size={20} className="mb-1.5" />
                        <span className="font-semibold text-[13px]">Pay Later</span>
                        <span className="text-[10px] opacity-70">Cash / Card at Desk</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 bg-[#100f0c] border-t border-white/[0.08] pb-8 sm:pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                <div className="flex justify-between items-center mb-5 px-1">
                  <span className="text-[#A79C8D] font-bold text-sm uppercase tracking-wider">Total</span>
                  <span className="font-display text-3xl font-semibold text-[#F5EFE6]">₹{formatPrice(cartTotal)}</span>
                </div>
                <button
                  onClick={submitOrder}
                  disabled={isSubmitting}
                  className="btn-shimmer w-full bg-gradient-to-r from-[#F2A93B] to-[#E4572E] text-black py-5 rounded-[1.75rem] font-extrabold text-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.015] active:scale-[0.985] disabled:opacity-50 disabled:scale-100 shadow-[0_10px_36px_rgba(228,87,46,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#100f0c]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={22} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>Place order <Send size={20} className="ml-0.5" /></>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600;700;800;900&display=swap');

        .font-display { font-family: 'Fraunces', ui-serif, Georgia, serif; }
        .font-body { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }

        .hide-scroll::-webkit-scrollbar {
          display: none;
        }
        .hide-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        @keyframes driftA {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, -30px) scale(1.08); }
        }
        @keyframes driftB {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 40px) scale(1.05); }
        }

        .btn-shimmer { position: relative; overflow: hidden; }
        .btn-shimmer::after {
          content: '';
          position: absolute;
          top: 0;
          left: -20%;
          height: 100%;
          width: 35%;
          background: linear-gradient(115deg, transparent, rgba(255,255,255,0.4), transparent);
          animation: shimmerSweep 3.6s ease-in-out infinite;
        }
        @keyframes shimmerSweep {
          0% { transform: translateX(-40%) skewX(-12deg); }
          55% { transform: translateX(340%) skewX(-12deg); }
          100% { transform: translateX(340%) skewX(-12deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .btn-shimmer::after { animation: none; display: none; }
        }
      `}</style>
    </div>
  )
}