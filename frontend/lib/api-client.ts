const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`
  const method = (options.method ?? 'GET').toUpperCase()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(method !== 'GET' && method !== 'HEAD' ? { 'X-CSRFToken': getCsrfToken() } : {}),
    ...options.headers,
  }

  const response = await fetch(url, { ...options, headers, credentials: 'include' })

  let payload = null
  try { payload = await response.json() } catch { /* e.g. empty logout response */ }

  if (!response.ok) {
    const message = payload?.error || `API request failed (${response.status})`
    throw new Error(message)
  }
  return payload as T
}



// ---- Types ----
export type Order = { id: string; number: number; status: string; subtotal: string; taxTotal: string; total: string; notes: string; createdAt: string; updatedAt: string; paymentMethod: string | null; deliveredAt: string | null; items: { name: string; quantity: number; status: string; unitPrice: string }[] }
export type RevenueSummary = { orderCount: number; paidCount: number; openOrders: number; preparingOrders: number; grossRevenue: string }
export type Notification = { id: string; notificationType: string; channel: string; status: string; payload: any; createdAt: string }
export type Property = { id: string; name: string; currency: string; taxRate: string; timezone?: string }
export interface MenuItem {
  id: string
  name: string
  description: string
  price: string
  category: string
  subCategory?: string
  dietaryPreference?: string
  available: boolean
  isBestseller?: boolean
  preparationTime?: number
  gstRate?: string
  discountPercentage?: string
  stockQuantity?: number
  ingredients?: string
  spiceLevel?: number
  prepStation: string
  imageUrl?: string
}
export type Location = { id: string; label: string; kind: string; capacity: number; active: boolean }
export type SessionUser = { id: number; username: string; isAuthenticated: boolean; propertyId: string | null; role: string | null }
export type Room = { id: string; number: string; occupied: boolean; guestName: string; folioReference: string }
export type Delivery = { id: string; orderId: string; orderNumber: number | null; orderCreatedAt: string | null; timeToReadyMs: number | null; roomNumber: string; status: string; runnerId: number | null }
export type Runner = { id: number; name: string; role: string }

// ---- Queries (GET) — these were missing entirely, which is why nothing had data to render ----
export const fetchSession = () => apiFetch<{ session: SessionUser | null }>('/api/auth/session/')
export const fetchProperties = () => apiFetch<{ properties: Property[] }>('/api/properties/')
export const fetchPropertyDetails = (propertyId: string) => apiFetch<{ property: Property }>(`/api/properties/${propertyId}/`)
export const fetchMenu = (propertyId: string) => apiFetch<{ menu: MenuItem[] }>(`/api/properties/${propertyId}/menu/`)
export const fetchLocations = (propertyId: string) => apiFetch<{ locations: Location[] }>(`/api/properties/${propertyId}/locations/`)
export const fetchOrders = (propertyId: string, status?: string) =>
  apiFetch<{ orders: Order[] }>(`/api/properties/${propertyId}/orders/${status ? `?status=${status}` : ''}`)
export const fetchRevenueSummary = (propertyId: string) => apiFetch<{ revenueSummary: RevenueSummary }>(`/api/properties/${propertyId}/revenue-summary/`)
export const fetchDeliveries = (propertyId: string, status?: string) =>
  apiFetch<{ deliveries: Delivery[] }>(`/api/properties/${propertyId}/deliveries/${status ? `?status=${status}` : ''}`)
export const fetchRooms = (propertyId: string) => apiFetch<{ rooms: Room[] }>(`/api/properties/${propertyId}/rooms/`)
export const fetchNotifications = (propertyId: string) => apiFetch<{ notifications: Notification[] }>(`/api/properties/${propertyId}/notifications/`)

export async function updatePropertyDetails(propertyId: string, data: { name?: string; currency?: string; taxRate?: string; timezone?: string }) {
  return apiFetch<{ property: Property }>(`/api/properties/${propertyId}/`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })
}

// ---- Mutations (unchanged from what you had) ----
export async function createMenuItem(propertyId: string, data: any) {
  return apiFetch(`/api/properties/${propertyId}/menu/`, { method: 'POST', body: JSON.stringify({ data }) })
}
export async function createLocation(propertyId: string, data: any) {
  return apiFetch(`/api/properties/${propertyId}/locations/`, { method: 'POST', body: JSON.stringify(data) })
}
export async function updateMenuItem(id: string, data: any) {
  return apiFetch(`/api/menu/${id}/`, { method: 'PUT', body: JSON.stringify({ data }) })
}
export async function deleteMenuItem(id: string) {
  return apiFetch(`/api/menu/${id}/`, { method: 'DELETE' })
}
export async function uploadImage(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`${API_URL}/api/upload/`, {
    method: 'POST',
    headers: { 'X-CSRFToken': getCsrfToken() },
    body: formData,
    credentials: 'include'
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'Failed to upload image')
  }
  return response.json()
}
export async function submitOrder(propertyId: string, locationId: string, idempotencyKey: string, items: any[], notes: string) {
  return apiFetch(`/api/properties/${propertyId}/orders/`, { method: 'POST', body: JSON.stringify({ locationId, idempotencyKey, items, notes }) })
}
export async function updateOrder(orderId: string, items: any[], notes: string) {
  return apiFetch(`/api/orders/${orderId}/`, { method: 'PATCH', body: JSON.stringify({ items, notes }) })
}
export async function deleteOrder(orderId: string) {
  return apiFetch(`/api/orders/${orderId}/`, { method: 'DELETE' })
}
export async function markOrderReady(orderId: string) {
  return apiFetch(`/api/orders/${orderId}/ready/`, { method: 'POST' })
}
export async function processPayment(orderId: string, amount: string, method: string, idempotencyKey: string) {
  return apiFetch(`/api/orders/${orderId}/pay/`, { method: 'POST', body: JSON.stringify({ amount, method, idempotencyKey }) })
}
export async function assignDelivery(deliveryId: string, runnerId: number) {
  return apiFetch(`/api/deliveries/${deliveryId}/assign/`, { method: 'POST', body: JSON.stringify({ runnerId }) })
}
export async function completeDelivery(deliveryId: string) {
  return apiFetch(`/api/deliveries/${deliveryId}/complete/`, { method: 'POST' })
}
export async function acknowledgeNotification(notificationId: string) {
  return apiFetch(`/api/notifications/${notificationId}/acknowledge/`, { method: 'POST' })
}
export async function loginMutation(data: any) {
  return apiFetch('/api/auth/login/', { method: 'POST', body: JSON.stringify(data) })
}
export async function signupMutation(data: any) {
  return apiFetch('/api/auth/signup/', { method: 'POST', body: JSON.stringify(data) })
}

export type TeamMember = {
  id: number
  username: string
  role: string
  active: boolean
  isOnline: boolean
}

export async function fetchTeamMembers(propertyId: string): Promise<{ team: TeamMember[] }> {
  return apiFetch(`/api/properties/${propertyId}/team/`)
}

export async function addTeamMember(propertyId: string, data: { username: string, role: string }) {
  return apiFetch(`/api/properties/${propertyId}/team/`, { method: 'POST', body: JSON.stringify(data) })
}

export async function updateTeamMemberRole(propertyId: string, userId: number, role: string) {
  return apiFetch(`/api/properties/${propertyId}/team/${userId}/`, { method: 'PATCH', body: JSON.stringify({ role }) })
}

export async function removeTeamMember(propertyId: string, userId: number) {
  return apiFetch(`/api/properties/${propertyId}/team/${userId}/`, { method: 'DELETE' })
}
export async function logoutMutation() {
  return apiFetch('/api/auth/logout/', { method: 'POST' })
}