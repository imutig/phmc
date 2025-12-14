import { createClient } from "@/lib/supabase/server"
import { requireAdminAccess } from "@/lib/auth-utils"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const snippetSchema = z.object({
    name: z.string().min(1).max(50),
    content: z.string().min(1).max(2000)
})

// GET - Liste tous les snippets
export async function GET() {
    const authResult = await requireAdminAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    try {
        const supabase = await createClient()

        const { data: snippets, error } = await supabase
            .from('snippets')
            .select('*')
            .order('name', { ascending: true })

        if (error) {
            console.error('Error fetching snippets:', error)
            return NextResponse.json({ error: "Erreur serveur." }, { status: 500 })
        }

        return NextResponse.json({ snippets: snippets || [] })

    } catch (error) {
        console.error('Snippets API error:', error)
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 })
    }
}

// POST - Créer un nouveau snippet
export async function POST(request: NextRequest) {
    const authResult = await requireAdminAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    try {
        const supabase = await createClient()
        const body = await request.json()

        const parsed = snippetSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: "Données invalides." }, { status: 400 })
        }

        const { name, content } = parsed.data

        // Vérifier que le nom est unique
        const { data: existing } = await supabase
            .from('snippets')
            .select('id')
            .eq('name', name.toLowerCase())
            .single()

        if (existing) {
            return NextResponse.json({ error: "Un snippet avec ce nom existe déjà." }, { status: 400 })
        }

        const { data: snippet, error } = await supabase
            .from('snippets')
            .insert({
                name: name.toLowerCase(),
                content,
                created_by: authResult.session?.user?.discord_id
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating snippet:', error)
            return NextResponse.json({ error: "Erreur lors de la création." }, { status: 500 })
        }

        return NextResponse.json({ success: true, snippet })

    } catch (error) {
        console.error('Snippets API error:', error)
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 })
    }
}
