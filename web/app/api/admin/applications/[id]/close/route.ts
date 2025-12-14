import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAdminAccess } from "@/lib/auth-utils"
import { z } from "zod"

const closeSchema = z.object({
    decision: z.enum(["recruited", "rejected"]),
    reason: z.string().max(500).optional()
})

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAdminAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = await params

    try {
        const body = await request.json()
        const parsed = closeSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json({ error: "Données invalides" }, { status: 400 })
        }

        const { decision, reason } = parsed.data
        const supabase = await createClient()

        // Vérifier que la candidature existe et n'est pas déjà clôturée
        const { data: application, error: fetchError } = await supabase
            .from('applications')
            .select('id, status, first_name, last_name, service, discord_channel_id')
            .eq('id', id)
            .single()

        if (fetchError || !application) {
            return NextResponse.json({ error: "Candidature non trouvée" }, { status: 404 })
        }

        if (application.status === 'recruited' || application.status === 'rejected') {
            return NextResponse.json({ error: "Candidature déjà clôturée" }, { status: 400 })
        }

        // Clôturer la candidature
        const now = new Date().toISOString()
        const { error: updateError } = await supabase
            .from('applications')
            .update({
                status: decision,
                closed_at: now,
                close_reason: reason || null,
                updated_at: now
            })
            .eq('id', id)

        if (updateError) {
            console.error('Close error:', updateError)
            return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
        }

        // Logger l'action
        await supabase.from('application_logs').insert({
            application_id: id,
            action: 'status_change',
            details: `Candidature clôturée: ${decision === 'recruited' ? 'Recruté' : 'Refusé'}${reason ? ` - ${reason}` : ''}`,
            performed_by_discord_id: authResult.session?.user?.discord_id || 'web',
            performed_by_name: authResult.session?.user?.discord_username || 'Admin Web'
        })

        // Notifier le bot pour envoyer le DM
        if (process.env.BOT_API_URL && process.env.BOT_API_SECRET) {
            try {
                await fetch(`${process.env.BOT_API_URL}/api/close`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.BOT_API_SECRET}`
                    },
                    body: JSON.stringify({
                        applicationId: id,
                        decision,
                        reason,
                        candidateName: `${application.first_name} ${application.last_name}`,
                        service: application.service
                    })
                })
            } catch {
                // Log mais ne pas bloquer
                console.error('Bot notification failed')
            }
        }

        return NextResponse.json({
            success: true,
            status: decision,
            message: decision === 'recruited' ? 'Candidat recruté !' : 'Candidature refusée'
        })

    } catch (error) {
        console.error('Close API error:', error)
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}
