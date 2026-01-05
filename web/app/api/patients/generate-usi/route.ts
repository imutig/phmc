import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { auth } from "@/lib/auth"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

// Prompt pour la VALIDATION des notes (étape 1)
const VALIDATION_PROMPT = `Tu es un assistant qui vérifie si des notes médicales sont complètes.

Tu dois vérifier si les notes contiennent ces 4 informations OBLIGATOIRES :
1. MOTIF : Pourquoi le patient est là (accident, blessure, symptômes, etc.)
2. TRAITEMENTS : Au moins un geste médical effectué
3. RECOMMANDATIONS : Conseils donnés au patient (repos, médicaments, suivi, etc.)
4. ÉTAT DE SORTIE : Comment va le patient en partant (stable, hospitalisé, sortant, décédé, etc.)

RÉPONDS UNIQUEMENT avec ce format JSON (rien d'autre, pas de texte avant ou après) :
{
  "complete": true ou false,
  "missing": ["liste des éléments manquants"],
  "questions": ["questions à poser pour chaque élément manquant"]
}

Exemples :
- Notes: "Accident vélo, fracture radius, plâtre posé" → {"complete": false, "missing": ["recommandations", "état de sortie"], "questions": ["Quelles recommandations avez-vous données au patient ?", "Dans quel état le patient est-il sorti ?"]}
- Notes: "Chute, sutures, repos 3 jours, patient stable" → {"complete": true, "missing": [], "questions": []}
- Notes: "Douleur thoracique" → {"complete": false, "missing": ["traitements", "recommandations", "état de sortie"], "questions": ["Quels soins avez-vous prodigués ?", "Quelles recommandations avez-vous données ?", "Dans quel état le patient est-il sorti ?"]}`

// Prompt pour la GÉNÉRATION du rapport (étape 2)
const GENERATION_PROMPT = `Tu es un médecin urgentiste expérimenté du Pillbox Hill Medical Center.
À partir des notes brèves du soignant, rédige un rapport USI (Unité de Soins Intensifs) PROFESSIONNEL et DÉTAILLÉ.

TON RÔLE :
- REFORMULE les notes en langage médical professionnel
- DÉVELOPPE les éléments pour qu'ils soient complets et précis
- AJOUTE des détails médicaux réalistes et cohérents (ex: "sutures" → "sutures au fil résorbable", "nettoyage" → "nettoyage et désinfection à la Bétadine")
- Rends le rapport digne d'un vrai document médical hospitalier

FORMAT HTML EXACT :
<p><strong><u>Patient</u></strong> : [Nom]</p>
<p><strong><u>Date</u></strong> : [Date]</p>
<p><strong><u>[Grade]</u></strong> : [Soignant]</p>
<hr>
<p><strong><u>Motif de consultation</u></strong> :</p>
<p>[Reformule le motif de façon professionnelle avec contexte]</p>
<hr>
<p><strong><u>Traitement et gestes réalisés</u></strong></p>
<ul>
<li>[Geste détaillé et professionnel]</li>
<li>[Autre geste avec précisions techniques]</li>
</ul>
<hr>
<p><strong><u>Recommandations</u></strong> :</p>
<p>[Recommandations détaillées et professionnelles]</p>
<hr>
<p><strong><u>État à la sortie</u></strong> :</p>
<p>[État du patient reformulé avec précisions médicales]</p>

IMPORTANT : Génère UNIQUEMENT le HTML, sans backticks ni commentaires.`

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

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" })

        // ÉTAPE 1 : Valider que les notes sont complètes
        const validationResult = await model.generateContent({
            contents: [{
                role: "user",
                parts: [{
                    text: `${VALIDATION_PROMPT}\n\nNotes à valider:\n${notes}`
                }]
            }],
            generationConfig: {
                temperature: 0,
                maxOutputTokens: 500,
            }
        })

        const validationRaw = validationResult.response.text() || ""

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
        const generationResult = await model.generateContent({
            contents: [{
                role: "user",
                parts: [{
                    text: `${GENERATION_PROMPT}\n\nInformations:
- Patient: ${patientName || "Non spécifié"}
- Date: ${date || "Non spécifiée"}
- Soignant: ${staffName || "Non spécifié"} (${staffGrade || "Médecin"})

Notes du médecin:
${notes}

Génère le rapport USI en HTML.`
                }]
            }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2048,
            }
        })

        let htmlContent = generationResult.response.text() || ""

        // Nettoyer les backticks markdown si présents
        if (htmlContent.startsWith('```')) {
            htmlContent = htmlContent.replace(/```html?\n?/gi, '').replace(/```/g, '').trim()
        }

        return NextResponse.json({ html: htmlContent })

    } catch (error) {
        console.error("[Generate USI] Error:", error)
        return NextResponse.json(
            { error: "Erreur lors de la génération du rapport" },
            { status: 500 }
        )
    }
}
