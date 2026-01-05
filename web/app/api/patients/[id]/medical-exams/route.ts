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
            .is('deleted_at', null)
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

        // Get form data from request body
        const body = await request.json().catch(() => ({}))

        // Créer la visite avec toutes les données
        const { data: exam, error: createError } = await supabase
            .from('medical_exams')
            .insert({
                patient_id: patientId,
                created_by: session.user.discord_id,
                created_by_name: session.user.name || session.user.discord_username,
                status: body.status || 'completed',
                visit_date: body.visit_date || new Date().toISOString().split('T')[0],
                visit_type: body.visit_type || null,
                profession: body.profession || null,
                employer: body.employer || null,
                personal_history: body.personal_history || null,
                family_history: body.family_history || null,
                allergies: body.allergies || false,
                allergies_details: body.allergies_details || null,
                current_treatment: body.current_treatment || null,
                tobacco: body.tobacco || false,
                alcohol: body.alcohol || false,
                sleep_quality: body.sleep_quality || null,
                height_cm: body.height_cm || null,
                weight_kg: body.weight_kg || null,
                blood_pressure_systolic: body.blood_pressure_systolic || null,
                blood_pressure_diastolic: body.blood_pressure_diastolic || null,
                heart_rate_bpm: body.heart_rate_bpm || null,
                hearing: body.hearing || null,
                respiratory: body.respiratory || null,
                cardiovascular: body.cardiovascular || null,
                nervous_system: body.nervous_system || null,
                musculoskeletal: body.musculoskeletal || null,
                skin: body.skin || null,
                blood_test: body.blood_test || null,
                other_observations: body.other_observations || null,
                no_contraindication: body.no_contraindication || false,
                conclusion_date: body.conclusion_date || null,
                examiner_signature: body.examiner_signature || null,
                psycho_favorable: body.psycho_favorable || false,
                psycho_data: body.psycho_data || {}
            })
            .select()
            .single()

        if (createError) {
            console.error('Create error:', createError)
            return NextResponse.json({ error: createError.message }, { status: 500 })
        }

        // Audit log
        const { logAudit, getDisplayName } = await import('@/lib/audit')
        await logAudit({
            actorDiscordId: session.user.discord_id,
            actorName: getDisplayName(session.user),
            action: 'create',
            tableName: 'medical_exams',
            recordId: exam.id,
            newData: exam
        })

        return NextResponse.json(exam, { status: 201 })

    } catch (error) {
        console.error('Error creating medical exam:', error)
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}
