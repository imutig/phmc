import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess } from "@/lib/auth-utils"

// GET /api/patients/[id]/medical-exams - Liste des examens du patient
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: patientId } = await params
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const { authorized } = await requireEmployeeAccess()
        if (!authorized) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
        }

        const supabase = await createClient()

        const { data: exams, error } = await supabase
            .from('medical_exams')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(exams)

    } catch (error) {
        console.error('Error fetching medical exams:', error)
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}

// POST /api/patients/[id]/medical-exams - Créer un nouvel examen
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: patientId } = await params
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const { authorized } = await requireEmployeeAccess()
        if (!authorized) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
        }

        const supabase = await createClient()

        // Vérifier que le patient existe
        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('id')
            .eq('id', patientId)
            .single()

        if (patientError || !patient) {
            return NextResponse.json({ error: "Patient introuvable" }, { status: 404 })
        }

        // Créer l'examen en brouillon
        const { data: exam, error: createError } = await supabase
            .from('medical_exams')
            .insert({
                patient_id: patientId,
                created_by: session.user.discord_id,
                created_by_name: session.user.name || session.user.discord_username,
                status: 'draft',
                visit_date: new Date().toISOString().split('T')[0]
            })
            .select()
            .single()

        if (createError) {
            return NextResponse.json({ error: createError.message }, { status: 500 })
        }

        return NextResponse.json(exam, { status: 201 })

    } catch (error) {
        console.error('Error creating medical exam:', error)
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}
