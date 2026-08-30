'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import useSWR from 'swr'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Toaster } from 'sonner'
import { useRealtime } from '@/lib/use-realtime'
import { apiFetch, type Notification, acknowledgeNotification, type SessionUser, logoutMutation, type Property } from '@/lib/api-client'
import {
  Bell, ChefHat, ChevronDown, LayoutDashboard, LogOut, Menu,
  MessageSquareText, MoreHorizontal, ReceiptText, Settings2,
  ShieldCheck, ShoppingBag, Store, Users, X, Utensils, Clock3
} from 'lucide-react'

const navItems = [
  { label: 'Overview', description: 'Real-time snapshot of your property operations.', href: '/', icon: LayoutDashboard, roles: ['admin', 'manager', 'waiter', 'kitchen', 'cashier', 'runner'] },
  { label: 'Orders', description: 'Manage active tables, counters, and POS transactions.', href: '/orders', icon: ShoppingBag, roles: ['admin', 'manager', 'waiter', 'cashier', 'runner'] },
  { label: 'Kitchen', description: 'Manage kitchen tickets and prep flow.', href: '/kitchen', icon: ChefHat, roles: ['admin', 'manager', 'kitchen', 'waiter'] },
  { label: 'Service requests', description: 'Track and assign guest service requests.', href: '/requests', icon: MessageSquareText, roles: ['admin', 'manager', 'waiter', 'cashier', 'runner'] },
  { label: 'Billing', description: 'Process payments and manage invoices.', href: '/billing', icon: ReceiptText, roles: ['admin', 'manager', 'cashier'] },
  { label: 'Menu & locations', description: 'Configure your menu and service areas.', href: '/menu', icon: Store, roles: ['admin', 'manager', 'waiter'] },
  { label: 'QR Code Generator', description: 'Create and print table QR codes.', href: '/qr-generator', icon: ShoppingBag, roles: ['admin', 'manager'] },
  { label: 'Team access', description: 'Manage staff roles and permissions.', href: '/team', icon: Users, roles: ['admin', 'manager'] },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  const { data: sessionData, isLoading: sessionLoading } = useSWR<{ session: SessionUser }>(
    '/api/auth/session/',
    apiFetch,
    { revalidateOnFocus: true, shouldRetryOnError: false }
  )
  const user = sessionData?.session

  // Dynamic property ID from user context
  const propertyId = user?.propertyId || ''

  const { data: propData } = useSWR<{ property: Property }>(
    propertyId ? `/api/properties/${propertyId}/` : null,
    apiFetch
  )
  const propertyName = propData?.property?.name || 'Property'

  const { data: notifData, mutate: mutateNotif } = useSWR<{ notifications: Notification[] }>(
    propertyId ? `/api/properties/${propertyId}/notifications/` : null,
    apiFetch
  )

  const { connected, lastEvent } = useRealtime(propertyId)

  useEffect(() => {
    if (lastEvent?.type === 'new_notification') {
      mutateNotif()
    }
  }, [lastEvent, mutateNotif])

  const notifRef = useRef<HTMLDivElement>(null)

  const notifications = notifData?.notifications ?? []
  const visibleNotifications = notifications.filter(n => n.status !== 'acknowledged')

  const handleCloseNotifications = async () => {
    // Optimistic update
    if (visibleNotifications.length > 0) {
      mutateNotif({ notifications: notifications.map(n => ({ ...n, status: 'acknowledged' })) }, { revalidate: false })
      await Promise.all(visibleNotifications.map(n => acknowledgeNotification(n.id)))
      mutateNotif()
    }
    setShowNotifications(false)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        if (showNotifications) {
          handleCloseNotifications()
        }
      }
    }
    
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showNotifications, notifRef, visibleNotifications, mutateNotif])

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push('/login')
    }
  }, [user, sessionLoading, router])

  if (sessionLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-emerald-500">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Utensils size={32} />
          <span className="text-sm font-medium text-zinc-400">Loading workspace...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const activeNavItem = navItems.find(item => item.href === pathname)
  const activeNav = activeNavItem?.label || 'Overview'
  const activeDesc = activeNavItem?.description || ''

  const handleAcknowledge = async (id: string) => {
    // Optimistic update
    mutateNotif({ notifications: notifications.map(n => n.id === id ? { ...n, status: 'acknowledged' } : n) }, { revalidate: false })
    
    await acknowledgeNotification(id)
    mutateNotif()
  }

  const handleLogout = async () => {
    await logoutMutation()
    mutateNotif({ notifications: [] })
    router.push('/login')
  }

  return (
    <div className="operations-app">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Utensils size={20} /></div>
          <div><strong>Tableline</strong><span>Operations OS</span></div>
          <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={18} /></button>
        </div>

        {user?.propertyId && (
          <div className="property-switcher">
            <div className="property-icon"><Store size={16} /></div>
            <div><strong>{propertyName}</strong><span>{user.username} ({user.role || 'Staff'})</span></div>
            <ChevronDown size={15} className="muted-icon" />
          </div>
        )}

        <nav className="primary-nav" aria-label="Primary navigation">
          <span className="nav-label">Workspace</span>
          {navItems.filter(item => item.roles.includes(user?.role || '')).map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link key={item.label} href={item.href} className={`nav-item ${isActive ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                <Icon size={18} /><span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status"><span className="live-dot" /> All systems operational</div>
          {['admin', 'manager'].includes(user?.role || '') && (
            <Link href="/settings" className={`nav-item ${pathname === '/settings' ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
              <Settings2 size={18} /><span>Settings</span>
            </Link>
          )}
          <div className="user-card" onClick={handleLogout} style={{ cursor: 'pointer' }}>
            <div className="avatar">{user ? user.username.slice(0, 2).toUpperCase() : '..'}</div>
            <div><strong>{user ? user.username : 'Loading...'}</strong><span>{user?.role || 'Staff'}</span></div>
            <LogOut size={17} className="muted-icon" />
          </div>
        </div>
      </aside>

      {menuOpen ? <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} /> : null}

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={19} /></button>
            <div>
              <span className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <h1>{activeNav}</h1>
              {activeDesc && <p className="text-xs text-zinc-400 mt-1 font-medium">{activeDesc}</p>}
            </div>
          </div>
          <div className="topbar-actions">
            <div className="connection-state"><span className="live-dot" />Live</div>
            <div className="relative" ref={notifRef}>
              <button className="icon-button notification-trigger" aria-label="Open notifications" onClick={() => {
                if (showNotifications) handleCloseNotifications(); else setShowNotifications(true);
              }}>
                <Bell size={19} />{visibleNotifications.length > 0 ? <span className="notification-count">{visibleNotifications.length}</span> : null}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[70vh] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-zinc-800/50 bg-zinc-950/50 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Live Feed</span>
                      <h3 className="text-base font-bold text-zinc-100 mt-0.5 leading-none">Notifications</h3>
                    </div>
                    {visibleNotifications.length > 0 && (
                      <button onClick={handleCloseNotifications} className="text-xs font-medium text-zinc-400 hover:text-white transition-colors bg-zinc-800/50 hover:bg-zinc-800 px-2 py-1 rounded-md">Mark all read</button>
                    )}
                  </div>
                  <div className="overflow-y-auto custom-scrollbar flex-1 divide-y divide-zinc-800/50 bg-zinc-950/20">
                    {visibleNotifications.length ? visibleNotifications.map((notification) => {
                      let payloadText = typeof notification.payload === 'string' ? notification.payload : JSON.stringify(notification.payload)
                      try {
                        if (typeof notification.payload === 'object') {
                          if (notification.payload.message) payloadText = notification.payload.message
                          else if (notification.payload.tableNumber) payloadText = `Table ${notification.payload.tableNumber}`
                          else payloadText = Object.values(notification.payload).join(' - ')
                        }
                      } catch(e) {}
                      
                      const isReady = notification.notificationType === 'order_ready' || notification.notificationType === 'Order Ready'
                      const isPayment = notification.notificationType === 'payment_success' || notification.notificationType === 'order_settled'
                      const isNewOrder = notification.notificationType === 'new_order' || notification.notificationType === 'New Order'
                      
                      return (
                        <div className="p-4 hover:bg-zinc-800/50 transition-colors flex gap-3.5 group relative" key={notification.id}>
                          <div className={`mt-0.5 flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 border ${isReady ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : isPayment ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : isNewOrder ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                            <Bell size={14} />
                          </div>
                          <div className="flex-1 pr-6">
                            <strong className="block text-sm font-semibold text-zinc-200 capitalize">{notification.notificationType.replace(/_/g, ' ')}</strong>
                            <span className="block text-sm text-zinc-400 mt-1 leading-snug">{payloadText}</span>
                            <small className="block text-xs text-zinc-500 mt-2 font-medium flex items-center gap-1.5"><Clock3 size={10}/> {new Date(notification.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                          </div>
                          <button 
                            className="absolute right-3 top-4 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md" 
                            aria-label="Dismiss" 
                            onClick={(e) => { e.stopPropagation(); handleAcknowledge(notification.id); }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )
                    }) : (
                      <div className="p-10 flex flex-col items-center justify-center text-zinc-500 text-center gap-3">
                        <ShieldCheck size={36} className="opacity-20 text-emerald-500 mb-1" />
                        <div>
                          <span className="block font-semibold text-zinc-400 text-sm">You're all caught up</span>
                          <span className="block text-xs mt-1.5">No new notifications right now.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button className="user-avatar">{user ? user.username.slice(0, 2).toUpperCase() : '..'}</button>
          </div>
        </header>

        <div className="page-body">
          {children}
        </div>
      </main>
      <Toaster theme="dark" position="bottom-right" />
    </div>
  )
}
