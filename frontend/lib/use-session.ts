'use client'
import useSWR from 'swr'
import { fetchSession, type SessionUser } from './api-client'

export function useSession() {
    const { data, error, isLoading, mutate } = useSWR<{ session: SessionUser | null }>(
        '/api/auth/session/',
        fetchSession,
        { revalidateOnFocus: true, shouldRetryOnError: false }
    )
    return { session: data?.session ?? null, isLoading, error, mutate }
}