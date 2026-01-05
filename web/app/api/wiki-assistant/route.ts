import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

const SYSTEM_PROMPT = `Tu es l'assistant virtuel du Pillbox Hill Medical Center (PHMC), un centre médical d'urgence.
Tu réponds aux questions des employés EMS en te basant UNIQUEMENT sur le contenu du wiki interne fourni.

Règles:
- Réponds TOUJOURS en français
- Sois concis et professionnel
- Si la réponse n'est pas dans le wiki, dis-le clairement
- Cite les articles pertinents quand c'est utile
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

        // Récupérer les articles du wiki pour le contexte
        const supabase = await createClient()
        const { data: articles } = await supabase
            .from("wiki_articles")
            .select("title, content, category")
            .is("deleted_at", null)
            .eq("is_published", true)

        if (!articles || articles.length === 0) {
            return NextResponse.json({
                answer: "Je n'ai pas accès au wiki actuellement. Veuillez réessayer plus tard."
            })
        }

        // Construire le contexte du wiki en nettoyant les images
        const wikiContext = articles
            .map(a => {
                // Supprimer les images base64 et les balises img
                const cleanContent = a.content
                    .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[IMAGE]')
                    .replace(/<img[^>]*>/gi, '[IMAGE]')
                    .replace(/!\[[^\]]*\]\([^)]+\)/g, '[IMAGE]') // Markdown images

                return `## ${a.title} (${a.category})\n${cleanContent}`
            })
            .join("\n\n---\n\n")

        // Appeler Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" })

        const result = await model.generateContent({
            contents: [{
                role: "user",
                parts: [{
                    text: `${SYSTEM_PROMPT}\n\n---\n\nVoici le contenu du wiki interne:\n\n${wikiContext}\n\n---\n\nQuestion de l'employé: ${question}`
                }]
            }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1024,
            }
        })

        const answer = result.response.text() || "Je n'ai pas pu générer de réponse."

        return NextResponse.json({ answer })

    } catch (error) {
        console.error("[Wiki Assistant] Error:", error)
        return NextResponse.json(
            { error: "Erreur lors de la génération de la réponse" },
            { status: 500 }
        )
    }
}
