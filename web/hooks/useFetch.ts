'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface FetchState<T> {
    data: T | null
    loading: boolean
    error: string | null
}

interface UseFetchOptions {
    /** Exécuter le fetch automatiquement au mount */
    immediate?: boolean
    /** Dépendances qui déclenchent un refetch */
    deps?: any[]
}

/**
 * Hook générique pour les appels API avec gestion loading/error
 * 
 * @example
 * const { data, loading, error, refetch } = useFetch<Event[]>(
 *   '/api/intranet/events?week=1&year=2026',
 *   { immediate: true }
 * )
 */
export function useFetch<T>(
    url: string | null,
    options: UseFetchOptions = {}
): FetchState<T> & { refetch: () => Promise<void> } {
    const { immediate = true, deps = [] } = options
    const [state, setState] = useState<FetchState<T>>({
        data: null,
        loading: immediate && !!url,
        error: null
    })

    const fetchData = useCallback(async () => {
        if (!url) {
            setState(prev => ({ ...prev, loading: false }))
            return
        }

        setState(prev => ({ ...prev, loading: true, error: null }))

        try {
            const res = await fetch(url)
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                throw new Error(errorData.error || `Erreur ${res.status}`)
            }
            const data = await res.json()
            setState({ data, loading: false, error: null })
        } catch (err: any) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: err.message || 'Erreur inconnue'
            }))
        }
    }, [url])

    useEffect(() => {
        if (immediate && url) {
            fetchData()
        }
    }, [url, immediate, ...deps])

    return { ...state, refetch: fetchData }
}

/**
 * Hook pour les appels API avec mutation (POST, PUT, DELETE)
 * 
 * @example
 * const { mutate, loading, error } = useMutation<Event>(
 *   '/api/intranet/events',
 *   'POST'
 * )
 * 
 * const handleSubmit = async () => {
 *   const result = await mutate({ title: 'Mon event' })
 *   if (result) toast.success('Créé!')
 * }
 */
export function useMutation<T, B = any>(
    url: string,
    method: 'POST' | 'PUT' | 'DELETE' = 'POST'
) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const mutate = useCallback(async (body?: B): Promise<T | null> => {
        setLoading(true)
        setError(null)

        try {
            const res = await fetch(url, {
                method,
                headers: body ? { 'Content-Type': 'application/json' } : {},
                body: body ? JSON.stringify(body) : undefined
            })

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                throw new Error(errorData.error || `Erreur ${res.status}`)
            }

            const data = await res.json()
            setLoading(false)
            return data as T
        } catch (err: any) {
            setError(err.message || 'Erreur inconnue')
            setLoading(false)
            return null
        }
    }, [url, method])

    return { mutate, loading, error }
}

/**
 * Hook pour les appels API paginés
 * 
 * @example
 * const { data, loading, hasMore, loadMore } = usePaginatedFetch<Event>(
 *   '/api/intranet/events',
 *   { pageSize: 20 }
 * )
 */
export function usePaginatedFetch<T>(
    baseUrl: string,
    options: { pageSize?: number; immediate?: boolean } = {}
) {
    const { pageSize = 20, immediate = true } = options
    const [data, setData] = useState<T[]>([])
    const [loading, setLoading] = useState(immediate)
    const [error, setError] = useState<string | null>(null)
    const [page, setPage] = useState(0)
    const [hasMore, setHasMore] = useState(true)

    const loadMore = useCallback(async () => {
        if (loading || !hasMore) return

        setLoading(true)
        setError(null)

        try {
            const separator = baseUrl.includes('?') ? '&' : '?'
            const res = await fetch(`${baseUrl}${separator}limit=${pageSize}&offset=${page * pageSize}`)

            if (!res.ok) throw new Error(`Erreur ${res.status}`)

            const newData = await res.json()
            const items = Array.isArray(newData) ? newData : newData.data || []

            setData(prev => [...prev, ...items])
            setHasMore(items.length === pageSize)
            setPage(prev => prev + 1)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [baseUrl, page, pageSize, loading, hasMore])

    useEffect(() => {
        if (immediate) loadMore()
    }, [])

    const reset = useCallback(() => {
        setData([])
        setPage(0)
        setHasMore(true)
    }, [])

    return { data, loading, error, hasMore, loadMore, reset }
}
