import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// POST - Créer une ordonnance et uploader l'image
export async function POST(request: Request) {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const session = await auth()
    if (!session?.user?.discord_id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    try {
        const formData = await request.formData()
        const imageFile = formData.get('image') as File
        const patientName = formData.get('patient_name') as string
        const patientInfo = formData.get('patient_info') as string
        const medications = formData.get('medications') as string
        const notes = formData.get('notes') as string

        if (!imageFile) {
            return NextResponse.json({ error: "Image requise" }, { status: 400 })
        }

        const supabase = await createClient()

        // Générer un nom de fichier unique
        const timestamp = Date.now()
        const fileName = `ordonnance_${session.user.discord_id}_${timestamp}.png`

        // Convertir le File en ArrayBuffer puis en Buffer
        const arrayBuffer = await imageFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Upload vers Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('prescriptions')
            .upload(fileName, buffer, {
                contentType: 'image/png',
                upsert: false
            })

        if (uploadError) {
            console.error('Upload error:', uploadError)
            return NextResponse.json({ error: "Erreur upload: " + uploadError.message }, { status: 500 })
        }

        // Obtenir l'URL publique
        const { data: urlData } = supabase.storage
            .from('prescriptions')
            .getPublicUrl(fileName)

        const imageUrl = urlData.publicUrl

        // Sauvegarder dans la base de données
        const { data, error } = await supabase
            .from('prescriptions')
            .insert({
                patient_name: patientName || null,
                patient_info: patientInfo || null,
                medications: JSON.parse(medications || '[]'),
                notes: notes || null,
                image_url: imageUrl,
                created_by_discord_id: session.user.discord_id,
                created_by_name: session.user.name || 'Inconnu'
            })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            prescription: data,
            image_url: imageUrl
        }, { status: 201 })

    } catch (error: any) {
        console.error('Prescription error:', error)
        return NextResponse.json({ error: error.message || "Erreur serveur" }, { status: 500 })
    }
}

// GET - Récupérer les ordonnances de l'utilisateur
export async function GET(request: Request) {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const session = await auth()
    if (!session?.user?.discord_id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('created_by_discord_id', session.user.discord_id)
        .order('created_at', { ascending: false })
        .limit(20)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
}
