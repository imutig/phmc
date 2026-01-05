import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess, requireEditorAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"
import { validateBody, GradeSchema } from "@/lib/validations"

// Salaires par grade (backup si table grades non dispo)
const GRADE_SALARIES: Record<string, { salary: number; max: number; displayName: string }> = {
    direction: { salary: 1100, max: 150000, displayName: 'Direction' },
    chirurgien: { salary: 1000, max: 120000, displayName: 'Chirurgien' },
    medecin: { salary: 900, max: 100000, displayName: 'Médecin' },
    infirmier: { salary: 700, max: 85000, displayName: 'Infirmier' },
    ambulancier: { salary: 625, max: 80000, displayName: 'Ambulancier' }
}

// GET - Récupérer tous les grades
export async function GET() {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const supabase = await createClient()

    // Essayer de récupérer depuis la table grades
    const { data: grades, error } = await supabase
        .from('grades')
        .select('*')
        .order('sort_order', { ascending: true })

    if (error || !grades || grades.length === 0) {
        // Fallback sur les données statiques
        const staticGrades = Object.entries(GRADE_SALARIES).map(([name, info], index) => ({
            name,
            display_name: info.displayName,
            salary_per_15min: info.salary,
            max_weekly_salary: info.max,
            sort_order: index + 1
        }))
        return NextResponse.json(staticGrades)
    }

    return NextResponse.json(grades)
}

// POST - Créer/modifier un grade (direction uniquement)
export async function POST(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()

    // Validation Zod
    const validation = validateBody(GradeSchema, body)
    if (!validation.success) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { name, display_name, salary_per_15min, max_weekly_salary, sort_order } = validation.data

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('grades')
        .upsert({
            name,
            display_name: display_name || name,
            salary_per_15min,
            max_weekly_salary: max_weekly_salary || 100000,
            sort_order: sort_order || 0
        }, { onConflict: 'name' })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
}
