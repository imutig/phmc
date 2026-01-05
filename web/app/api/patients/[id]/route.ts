import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireEmployeeAccess } from "@/lib/auth-utils"

// GET: Récupérer un patient par ID
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const authResult = await requireEmployeeAccess()
        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }

        const { id } = await context.params
        const supabase = await createClient()

        const { data: patient, error } = await supabase
            .from('patients')
            .select('*')
            .eq('id', id)
            .single()

        if (error || !patient) {
            return NextResponse.json(
                { error: "Patient non trouvé." },
                { status: 404 }
            )
        }

        // Récupérer l'historique des rendez-vous
        const { data: appointments } = await supabase
            .from('appointments')
            .select('*')
            .eq('patient_id', id)
            .order('created_at', { ascending: false })

        return NextResponse.json({
            patient,
            appointments: appointments || []
        })

    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json(
            { error: "Une erreur inattendue s'est produite." },
            { status: 500 }
        )
    }
}

// PATCH: Modifier un patient
export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const authResult = await requireEmployeeAccess()
        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }

        const { id } = await context.params
        const supabase = await createClient()
        const body = await request.json()

        // Champs modifiables
        const allowedFields = [
            'photo_url', 'address', 'blood_type', 'allergies',
            'medical_history', 'emergency_contact', 'emergency_phone', 'notes',
            'fingerprint'
        ]

        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString()
        }

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field]
            }
        }

        // Récupérer l'ancienne valeur pour l'audit
        const { data: oldData } = await supabase
            .from('patients')
            .select('*')
            .eq('id', id)
            .single()

        const { data: patient, error } = await supabase
            .from('patients')
            .update(updateData)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            console.error('Error updating patient:', error)
            return NextResponse.json(
                { error: "Erreur lors de la modification du patient." },
                { status: 500 }
            )
        }

        // Audit log
        const { logAudit, getDisplayName } = await import('@/lib/audit')
        await logAudit({
            actorDiscordId: authResult.session!.user.discord_id,
            actorName: getDisplayName(authResult.session!.user),
            action: 'update',
            tableName: 'patients',
            recordId: id,
            oldData: oldData || undefined,
            newData: patient
        })

        return NextResponse.json({ patient })

    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json(
            { error: "Une erreur inattendue s'est produite." },
            { status: 500 }
        )
    }
}
