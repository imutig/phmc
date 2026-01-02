import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.discord_id) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401 }
            )
        }

        const supabase = await createClient()

        const { data: patient, error } = await supabase
            .from('patients')
            .select('first_name, last_name, phone, birth_date')
            .eq('discord_id', session.user.discord_id)
            .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 is "The result contains 0 rows"
            console.error('Error fetching my patient data:', error)
            return NextResponse.json(
                { error: "Erreur lors de la récupération du dossier." },
                { status: 500 }
            )
        }

        return NextResponse.json({ patient: patient || null })

    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json(
            { error: "Une erreur inattendue s'est produite." },
            { status: 500 }
        )
    }
}
