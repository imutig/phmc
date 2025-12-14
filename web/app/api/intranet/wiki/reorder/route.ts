import { createClient } from "@/lib/supabase/server"
import { requireEditorAccess } from "@/lib/auth-utils"
import { NextRequest, NextResponse } from "next/server"

// PATCH - Réordonner les articles d'une catégorie
export async function PATCH(request: NextRequest) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { articles } = body  // Array de { id: string, sort_order: number }

    if (!articles || !Array.isArray(articles)) {
        return NextResponse.json({ error: "articles array requis" }, { status: 400 })
    }

    const supabase = await createClient()

    // Mettre à jour chaque article avec son nouveau sort_order
    const updates = articles.map(({ id, sort_order }: { id: string; sort_order: number }) =>
        supabase
            .from('wiki_articles')
            .update({ sort_order })
            .eq('id', id)
    )

    const results = await Promise.all(updates)
    const errors = results.filter(r => r.error)

    if (errors.length > 0) {
        console.error('Reorder errors:', errors)
        return NextResponse.json({ error: "Erreur lors de la réorganisation" }, { status: 500 })
    }

    return NextResponse.json({ success: true, updated: articles.length })
}
