import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

// Fonction pour uploader vers ImgBB
async function uploadToImgBB(file: File): Promise<{ url: string; delete_url: string } | null> {
    const apiKey = process.env.IMGBB_API_KEY
    if (!apiKey) {
        console.error('[ImgBB] IMGBB_API_KEY non configurée dans .env.local')
        return null
    }

    try {
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const base64 = buffer.toString('base64')

        const formData = new FormData()
        formData.append('key', apiKey)
        formData.append('image', base64)
        formData.append('name', `doc_${Date.now()}`)

        console.log('[ImgBB] Uploading file:', file.name, 'Size:', file.size)

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData,
        })

        // Vérifier si la réponse est du JSON
        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text()
            console.error('[ImgBB] Réponse non-JSON:', text.substring(0, 200))
            console.error('[ImgBB] Status:', response.status, 'Content-Type:', contentType)
            return null
        }

        const result = await response.json()

        if (!result.success) {
            console.error('[ImgBB] Upload failed:', result.error || result)
            return null
        }

        console.log('[ImgBB] Upload success:', result.data.url)
        return {
            url: result.data.url,
            delete_url: result.data.delete_url
        }
    } catch (error) {
        console.error('[ImgBB] Exception:', error)
        return null
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.discord_id) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401 }
            )
        }

        const supabase = await createClient()
        const formData = await request.formData()

        const file = formData.get('file') as File
        const applicationId = formData.get('applicationId') as string
        const documentType = formData.get('type') as string // 'id_card', 'driving_license', 'weapon_permit'

        if (!file || !applicationId || !documentType) {
            return NextResponse.json(
                { error: "Fichier, ID candidature et type de document requis." },
                { status: 400 }
            )
        }

        // Vérifier que le fichier est une image ou un PDF
        const isImage = file.type.startsWith('image/')
        const isPdf = file.type === 'application/pdf'

        if (!isImage && !isPdf) {
            return NextResponse.json(
                { error: "Seules les images et les fichiers PDF sont acceptés." },
                { status: 400 }
            )
        }

        // Vérifier la taille (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json(
                { error: "Le fichier est trop volumineux (max 10MB)." },
                { status: 400 }
            )
        }

        // Vérifier que l'utilisateur peut modifier cette candidature
        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('discord_id', session.user.discord_id)
            .single()

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur non trouvé." },
                { status: 404 }
            )
        }

        const { data: application } = await supabase
            .from('applications')
            .select('id, user_id')
            .eq('id', applicationId)
            .eq('user_id', user.id)
            .single()

        if (!application) {
            return NextResponse.json(
                { error: "Candidature non trouvée ou non autorisée." },
                { status: 404 }
            )
        }

        let fileUrl: string | null = null

        if (isPdf) {
            // Upload PDF vers Supabase Storage
            const bytes = await file.arrayBuffer()
            const buffer = Buffer.from(bytes)
            const fileName = `${applicationId}/${documentType}_${Date.now()}.pdf`

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('documents')
                .upload(fileName, buffer, {
                    contentType: 'application/pdf',
                    upsert: true
                })

            if (uploadError) {
                console.error('[Supabase Storage] Upload error:', uploadError)
                return NextResponse.json(
                    { error: "Erreur lors de l'upload du PDF." },
                    { status: 500 }
                )
            }

            // Obtenir l'URL publique
            const { data: publicUrl } = supabase.storage
                .from('documents')
                .getPublicUrl(fileName)

            fileUrl = publicUrl.publicUrl
            console.log('[Supabase Storage] Upload success:', fileUrl)
        } else {
            // Upload image vers ImgBB
            const imgbbResult = await uploadToImgBB(file)

            if (!imgbbResult) {
                return NextResponse.json(
                    { error: "Erreur lors de l'upload de l'image." },
                    { status: 500 }
                )
            }
            fileUrl = imgbbResult.url
        }

        if (!fileUrl) {
            return NextResponse.json(
                { error: "Erreur lors de l'upload du fichier." },
                { status: 500 }
            )
        }

        // Supprimer l'ancien document du même type s'il existe
        await supabase
            .from('application_documents')
            .delete()
            .eq('application_id', applicationId)
            .eq('type', documentType)

        // Enregistrer le document dans la base
        const { data: document, error: docError } = await supabase
            .from('application_documents')
            .insert({
                application_id: applicationId,
                type: documentType,
                file_url: fileUrl,
                file_name: file.name
            })
            .select('id')
            .single()

        if (docError) {
            console.error('Document record error:', docError)
            return NextResponse.json(
                { error: "Erreur lors de l'enregistrement du document." },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            documentId: document.id,
            url: fileUrl
        })

    } catch (error) {
        console.error('Upload error:', error)
        return NextResponse.json(
            { error: "Une erreur inattendue s'est produite." },
            { status: 500 }
        )
    }
}

// GET: Récupérer les documents d'une candidature
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.discord_id) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401 }
            )
        }

        const { searchParams } = new URL(request.url)
        const applicationId = searchParams.get('applicationId')

        if (!applicationId) {
            return NextResponse.json(
                { error: "ID candidature requis." },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        // Vérifier les droits
        const { data: user } = await supabase
            .from('users')
            .select('id, is_recruiter, is_admin')
            .eq('discord_id', session.user.discord_id)
            .single()

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur non trouvé." },
                { status: 404 }
            )
        }

        // Vérifier l'accès à la candidature
        const { data: application } = await supabase
            .from('applications')
            .select('id, user_id')
            .eq('id', applicationId)
            .single()

        if (!application) {
            return NextResponse.json(
                { error: "Candidature non trouvée." },
                { status: 404 }
            )
        }

        // Seul le propriétaire, un recruteur ou un admin peut voir les documents
        if (application.user_id !== user.id && !user.is_recruiter && !user.is_admin) {
            return NextResponse.json(
                { error: "Accès non autorisé." },
                { status: 403 }
            )
        }

        // Récupérer les documents
        const { data: documents, error } = await supabase
            .from('application_documents')
            .select('*')
            .eq('application_id', applicationId)

        if (error) {
            console.error('Error fetching documents:', error)
            return NextResponse.json(
                { error: "Erreur lors de la récupération des documents." },
                { status: 500 }
            )
        }

        return NextResponse.json({ documents })

    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json(
            { error: "Une erreur inattendue s'est produite." },
            { status: 500 }
        )
    }
}
