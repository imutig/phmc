import { createClient } from "@/lib/supabase/server"
import { requireAdminAccess } from "@/lib/auth-utils"
import { NextRequest, NextResponse } from "next/server"

const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3001'
const BOT_API_SECRET = process.env.BOT_API_SECRET

// PATCH - Modifier un message
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; messageId: string }> }
) {
    const authResult = await requireAdminAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    try {
        const { id: applicationId, messageId } = await params
        const supabase = await createClient()
        const body = await request.json()
        const { content } = body

        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return NextResponse.json({ error: "Contenu requis." }, { status: 400 })
        }

        // Vérifier que le message existe et appartient à cette candidature
        const { data: message, error: fetchError } = await supabase
            .from('application_messages')
            .select('*, applications(discord_channel_id)')
            .eq('id', messageId)
            .eq('application_id', applicationId)
            .single()

        if (fetchError || !message) {
            return NextResponse.json({ error: "Message non trouvé." }, { status: 404 })
        }

        // Seul l'expéditeur ou un admin peut modifier
        if (message.sender_discord_id !== authResult.session?.user?.discord_id) {
            return NextResponse.json({ error: "Vous ne pouvez modifier que vos propres messages." }, { status: 403 })
        }

        // Mettre à jour le message
        const { error: updateError } = await supabase
            .from('application_messages')
            .update({
                content: content.trim(),
                updated_at: new Date().toISOString()
            })
            .eq('id', messageId)

        if (updateError) {
            return NextResponse.json({ error: "Erreur lors de la modification." }, { status: 500 })
        }

        // Appeler le bot pour mettre à jour le DM si c'était un message des recruteurs
        if (!message.is_from_candidate && BOT_API_SECRET && message.discord_message_id) {
            try {
                await fetch(`${BOT_API_URL}/api/message/edit`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${BOT_API_SECRET}`
                    },
                    body: JSON.stringify({
                        discordMessageId: message.discord_message_id,
                        candidateDiscordId: message.candidate_discord_id,
                        newContent: content.trim()
                    })
                })
            } catch {
                // Continue, le message BDD est mis à jour
            }
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Message PATCH error:', error)
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 })
    }
}

// DELETE - Supprimer un message
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; messageId: string }> }
) {
    const authResult = await requireAdminAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    try {
        const { id: applicationId, messageId } = await params
        const supabase = await createClient()

        // Vérifier que le message existe
        const { data: message, error: fetchError } = await supabase
            .from('application_messages')
            .select('*')
            .eq('id', messageId)
            .eq('application_id', applicationId)
            .single()

        if (fetchError || !message) {
            return NextResponse.json({ error: "Message non trouvé." }, { status: 404 })
        }

        // Seul l'expéditeur peut supprimer
        if (message.sender_discord_id !== authResult.session?.user?.discord_id) {
            return NextResponse.json({ error: "Vous ne pouvez supprimer que vos propres messages." }, { status: 403 })
        }

        // Supprimer le message
        const { error: deleteError } = await supabase
            .from('application_messages')
            .delete()
            .eq('id', messageId)

        if (deleteError) {
            return NextResponse.json({ error: "Erreur lors de la suppression." }, { status: 500 })
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Message DELETE error:', error)
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 })
    }
}
