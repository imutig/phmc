import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess, checkPermission } from "@/lib/auth-utils"
import { NextResponse } from "next/server"

// GET - Récupérer les audit logs avec pagination et filtres
export async function GET(request: Request) {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    // Vérification permission granulaire
    const canView = await checkPermission(authResult.roles, 'audit.view')
    if (!canView) {
        return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Filtres
    const tableName = searchParams.get('table')
    const action = searchParams.get('action')
    const actorId = searchParams.get('actor')
    const search = searchParams.get('search')
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')

    const supabase = await createClient()

    // Construction de la requête
    let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    // Appliquer les filtres
    if (tableName) {
        query = query.eq('table_name', tableName)
    }
    if (action) {
        query = query.eq('action', action)
    }
    if (actorId) {
        query = query.eq('actor_discord_id', actorId)
    }
    if (dateFrom) {
        query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
        query = query.lte('created_at', dateTo)
    }
    if (search) {
        query = query.or(`actor_name.ilike.%${search}%,table_name.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Récupérer les valeurs distinctes pour les filtres
    const { data: tables } = await supabase
        .from('audit_logs')
        .select('table_name')
        .limit(100)

    const { data: actors } = await supabase
        .from('audit_logs')
        .select('actor_discord_id, actor_name')
        .limit(100)

    // Dédupliquer
    const uniqueTables = [...new Set(tables?.map(t => t.table_name) || [])]
    const uniqueActors = [...new Map(
        (actors || []).map(a => [a.actor_discord_id, a])
    ).values()]

    return NextResponse.json({
        logs: data || [],
        pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
        },
        filters: {
            tables: uniqueTables,
            actors: uniqueActors,
            actions: ['create', 'update', 'delete', 'restore']
        }
    })
}
