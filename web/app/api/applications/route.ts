import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import type { ApplicationFormData } from "@/lib/types/database"
import { applicationRateLimit, checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit"

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

        // Rate limiting par utilisateur Discord
        const { success, reset, remaining } = await checkRateLimit(
            applicationRateLimit,
            `application:${session.user.discord_id}`
        )

        if (!success) {
            return NextResponse.json(
                { error: "Trop de candidatures. Veuillez réessayer dans quelques minutes." },
                { status: 429, headers: rateLimitHeaders(reset, remaining) }
            )
        }

        const supabase = await createClient()
        const body: ApplicationFormData = await request.json()

        // Validation des champs requis
        const requiredFields = ['service', 'firstName', 'lastName', 'birthDate', 'seniority', 'motivation', 'availability']
        for (const field of requiredFields) {
            if (!body[field as keyof ApplicationFormData]) {
                return NextResponse.json(
                    { error: `Le champ ${field} est requis.` },
                    { status: 400 }
                )
            }
        }

        // Vérifier si l'utilisateur est blacklisté
        const { data: blacklisted } = await supabase
            .from('blacklist')
            .select('id')
            .eq('discord_id', session.user.discord_id)
            .single()

        if (blacklisted) {
            return NextResponse.json(
                { error: "Vous n'êtes pas autorisé à postuler." },
                { status: 403 }
            )
        }

        // Créer ou récupérer l'utilisateur
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('discord_id', session.user.discord_id)
            .single()

        let userId: string

        if (existingUser) {
            userId = existingUser.id
        } else {
            const { data: newUser, error: userError } = await supabase
                .from('users')
                .insert({
                    discord_id: session.user.discord_id,
                    discord_username: session.user.discord_username || session.user.name || 'Unknown',
                    avatar_url: session.user.discord_avatar
                        ? `https://cdn.discordapp.com/avatars/${session.user.discord_id}/${session.user.discord_avatar}.png`
                        : null,
                    email: session.user.email,
                })
                .select('id')
                .single()

            if (userError || !newUser) {
                console.error('Error creating user:', userError)
                return NextResponse.json(
                    { error: "Erreur lors de la création du profil." },
                    { status: 500 }
                )
            }
            userId = newUser.id
        }

        // Vérifier le cooldown (candidature récente refusée)
        const { data: configCooldown } = await supabase
            .from('config')
            .select('value')
            .eq('key', 'cooldown_hours')
            .single()

        const cooldownHours = configCooldown?.value ? parseInt(configCooldown.value as string) : 24

        const { data: recentRejection } = await supabase
            .from('applications')
            .select('created_at')
            .eq('user_id', userId)
            .eq('service', body.service)
            .eq('status', 'rejected')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (recentRejection) {
            const rejectionDate = new Date(recentRejection.created_at)
            const cooldownEnd = new Date(rejectionDate.getTime() + cooldownHours * 60 * 60 * 1000)

            if (new Date() < cooldownEnd) {
                const hoursLeft = Math.ceil((cooldownEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60))
                return NextResponse.json(
                    { error: `Vous devez attendre encore ${hoursLeft}h avant de pouvoir repostuler.` },
                    { status: 429 }
                )
            }
        }

        // Vérifier s'il y a déjà une candidature en cours pour ce service
        const { data: existingApplication } = await supabase
            .from('applications')
            .select('id, status')
            .eq('user_id', userId)
            .eq('service', body.service)
            .not('status', 'in', '("rejected","recruited")')
            .single()

        if (existingApplication) {
            return NextResponse.json(
                { error: "Vous avez déjà une candidature en cours pour ce service." },
                { status: 409 }
            )
        }

        // Créer la candidature
        const { data: application, error: appError } = await supabase
            .from('applications')
            .insert({
                user_id: userId,
                service: body.service,
                status: 'pending',
                first_name: body.firstName,
                last_name: body.lastName,
                birth_date: body.birthDate,
                seniority: body.seniority,
                motivation: body.motivation,
                availability: body.availability,
            })
            .select('id')
            .single()

        if (appError || !application) {
            console.error('Error creating application:', appError)
            return NextResponse.json(
                { error: "Erreur lors de la création de la candidature." },
                { status: 500 }
            )
        }

        // Logger l'action
        await supabase.from('application_logs').insert({
            application_id: application.id,
            actor_discord_id: session.user.discord_id,
            actor_name: session.user.discord_username || session.user.name,
            action: 'application_created',
            details: { service: body.service },
        })

        // TODO: Appeler le bot Discord pour créer le salon et envoyer le DM
        // Cela sera fait via une API interne ou un webhook

        return NextResponse.json({
            success: true,
            applicationId: application.id,
            message: "Votre candidature a été soumise avec succès !",
        })

    } catch (error) {
        console.error('Application submission error:', error)
        return NextResponse.json(
            { error: "Une erreur inattendue s'est produite." },
            { status: 500 }
        )
    }
}

// GET: Récupérer les candidatures de l'utilisateur connecté
export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.discord_id) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401 }
            )
        }

        const supabase = await createClient()

        // Récupérer l'utilisateur
        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('discord_id', session.user.discord_id)
            .single()

        if (!user) {
            return NextResponse.json({ applications: [] })
        }

        // Récupérer les candidatures
        const { data: applications, error } = await supabase
            .from('applications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching applications:', error)
            return NextResponse.json(
                { error: "Erreur lors de la récupération des candidatures." },
                { status: 500 }
            )
        }

        return NextResponse.json({ applications })

    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json(
            { error: "Une erreur inattendue s'est produite." },
            { status: 500 }
        )
    }
}
