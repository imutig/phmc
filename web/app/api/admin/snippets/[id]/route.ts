import { createClient } from "@/lib/supabase/server"
import { requireAdminAccess } from "@/lib/auth-utils"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const snippetUpdateSchema = z.object({
    name: z.string().min(1).max(50).optional(),
    content: z.string().min(1).max(2000).optional()
})

// PATCH - Modifier un snippet
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAdminAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    try {
        const { id } = await params
        const supabase = await createClient()
        const body = await request.json()

        const parsed = snippetUpdateSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: "Données invalides." }, { status: 400 })
        }

        const updates: Record<string, unknown> = {}
        if (parsed.data.name) updates.name = parsed.data.name.toLowerCase()
        if (parsed.data.content) updates.content = parsed.data.content
        updates.updated_at = new Date().toISOString()

        const { data: snippet, error } = await supabase
            .from('snippets')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            console.error('Error updating snippet:', error)
            return NextResponse.json({ error: "Erreur lors de la modification." }, { status: 500 })
        }

        return NextResponse.json({ success: true, snippet })

    } catch (error) {
        console.error('Snippets API error:', error)
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 })
    }
}

// DELETE - Supprimer un snippet
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAdminAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    try {
        const { id } = await params
        const supabase = await createClient()

        const { error } = await supabase
            .from('snippets')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Error deleting snippet:', error)
            return NextResponse.json({ error: "Erreur lors de la suppression." }, { status: 500 })
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Snippets API error:', error)
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 })
    }
}
