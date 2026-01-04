import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const dynamic = 'force-dynamic'

// GET - Récupérer les USI d'un patient
export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const url = new URL(request.url)
        const patientId = url.searchParams.get('patientId')

        if (!patientId) {
            return NextResponse.json({ error: "patientId requis" }, { status: 400 })
        }

        const supabase = await createClient()

        const { data: usiList, error } = await supabase
            .from('patient_usi')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ usiList: usiList || [] })
    } catch (error) {
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}

// POST - Créer un nouvel USI
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const { patientId, title, htmlContent } = await request.json()

        if (!patientId || !htmlContent) {
            return NextResponse.json({ error: "patientId et htmlContent requis" }, { status: 400 })
        }

        const supabase = await createClient()

        const { data, error } = await supabase
            .from('patient_usi')
            .insert({
                patient_id: patientId,
                title: title || `USI du ${new Date().toLocaleDateString('fr-FR')}`,
                html_content: htmlContent,
                created_by: session.user.discord_id,
                created_by_name: session.user.displayName || session.user.name || 'Inconnu'
            })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ usi: data }, { status: 201 })
    } catch (error) {
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}

// PUT - Mettre à jour un USI
export async function PUT(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const { id, title, htmlContent } = await request.json()

        if (!id || !htmlContent) {
            return NextResponse.json({ error: "id et htmlContent requis" }, { status: 400 })
        }

        const supabase = await createClient()

        const { data, error } = await supabase
            .from('patient_usi')
            .update({
                title,
                html_content: htmlContent,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ usi: data })
    } catch (error) {
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}

// DELETE - Supprimer un USI
export async function DELETE(request: Request) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const url = new URL(request.url)
        const id = url.searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: "id requis" }, { status: 400 })
        }

        const supabase = await createClient()

        const { error } = await supabase
            .from('patient_usi')
            .delete()
            .eq('id', id)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}
