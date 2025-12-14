import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Client Supabase côté serveur avec service_role key
 * À utiliser dans les API routes pour contourner le RLS
 */
export async function createClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )
}

/**
 * Client Supabase avec la clé anon (pour les opérations RLS-aware)
 */
export async function createAnonClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}
