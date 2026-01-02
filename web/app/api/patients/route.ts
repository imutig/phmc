import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { requireEmployeeAccess } from "@/lib/auth-utils"
import { PatientCreateSchema, validateBody, validationErrorResponse } from "@/lib/validation"

// GET: Rechercher des patients
export async function GET(request: NextRequest) {
    try {
        const authResult = await requireEmployeeAccess()
        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }

        const supabase = await createClient()
        const searchParams = request.nextUrl.searchParams
        const search = searchParams.get('search')
        const limit = parseInt(searchParams.get('limit') || '20')

        let query = supabase
            .from('patients')
            .select('*')
            .order('last_name', { ascending: true })
            .limit(limit)

        if (search) {
            query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%,fingerprint.ilike.%${search}%`)
        }

        const { data: patients, error } = await query

        if (error) {
            console.error('Error fetching patients:', error)
            return NextResponse.json(
                { error: "Erreur lors de la recherche de patients." },
                { status: 500 }
            )
        }

        return NextResponse.json({ patients: patients || [] })

    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json(
            { error: "Une erreur inattendue s'est produite." },
            { status: 500 }
        )
    }
}

// POST: Créer un nouveau patient (Staff only)
export async function POST(request: NextRequest) {
    try {
        const authResult = await requireEmployeeAccess()
        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }

        const supabase = await createClient()
        const body = await request.json()

        // Validation avec Zod
        const validation = validateBody(PatientCreateSchema, body)
        if (!validation.success) {
            return validationErrorResponse(validation.error)
        }

        const validatedData = validation.data

        // Vérifier unicité empreinte
        const { data: existing } = await supabase
            .from('patients')
            .select('id')
            .eq('fingerprint', validatedData.fingerprint)
            .single()

        if (existing) {
            return NextResponse.json(
                { error: "Un patient avec cette empreinte existe déjà." },
                { status: 409 }
            )
        }

        // Création
        const { data: patient, error } = await supabase
            .from('patients')
            .insert({
                first_name: validatedData.firstName,
                last_name: validatedData.lastName,
                birth_date: validatedData.birthDate,
                fingerprint: validatedData.fingerprint,
                phone: validatedData.phone || null,
                created_by: authResult.session!.user.discord_id
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating patient:', error)
            return NextResponse.json(
                { error: "Erreur lors de la création du patient." },
                { status: 500 }
            )
        }

        return NextResponse.json({ patient })

    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json(
            { error: "Une erreur inattendue s'est produite." },
            { status: 500 }
        )
    }
}
