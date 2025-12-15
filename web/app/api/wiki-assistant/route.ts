import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
})

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
            .eq("is_published", true)
            .limit(20)

        if (!articles || articles.length === 0) {
            return NextResponse.json({
                answer: "Je n'ai pas accès au wiki actuellement. Veuillez réessayer plus tard."
            })
        }

        // Construire le contexte du wiki
        const wikiContext = articles
            .map(a => `## ${a.title} (${a.category})\n${a.content}`)
            .join("\n\n---\n\n")

        // Appeler Groq
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                    role: "user",
                    content: `Voici le contenu du wiki interne:\n\n${wikiContext}\n\n---\n\nQuestion de l'employé: ${question}`
                }
            ],
            temperature: 0.3,
            max_tokens: 1024,
        })

        const answer = completion.choices[0]?.message?.content || "Je n'ai pas pu générer de réponse."

        return NextResponse.json({ answer })

    } catch (error) {
        console.error("[Wiki Assistant] Error:", error)
        return NextResponse.json(
            { error: "Erreur lors de la génération de la réponse" },
            { status: 500 }
        )
    }
}
