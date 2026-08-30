import useSWR from 'swr'
import { apiFetch } from '@/lib/api-client'

type ApiOrder = { id: string; number: number; status: string; total: string; items: { quantity: number }[] }
export type LiveOrder = ApiOrder & { itemCount: number }

export function useLiveOrders(propertyId?: string) {
  const result = useSWR<{ orders: ApiOrder[] }>(
    propertyId ? `/api/properties/${propertyId}/orders/` : null,
    apiFetch
  )
  return { ...result, orders: (result.data?.orders ?? []).map((order) => ({ ...order, itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0) })) }
}
