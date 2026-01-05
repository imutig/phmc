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
            // Recherche plus permissive : on cherche chaque mot dans first_name OU last_name
            // Permet de chercher "John Smith" et trouver un patient avec first_name="John" et last_name="Smith"
            const searchTerms = search.trim().split(/\s+/).filter(t => t.length > 0)

            if (searchTerms.length === 1) {
                // Recherche simple : un seul terme
                query = query.or(`first_name.ilike.%${searchTerms[0]}%,last_name.ilike.%${searchTerms[0]}%,phone.ilike.%${searchTerms[0]}%,fingerprint.ilike.%${searchTerms[0]}%`)
            } else {
                // Recherche multi-termes : chaque terme doit matcher dans first_name OU last_name
                // On utilise une combinaison de filtres
                const term1 = searchTerms[0]
                const term2 = searchTerms.slice(1).join(' ')
                query = query.or(
                    `and(first_name.ilike.%${term1}%,last_name.ilike.%${term2}%),` +
                    `and(first_name.ilike.%${term2}%,last_name.ilike.%${term1}%)` // Ordre inversé aussi
                )
            }
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

        // Vérifier unicité empreinte (seulement si fournie)
        if (validatedData.fingerprint) {
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
        }

        // Création
        const { data: patient, error } = await supabase
            .from('patients')
            .insert({
                first_name: validatedData.firstName,
                last_name: validatedData.lastName,
                birth_date: validatedData.birthDate || null,
                fingerprint: validatedData.fingerprint || null,
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

        // Audit log
        const { logAudit, getDisplayName } = await import('@/lib/audit')
        await logAudit({
            actorDiscordId: authResult.session!.user.discord_id,
            actorName: getDisplayName(authResult.session!.user),
            action: 'create',
            tableName: 'patients',
            recordId: patient.id,
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
