import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"
import { auth } from "@/lib/auth"

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
})

// Prompt pour la VALIDATION des notes (étape 1)
const VALIDATION_PROMPT = `Tu es un assistant qui vérifie si des notes médicales sont complètes.

Tu dois vérifier si les notes contiennent ces 3 informations OBLIGATOIRES :
1. MOTIF : Pourquoi le patient est là (accident, blessure, symptômes, etc.)
2. TRAITEMENTS : Au moins un geste médical effectué
3. ÉTAT DE SORTIE : Comment va le patient en partant (stable, hospitalisé, sortant, décédé, etc.)

RÉPONDS UNIQUEMENT avec ce format JSON (rien d'autre, pas de texte avant ou après) :
{
  "complete": true ou false,
  "missing": ["liste des éléments manquants"],
  "questions": ["questions à poser pour chaque élément manquant"]
}

Exemples :
- Notes: "Accident vélo, fracture radius, plâtre posé" → {"complete": false, "missing": ["état de sortie"], "questions": ["Dans quel état le patient est-il sorti ?"]}
- Notes: "Chute, sutures, patient stable" → {"complete": true, "missing": [], "questions": []}
- Notes: "Douleur thoracique" → {"complete": false, "missing": ["traitements", "état de sortie"], "questions": ["Quels soins avez-vous prodigués ?", "Dans quel état le patient est-il sorti ?"]}`

// Prompt pour la GÉNÉRATION du rapport (étape 2)
const GENERATION_PROMPT = `Tu es un assistant médical du Pillbox Hill Medical Center.
Génère un rapport USI (Unité de Soins Intensifs) professionnel en HTML.

FORMAT EXACT À UTILISER :
<p><strong><u>Patient</u></strong> : [Nom]</p>
<p><strong><u>Date</u></strong> : [Date]</p>
<p><strong><u>[Grade]</u></strong> : [Soignant]</p>
<hr>
<p><strong><u>Motif de consultation</u></strong> :</p>
<p>[Motif d'après les notes]</p>
<hr>
<p><strong><u>Traitement et gestes réalisés</u></strong></p>
<ul>
<li>[Geste 1]</li>
<li>[Geste 2]</li>
</ul>
<hr>
<p><strong><u>Recommandations</u></strong> :</p>
<p>[Si mentionné dans les notes, sinon omets cette section]</p>
<hr>
<p><strong><u>État à la sortie</u></strong> :</p>
<p>[État mentionné dans les notes]</p>

Génère uniquement le HTML, rien d'autre.`

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const { patientName, date, staffName, staffGrade, notes } = await request.json()

        if (!notes || typeof notes !== "string") {
            return NextResponse.json({ error: "Notes requises" }, { status: 400 })
        }

        // ÉTAPE 1 : Valider que les notes sont complètes
        const validationResponse = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: VALIDATION_PROMPT },
                { role: "user", content: `Notes à valider:\n${notes}` }
            ],
            temperature: 0,
            max_tokens: 500,
        })

        const validationRaw = validationResponse.choices[0]?.message?.content || ""

        // Parser la réponse de validation
        let validation: { complete: boolean; missing: string[]; questions: string[] }
        try {
            // Nettoyer la réponse (enlever les backticks markdown si présents)
            let cleanJson = validationRaw.trim()
            if (cleanJson.startsWith('```')) {
                cleanJson = cleanJson.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
            }
            validation = JSON.parse(cleanJson)
        } catch {
            console.error('[Generate USI] Validation parse error:', validationRaw)
            // En cas d'erreur de parsing, on considère que c'est incomplet par sécurité
            return NextResponse.json({
                needsClarification: true,
                questions: ["Veuillez préciser le motif de consultation, les soins effectués et l'état du patient à la sortie."]
            })
        }

        // Si les notes sont incomplètes, retourner les questions
        if (!validation.complete) {
            return NextResponse.json({
                needsClarification: true,
                questions: validation.questions || ["Veuillez compléter les informations manquantes."]
            })
        }

        // ÉTAPE 2 : Générer le rapport (seulement si les notes sont complètes)
        const generationResponse = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: GENERATION_PROMPT },
                {
                    role: "user",
                    content: `Informations:
- Patient: ${patientName || "Non spécifié"}
- Date: ${date || "Non spécifiée"}
- Soignant: ${staffName || "Non spécifié"} (${staffGrade || "Médecin"})

Notes du médecin:
${notes}

Génère le rapport USI en HTML.`
                }
            ],
            temperature: 0.3,
            max_tokens: 2048,
        })

        const htmlContent = generationResponse.choices[0]?.message?.content || ""

        return NextResponse.json({ html: htmlContent })

    } catch (error) {
        console.error("[Generate USI] Error:", error)
        return NextResponse.json(
            { error: "Erreur lors de la génération du rapport" },
            { status: 500 }
        )
    }
}
