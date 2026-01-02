import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess } from "@/lib/auth-utils"

// GET /api/medical-exams/[id] - Détails d'un examen
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const { authorized } = await requireEmployeeAccess()
        if (!authorized) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
        }

        const supabase = await createClient()

        const { data: exam, error } = await supabase
            .from('medical_exams')
            .select('*, patients(*)')
            .eq('id', id)
            .single()

        if (error || !exam) {
            return NextResponse.json({ error: "Examen introuvable" }, { status: 404 })
        }

        return NextResponse.json(exam)

    } catch (error) {
        console.error('Error fetching medical exam:', error)
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}

// PATCH /api/medical-exams/[id] - Mettre à jour un examen
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const { authorized } = await requireEmployeeAccess()
        if (!authorized) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
        }

        const body = await request.json()
        const supabase = await createClient()

        // Mettre à jour l'examen
        const { data: exam, error } = await supabase
            .from('medical_exams')
            .update(body)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(exam)

    } catch (error) {
        console.error('Error updating medical exam:', error)
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}

// DELETE /api/medical-exams/[id] - Supprimer un brouillon
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const { authorized } = await requireEmployeeAccess()
        if (!authorized) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
        }

        const supabase = await createClient()

        // Vérifier que c'est un brouillon
        const { data: exam, error: fetchError } = await supabase
            .from('medical_exams')
            .select('status')
            .eq('id', id)
            .single()

        if (fetchError || !exam) {
            return NextResponse.json({ error: "Examen introuvable" }, { status: 404 })
        }

        if (exam.status !== 'draft') {
            return NextResponse.json({ error: "Impossible de supprimer un examen finalisé" }, { status: 400 })
        }

        const { error: deleteError } = await supabase
            .from('medical_exams')
            .delete()
            .eq('id', id)

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Error deleting medical exam:', error)
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}
