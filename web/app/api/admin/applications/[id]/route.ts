import { createClient } from "@/lib/supabase/server"
import { requireAdminAccess } from "@/lib/auth-utils"
import { NextRequest, NextResponse } from "next/server"

const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3001'
const BOT_API_SECRET = process.env.BOT_API_SECRET

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAdminAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    try {
        const { id: applicationId } = await params
        const supabase = await createClient()

        const { data: application, error } = await supabase
            .from('applications')
            .select(`
                *,
                users(discord_id, discord_username, avatar_url),
                application_documents(type, file_url, created_at),
                application_votes(voter_discord_id, voter_name, vote, comment, created_at),
                application_messages(id, sender_name, content, is_from_candidate, message_number, is_deleted, created_at)
            `)
            .eq('id', applicationId)
            .single()

        if (error || !application) {
            return NextResponse.json({ error: "Candidature non trouvée." }, { status: 404 })
        }

        const { data: logs } = await supabase
            .from('application_logs')
            .select('*')
            .eq('application_id', applicationId)
            .order('created_at', { ascending: false })

        return NextResponse.json({ application, logs: logs || [] })

    } catch (error) {
        console.error('Admin detail API error:', error)
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 })
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAdminAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    try {
        const { id: applicationId } = await params
        const supabase = await createClient()
        const body = await request.json()
        const { status } = body

        // Récupérer le channel Discord avant la mise à jour
        const { data: application } = await supabase
            .from('applications')
            .select('discord_channel_id')
            .eq('id', applicationId)
            .single()

        const { error } = await supabase
            .from('applications')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', applicationId)

        if (error) {
            return NextResponse.json({ error: "Erreur lors de la mise à jour." }, { status: 500 })
        }

        const actorName = authResult.session?.user?.discord_username || authResult.session?.user?.name || 'Recruteur'

        await supabase.from('application_logs').insert({
            application_id: applicationId,
            actor_discord_id: authResult.session?.user?.discord_id,
            actor_name: actorName,
            action: 'status_change_web',
            details: { new_status: status }
        })

        // Envoyer l'embed de statut sur Discord
        if (BOT_API_SECRET && application?.discord_channel_id) {
            try {
                await fetch(`${BOT_API_URL}/api/status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${BOT_API_SECRET}`
                    },
                    body: JSON.stringify({
                        channelId: application.discord_channel_id,
                        newStatus: status,
                        actorName
                    })
                })
            } catch (botError) {
                console.error('[Status API] Bot webhook error:', botError)
            }
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Admin update API error:', error)
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAdminAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    // Note: Tous les recruteurs peuvent supprimer des candidatures

    try {
        const { id: applicationId } = await params
        const supabase = await createClient()

        const actorName = authResult.session?.user?.discord_username || authResult.session?.user?.name || 'Admin'

        // Récupérer les infos avant suppression pour le log
        const { data: application } = await supabase
            .from('applications')
            .select('first_name, last_name, service, discord_channel_id')
            .eq('id', applicationId)
            .single()

        if (!application) {
            return NextResponse.json({ error: "Candidature non trouvée." }, { status: 404 })
        }

        // Supprimer en cascade (les FK avec ON DELETE CASCADE s'en chargent)
        // Mais on supprime explicitement pour être sûr
        await supabase.from('application_logs').delete().eq('application_id', applicationId)
        await supabase.from('application_messages').delete().eq('application_id', applicationId)
        await supabase.from('application_votes').delete().eq('application_id', applicationId)
        await supabase.from('application_documents').delete().eq('application_id', applicationId)

        const { error } = await supabase
            .from('applications')
            .delete()
            .eq('id', applicationId)

        if (error) {
            console.error('Delete error:', error)
            return NextResponse.json({ error: "Erreur lors de la suppression." }, { status: 500 })
        }

        // Notifier sur Discord que la candidature a été supprimée
        if (BOT_API_SECRET && application.discord_channel_id) {
            try {
                await fetch(`${BOT_API_URL}/api/status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${BOT_API_SECRET}`
                    },
                    body: JSON.stringify({
                        channelId: application.discord_channel_id,
                        newStatus: 'deleted',
                        actorName
                    })
                })
            } catch (botError) {
                console.error('[Delete API] Bot webhook error:', botError)
            }
        }

        console.log(`[Delete] Application ${applicationId} (${application.first_name} ${application.last_name}) deleted by ${actorName}`)

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Admin delete API error:', error)
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 })
    }
}
