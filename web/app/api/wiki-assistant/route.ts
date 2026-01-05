import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

const SELECTION_PROMPT = `Tu es un assistant qui aide à trouver les articles pertinents dans un wiki médical.
On te donne une question et une liste d'articles (avec leur slug et titre).
Tu dois retourner UNIQUEMENT un JSON avec les slugs des 1 à 3 articles les plus pertinents pour répondre à la question.

Format de réponse (JSON uniquement, rien d'autre) :
{"slugs": ["slug1", "slug2"]}

Si aucun article n'est pertinent, retourne :
{"slugs": []}`

const ANSWER_PROMPT = `Tu es l'assistant virtuel du Pillbox Hill Medical Center (PHMC), un centre médical d'urgence.
Tu réponds aux questions des employés EMS en te basant UNIQUEMENT sur le contenu des articles wiki fournis.

Règles:
- Réponds TOUJOURS en français
- Sois concis et professionnel
- Si la réponse n'est pas dans les articles fournis, dis-le clairement
- Tu peux utiliser des emojis médicaux (🏥, 💉, 🚑) avec modération`

export async function POST(request: NextRequest) {
    try {
        // Vérifier l'authentification
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const { question } = await request.json()

        if (!question || typeof question !== "string") {
            return NextResponse.json({ error: "Question requise" }, { status: 400 })
        }

        const supabase = await createClient()
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" })

        // ÉTAPE 1 : Récupérer UNIQUEMENT la liste des titres (pas le contenu)
        const { data: articlesList } = await supabase
            .from("wiki_articles")
            .select("slug, title, category")
            .eq("is_published", true)

        if (!articlesList || articlesList.length === 0) {
            return NextResponse.json({
                answer: "Je n'ai pas accès au wiki actuellement. Veuillez réessayer plus tard."
            })
        }

        // Construire la liste légère (titres uniquement)
        const articlesListText = articlesList
            .map(a => `- ${a.slug}: "${a.title}" (${a.category})`)
            .join("\n")

        // ÉTAPE 2 : Demander à l'IA de sélectionner les articles pertinents
        const selectionResult = await model.generateContent({
            contents: [{
                role: "user",
                parts: [{
                    text: `${SELECTION_PROMPT}\n\nQuestion: ${question}\n\nArticles disponibles:\n${articlesListText}`
                }]
            }],
            generationConfig: {
                temperature: 0,
                maxOutputTokens: 200,
            }
        })

        const selectionRaw = selectionResult.response.text() || ""

        // Parser la sélection
        let selectedSlugs: string[] = []
        try {
            let cleanJson = selectionRaw.trim()
            if (cleanJson.startsWith('```')) {
                cleanJson = cleanJson.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
            }
            const parsed = JSON.parse(cleanJson)
            selectedSlugs = parsed.slugs || []
        } catch {
            console.error('[Wiki Assistant] Selection parse error:', selectionRaw)
            return NextResponse.json({
                answer: "Je n'ai pas pu identifier les articles pertinents. Pouvez-vous reformuler votre question ?"
            })
        }

        // Si aucun article sélectionné
        if (selectedSlugs.length === 0) {
            return NextResponse.json({
                answer: "Je n'ai pas trouvé d'article pertinent dans le wiki pour répondre à cette question. Essayez de reformuler ou consultez le wiki directement."
            })
        }

        // ÉTAPE 3 : Récupérer le contenu UNIQUEMENT des articles sélectionnés
        const { data: selectedArticles } = await supabase
            .from("wiki_articles")
            .select("title, content, category")
            .in("slug", selectedSlugs)

        if (!selectedArticles || selectedArticles.length === 0) {
            return NextResponse.json({
                answer: "Erreur lors de la récupération des articles. Veuillez réessayer."
            })
        }

        // Construire le contexte avec les articles sélectionnés
        // Nettoyer les images base64 et limiter la taille
        const MAX_CHARS_PER_ARTICLE = 15000 // ~4000 tokens par article max
        const wikiContext = selectedArticles
            .map(a => {
                // Supprimer les images base64 et les balises img
                let cleanContent = a.content
                    .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[IMAGE]')
                    .replace(/<img[^>]*>/gi, '[IMAGE]')

                // Tronquer si trop long
                if (cleanContent.length > MAX_CHARS_PER_ARTICLE) {
                    cleanContent = cleanContent.substring(0, MAX_CHARS_PER_ARTICLE) + '\n\n[... contenu tronqué ...]'
                }

                return `## ${a.title} (${a.category})\n${cleanContent}`
            })
            .join("\n\n---\n\n")

        // ÉTAPE 4 : Générer la réponse finale
        const answerResult = await model.generateContent({
            contents: [{
                role: "user",
                parts: [{
                    text: `${ANSWER_PROMPT}\n\n---\n\nVoici les articles pertinents du wiki:\n\n${wikiContext}\n\n---\n\nQuestion de l'employé: ${question}`
                }]
            }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1024,
            }
        })

        const answer = answerResult.response.text() || "Je n'ai pas pu générer de réponse."

        return NextResponse.json({ answer })

    } catch (error) {
        console.error("[Wiki Assistant] Error:", error)
        return NextResponse.json(
            { error: "Erreur lors de la génération de la réponse" },
            { status: 500 }
        )
    }
}
