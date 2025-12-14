import { createClient } from "@/lib/supabase/server"
import { requireAdminAccess } from "@/lib/auth-utils"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
    // Vérification centralisée
    const authResult = await requireAdminAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    try {
        const supabase = await createClient()
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const service = searchParams.get('service')

        // Pagination
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const offset = (page - 1) * limit

        // Requête de comptage total
        let countQuery = supabase
            .from('applications')
            .select('id', { count: 'exact', head: true })

        if (status && status !== 'all') countQuery = countQuery.eq('status', status)
        if (service && service !== 'all') countQuery = countQuery.eq('service', service)

        const { count } = await countQuery

        // Requête principale avec pagination
        let query = supabase
            .from('applications')
            .select(`
                *,
                users(discord_id, discord_username, avatar_url),
                application_documents(type, file_url),
                application_votes(voter_name, vote),
                application_messages(id)
            `)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (status && status !== 'all') query = query.eq('status', status)
        if (service && service !== 'all') query = query.eq('service', service)

        const { data: applications, error } = await query

        if (error) {
            console.error('Error fetching applications:', error)
            return NextResponse.json({ error: "Erreur lors de la récupération." }, { status: 500 })
        }

        const enrichedApplications = applications?.map(app => ({
            ...app,
            stats: {
                votes_pour: app.application_votes?.filter((v: { vote: boolean }) => v.vote).length || 0,
                votes_contre: app.application_votes?.filter((v: { vote: boolean }) => !v.vote).length || 0,
                documents_count: app.application_documents?.length || 0,
                messages_count: app.application_messages?.length || 0
            }
        }))

        const total = count || 0
        const totalPages = Math.ceil(total / limit)

        return NextResponse.json({
            applications: enrichedApplications || [],
            isAdmin: authResult.roles.includes('direction'),
            total,
            page,
            limit,
            totalPages
        })

    } catch (error) {
        console.error('Admin API error:', error)
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 })
    }
}

