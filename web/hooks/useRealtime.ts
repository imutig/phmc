'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface UseRealtimeOptions<T extends Record<string, any>> {
    /** Nom de la table Supabase */
    table: string
    /** Type d'événement à écouter */
    event?: PostgresChangeEvent
    /** Schéma (défaut: 'public') */
    schema?: string
    /** Filtre optionnel (ex: 'user_id=eq.123') */
    filter?: string
    /** Callback appelé lors d'un changement */
    onInsert?: (record: T) => void
    onUpdate?: (record: T, oldRecord: T) => void
    onDelete?: (oldRecord: T) => void
    onChange?: (payload: { eventType: string; new: T | null; old: T | null }) => void
}

/**
 * Hook pour écouter les changements realtime Supabase
 * 
 * @example
 * // Écouter tous les changements sur une table
 * useRealtime({
 *   table: 'services',
 *   onInsert: (service) => setServices(prev => [...prev, service]),
 *   onDelete: (old) => setServices(prev => prev.filter(s => s.id !== old.id))
 * })
 * 
 * // Écouter avec un filtre
 * useRealtime({
 *   table: 'services',
 *   filter: `user_discord_id=eq.${userId}`,
 *   onUpdate: (service) => updateLocalService(service)
 * })
 */
export function useRealtime<T extends Record<string, any>>(
    options: UseRealtimeOptions<T>
) {
    const {
        table,
        event = '*',
        schema = 'public',
        filter,
        onInsert,
        onUpdate,
        onDelete,
        onChange
    } = options

    // Refs pour garder les callbacks à jour sans recréer le channel
    const onInsertRef = useRef(onInsert)
    const onUpdateRef = useRef(onUpdate)
    const onDeleteRef = useRef(onDelete)
    const onChangeRef = useRef(onChange)

    useEffect(() => {
        onInsertRef.current = onInsert
        onUpdateRef.current = onUpdate
        onDeleteRef.current = onDelete
        onChangeRef.current = onChange
    }, [onInsert, onUpdate, onDelete, onChange])

    useEffect(() => {
        const supabase = createClient()
        const channelName = `realtime-${table}-${filter || 'all'}-${Date.now()}`

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const channelConfig: any = {
            event,
            schema,
            table
        }

        if (filter) {
            channelConfig.filter = filter
        }

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes' as const,
                channelConfig,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (payload: any) => {
                    const { eventType, new: newRecord, old: oldRecord } = payload

                    // Callback générique
                    onChangeRef.current?.({
                        eventType,
                        new: newRecord as T | null,
                        old: oldRecord as T | null
                    })

                    // Callbacks spécifiques
                    if (eventType === 'INSERT' && newRecord) {
                        onInsertRef.current?.(newRecord as T)
                    } else if (eventType === 'UPDATE' && newRecord) {
                        onUpdateRef.current?.(newRecord as T, oldRecord as T)
                    } else if (eventType === 'DELETE' && oldRecord) {
                        onDeleteRef.current?.(oldRecord as T)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [table, event, schema, filter])
}

/**
 * Hook simplifié pour synchroniser un state local avec Supabase realtime
 * 
 * @example
 * const [services, setServices] = useState<Service[]>([])
 * 
 * useRealtimeSync({
 *   table: 'services',
 *   setItems: setServices,
 *   idField: 'id'
 * })
 */
export function useRealtimeSync<T extends Record<string, any>>(options: {
    table: string
    setItems: React.Dispatch<React.SetStateAction<T[]>>
    idField?: keyof T
    filter?: string
}) {
    const { table, setItems, idField = 'id', filter } = options

    useRealtime<T>({
        table,
        filter,
        onInsert: useCallback((record: T) => {
            setItems((prev: T[]) => {
                // Éviter les doublons
                if (prev.some((item: T) => item[idField] === record[idField])) {
                    return prev
                }
                return [...prev, record]
            })
        }, [setItems, idField]),
        onUpdate: useCallback((record: T) => {
            setItems((prev: T[]) => prev.map((item: T) =>
                item[idField] === record[idField] ? record : item
            ))
        }, [setItems, idField]),
        onDelete: useCallback((oldRecord: T) => {
            setItems((prev: T[]) => prev.filter((item: T) =>
                item[idField] !== oldRecord[idField]
            ))
        }, [setItems, idField])
    })
}
