import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
    try {
        // Vérifier l'authentification
        const session = await auth()
        if (!session?.user?.discord_id) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401 }
            )
        }

        const formData = await request.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return NextResponse.json(
                { error: "Aucun fichier fourni." },
                { status: 400 }
            )
        }

        // Vérifier le type de fichier
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: "Type de fichier non autorisé. Utilisez JPG, PNG, GIF ou WebP." },
                { status: 400 }
            )
        }

        // Vérifier la taille (max 32 MB pour ImgBB)
        const maxSize = 32 * 1024 * 1024 // 32 MB
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: "Fichier trop volumineux (max 32 MB)." },
                { status: 400 }
            )
        }

        // Convertir le fichier en base64
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const base64 = buffer.toString('base64')

        // Clé API ImgBB
        const apiKey = process.env.IMGBB_API_KEY
        if (!apiKey) {
            console.error('IMGBB_API_KEY non configurée')
            return NextResponse.json(
                { error: "Service d'upload non configuré." },
                { status: 500 }
            )
        }

        // Upload vers ImgBB
        const imgbbFormData = new FormData()
        imgbbFormData.append('key', apiKey)
        imgbbFormData.append('image', base64)
        imgbbFormData.append('name', `doc_${Date.now()}`)

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: imgbbFormData,
        })

        const result = await response.json()

        if (!result.success) {
            console.error('ImgBB error:', result)
            return NextResponse.json(
                { error: "Erreur lors de l'upload de l'image." },
                { status: 500 }
            )
        }

        // Retourner l'URL de l'image
        return NextResponse.json({
            success: true,
            url: result.data.url,
            delete_url: result.data.delete_url,
            thumbnail: result.data.thumb?.url || result.data.url
        })

    } catch (error) {
        console.error('Upload error:', error)
        return NextResponse.json(
            { error: "Erreur serveur lors de l'upload." },
            { status: 500 }
        )
    }
}
