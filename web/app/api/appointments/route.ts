import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
    try {
        // Vérifier l'authentification
        const session = await auth()
        if (!session?.user?.discord_id) {
            return NextResponse.json(
                { error: "Non authentifié. Veuillez vous connecter avec Discord." },
                { status: 401 }
            )
        }

        const supabase = await createClient()
        const body = await request.json()

        // Validation des champs requis
        const requiredFields = ['firstName', 'lastName', 'phone', 'birthDate', 'fingerprint']
        for (const field of requiredFields) {
            if (!body[field]) {
                return NextResponse.json(
                    { error: `Le champ ${field} est requis.` },
                    { status: 400 }
                )
            }
        }

        // Stratégie d'identification du patient :
        // 1. Recherche par Empreinte (Prioritaire car unique au personnage)
        // 2. Recherche par Discord ID (Fallback pour les anciens dossiers)

        let patientId: string
        let existingPatient = null

        // 1. Recherche par Empreinte
        const { data: patientByFingerprint } = await supabase
            .from('patients')
            .select('id, discord_id')
            .eq('fingerprint', body.fingerprint)
            .single()

        if (patientByFingerprint) {
            existingPatient = patientByFingerprint
        } else {
            // 2. Recherche par Discord ID (si pas trouvé par empreinte)
            const { data: patientByDiscord } = await supabase
                .from('patients')
                .select('id, discord_id')
                .eq('discord_id', session.user.discord_id)
                .single()

            existingPatient = patientByDiscord
        }

        if (existingPatient) {
            patientId = existingPatient.id

            // Mettre à jour les infos du patient
            // On ajoute l'ID Discord s'il n'est pas présent (cas d'un dossier créé manuellement)
            // On met à jour l'empreinte si elle n'était pas présente (cas d'un ancien dossier)
            await supabase
                .from('patients')
                .update({
                    first_name: body.firstName,
                    last_name: body.lastName,
                    phone: body.phone,
                    birth_date: body.birthDate,
                    fingerprint: body.fingerprint, // Met à jour ou ajoute l'empreinte
                    discord_id: session.user.discord_id, // Associe le compte Discord
                    discord_username: session.user.discord_username || session.user.name || 'Unknown',
                    updated_at: new Date().toISOString()
                })
                .eq('id', patientId)
        } else {
            // Créer le patient
            const { data: newPatient, error: patientError } = await supabase
                .from('patients')
                .insert({
                    first_name: body.firstName,
                    last_name: body.lastName,
                    phone: body.phone,
                    birth_date: body.birthDate,
                    fingerprint: body.fingerprint,
                    discord_id: session.user.discord_id,
                    discord_username: session.user.discord_username || session.user.name || 'Unknown',
                    created_by: session.user.discord_id
                })
                .select('id')
                .single()

            if (patientError || !newPatient) {
                console.error('Error creating patient:', patientError)
                return NextResponse.json(
                    { error: "Erreur lors de la création du dossier patient." },
                    { status: 500 }
                )
            }
            patientId = newPatient.id
        }

        // Vérifier s'il y a déjà un rendez-vous en cours
        const { data: existingAppointment } = await supabase
            .from('appointments')
            .select('id')
            .eq('discord_id', session.user.discord_id)
            .in('status', ['pending', 'scheduled'])
            .single()

        if (existingAppointment) {
            return NextResponse.json(
                { error: "Vous avez déjà un rendez-vous en cours." },
                { status: 409 }
            )
        }

        // Créer le rendez-vous
        const { data: appointment, error: appError } = await supabase
            .from('appointments')
            .insert({
                patient_id: patientId,
                discord_id: session.user.discord_id,
                discord_username: session.user.discord_username || session.user.name,
                status: 'pending',
                reason_category: body.reasonCategory,
                reason: body.reason || null
            })
            .select('id')
            .single()

        if (appError || !appointment) {
            console.error('Error creating appointment:', appError)
            return NextResponse.json(
                { error: "Erreur lors de la création du rendez-vous." },
                { status: 500 }
            )
        }

        // Le bot Discord est notifié via Supabase Realtime (listener sur INSERT appointments)
        // Pas besoin d'appel API supplémentaire

        return NextResponse.json({
            success: true,
            appointmentId: appointment.id,
            patientId: patientId,
            message: "Votre rendez-vous a été enregistré !"
        })

    } catch (error) {
        console.error('Appointment submission error:', error)
        return NextResponse.json(
            { error: "Une erreur inattendue s'est produite." },
            { status: 500 }
        )
    }
}

// GET: Récupérer les rendez-vous (authentification requise)
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
        const searchParams = request.nextUrl.searchParams
        const status = searchParams.get('status')

        // Vérifier si l'utilisateur est staff via le système de rôles moderne
        const userRoles = session.user.roles || []
        const isStaff = userRoles.some((role: string) =>
            ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier'].includes(role)
        )

        // Si non staff, retourner seulement ses propres rendez-vous
        if (!isStaff) {
            const { data: appointments } = await supabase
                .from('appointments')
                .select(`
                    *,
                    patient:patients(*)
                `)
                .eq('discord_id', session.user.discord_id)
                .order('created_at', { ascending: false })

            return NextResponse.json({ appointments: appointments || [] })
        }

        // Staff: tous les rendez-vous
        let query = supabase
            .from('appointments')
            .select(`
                *,
                patient:patients(*)
            `)
            .order('created_at', { ascending: false })

        if (status) {
            query = query.eq('status', status)
        }

        const { data: appointments, error } = await query

        if (error) {
            console.error('Error fetching appointments:', error)
            return NextResponse.json(
                { error: "Erreur lors de la récupération des rendez-vous." },
                { status: 500 }
            )
        }

        return NextResponse.json({ appointments: appointments || [] })

    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json(
            { error: "Une erreur inattendue s'est produite." },
            { status: 500 }
        )
    }
}
