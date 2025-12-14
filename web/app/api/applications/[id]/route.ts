import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.discord_id) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401 }
            )
        }

        const { id: applicationId } = await params
        const supabase = await createClient()

        // Récupérer l'utilisateur
        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('discord_id', session.user.discord_id)
            .single()

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur non trouvé." },
                { status: 404 }
            )
        }

        // Récupérer la candidature et vérifier qu'elle appartient à l'utilisateur
        const { data: application, error: fetchError } = await supabase
            .from('applications')
            .select('*, application_documents(*)')
            .eq('id', applicationId)
            .eq('user_id', user.id)
            .single()

        if (fetchError || !application) {
            return NextResponse.json(
                { error: "Candidature non trouvée ou non autorisée." },
                { status: 404 }
            )
        }

        // Vérifier que la candidature peut être retirée (pas déjà clôturée)
        if (['rejected', 'recruited'].includes(application.status)) {
            return NextResponse.json(
                { error: "Cette candidature est déjà clôturée." },
                { status: 400 }
            )
        }

        // Supprimer les fichiers du storage
        if (application.application_documents && application.application_documents.length > 0) {
            const filePaths = application.application_documents.map((doc: { file_url: string }) => {
                const urlParts = doc.file_url.split('/documents/')
                return urlParts.length > 1 ? urlParts[1] : null
            }).filter((path: string | null) => path !== null)

            if (filePaths.length > 0) {
                await supabase.storage
                    .from('documents')
                    .remove(filePaths)
            }

            // Supprimer les enregistrements de documents
            await supabase
                .from('application_documents')
                .delete()
                .eq('application_id', applicationId)
        }

        // Logger l'action avant suppression
        await supabase.from('application_logs').insert({
            application_id: applicationId,
            actor_discord_id: session.user.discord_id,
            actor_name: session.user.discord_username || session.user.name,
            action: 'application_withdrawn',
            details: {
                service: application.service,
                previous_status: application.status,
                first_name: application.first_name,
                last_name: application.last_name
            }
        })

        // Si un salon Discord existe, on garde l'ID pour notifier
        const discordChannelId = application.discord_channel_id

        // Supprimer les votes
        await supabase
            .from('application_votes')
            .delete()
            .eq('application_id', applicationId)

        // Supprimer les messages
        await supabase
            .from('application_messages')
            .delete()
            .eq('application_id', applicationId)

        // Supprimer la candidature
        const { error: deleteError } = await supabase
            .from('applications')
            .delete()
            .eq('id', applicationId)

        if (deleteError) {
            console.error('Error deleting application:', deleteError)
            return NextResponse.json(
                { error: "Erreur lors de la suppression." },
                { status: 500 }
            )
        }

        // Notifier le bot pour envoyer les messages
        if (process.env.BOT_API_URL && process.env.BOT_API_SECRET && discordChannelId) {
            try {
                await fetch(`${process.env.BOT_API_URL}/api/withdrawal`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.BOT_API_SECRET}`
                    },
                    body: JSON.stringify({
                        channelId: discordChannelId,
                        candidateDiscordId: session.user.discord_id,
                        candidateName: `${application.first_name} ${application.last_name}`,
                        service: application.service
                    })
                })
            } catch (botError) {
                console.error('Bot notification error:', botError)
                // Continue, la suppression a réussi
            }
        }

        return NextResponse.json({
            success: true,
            message: "Candidature retirée avec succès.",
            discordChannelId
        })

    } catch (error) {
        console.error('Withdraw error:', error)
        return NextResponse.json(
            { error: "Une erreur inattendue s'est produite." },
            { status: 500 }
        )
    }
}
