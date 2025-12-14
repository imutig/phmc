import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess, requireEditorAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"
import { validateBody, WikiArticleSchema, WikiArticleUpdateSchema } from "@/lib/validations"

interface WikiArticle {
    id: string
    title: string
    slug: string
    content: string
    category: string
    sort_order: number
    is_published: boolean
    created_at: string
    updated_at: string
}

// GET - Récupérer tous les articles ou un article par slug
export async function GET(request: Request) {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    const category = searchParams.get('category')

    const supabase = await createClient()

    if (slug) {
        // Récupérer un article spécifique
        const { data, error } = await supabase
            .from('wiki_articles')
            .select('*')
            .eq('slug', slug)
            .single()

        if (error) {
            return NextResponse.json({ error: "Article non trouvé" }, { status: 404 })
        }
        return NextResponse.json(data)
    }

    // Récupérer tous les articles
    let query = supabase
        .from('wiki_articles')
        .select('*')
        .eq('is_published', true)
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true })

    if (category) {
        query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Grouper par catégorie
    const grouped: Record<string, WikiArticle[]> = {}
    for (const article of data || []) {
        if (!grouped[article.category]) {
            grouped[article.category] = []
        }
        grouped[article.category].push(article)
    }

    return NextResponse.json({ articles: data || [], grouped })
}

// POST - Créer un nouvel article (direction uniquement)
export async function POST(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const validation = validateBody(WikiArticleSchema, body)
    if (!validation.success) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('wiki_articles')
        .insert({
            ...validation.data,
            created_by: authResult.session?.user?.discord_id,
            updated_by: authResult.session?.user?.discord_id
        })
        .select()
        .single()

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: "Un article avec ce slug existe déjà" }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
}

// PUT - Mettre à jour un article (direction uniquement)
export async function PUT(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: "ID requis" }, { status: 400 })
    }

    const body = await request.json()
    const validation = validateBody(WikiArticleUpdateSchema, body)
    if (!validation.success) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('wiki_articles')
        .update({
            ...validation.data,
            updated_by: authResult.session?.user?.discord_id,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

// DELETE - Supprimer un article (direction uniquement)
export async function DELETE(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: "ID requis" }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase
        .from('wiki_articles')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
