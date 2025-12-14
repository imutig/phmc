import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.discord_id) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const searchParams = request.nextUrl.searchParams
        const query = searchParams.get('q')?.trim()

        if (!query || query.length < 2) {
            return NextResponse.json({ results: [] })
        }

        const supabase = await createClient()
        const results: Array<{
            id: string
            type: 'wiki' | 'medication' | 'care'
            title: string
            subtitle?: string
            url: string
        }> = []

        // Recherche dans le Wiki
        const { data: wikiResults } = await supabase
            .from('wiki_articles')
            .select('id, title, category, slug')
            .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
            .eq('is_published', true)
            .limit(5)

        if (wikiResults) {
            for (const article of wikiResults) {
                results.push({
                    id: `wiki-${article.id}`,
                    type: 'wiki',
                    title: article.title,
                    subtitle: article.category,
                    url: `/intranet/wiki?article=${article.slug}`
                })
            }
        }

        // Recherche dans les médicaments
        const { data: medResults } = await supabase
            .from('medications')
            .select('id, name, dosage')
            .or(`name.ilike.%${query}%,effects.ilike.%${query}%`)
            .limit(5)

        if (medResults) {
            for (const med of medResults) {
                results.push({
                    id: `med-${med.id}`,
                    type: 'medication',
                    title: med.name,
                    subtitle: med.dosage || undefined,
                    url: `/intranet/medicaments?search=${encodeURIComponent(med.name)}`
                })
            }
        }

        // Recherche dans les soins (tarifs)
        const { data: careResults } = await supabase
            .from('care_types')
            .select('id, name, price, care_categories(name)')
            .ilike('name', `%${query}%`)
            .limit(5)

        if (careResults) {
            for (const care of careResults) {
                results.push({
                    id: `care-${care.id}`,
                    type: 'care',
                    title: care.name,
                    subtitle: `${care.price}$ - ${(care.care_categories as any)?.name || 'Soin'}`,
                    url: `/intranet/tarifs?search=${encodeURIComponent(care.name)}`
                })
            }
        }

        return NextResponse.json({ results })

    } catch (error) {
        console.error('Search error:', error)
        return NextResponse.json({ error: "Erreur de recherche" }, { status: 500 })
    }
}
