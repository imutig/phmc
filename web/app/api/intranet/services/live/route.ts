import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess, getPrimaryGrade } from "@/lib/auth-utils"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getISOWeekAndYear } from "@/lib/date-utils"

// Salaires par grade (fallback)
const GRADE_SALARIES: Record<string, number> = {
    direction: 1100,
    chirurgien: 1000,
    medecin: 900,
    infirmier: 700,
    ambulancier: 625
}

// Arrondir à la prochaine tranche de 15 min APRÈS l'heure donnée
function roundUpTo15Min(date: Date): Date {
    const minutes = date.getMinutes()
    const remainder = minutes % 15
    if (remainder === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0) {
        return date
    }
    const rounded = new Date(date)
    rounded.setMinutes(minutes + (15 - remainder))
    rounded.setSeconds(0)
    rounded.setMilliseconds(0)
    return rounded
}

// Arrondir à la dernière tranche de 15 min AVANT l'heure donnée
function roundDownTo15Min(date: Date): Date {
    const minutes = date.getMinutes()
    const remainder = minutes % 15
    const rounded = new Date(date)
    rounded.setMinutes(minutes - remainder)
    rounded.setSeconds(0)
    rounded.setMilliseconds(0)
    return rounded
}



// GET - Récupérer le service en cours de l'utilisateur
export async function GET() {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const session = await auth()
    if (!session?.user?.discord_id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const supabase = await createClient()

    const { data: service, error } = await supabase
        .from('services')
        .select('*')
        .eq('user_discord_id', session.user.discord_id)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ service })
}

// POST - Démarrer un nouveau service
export async function POST(request: Request) {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const session = await auth()
    if (!session?.user?.discord_id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const supabase = await createClient()

    // Vérifier qu'il n'y a pas déjà un service en cours
    const { data: existing } = await supabase
        .from('services')
        .select('id')
        .eq('user_discord_id', session.user.discord_id)
        .is('end_time', null)
        .limit(1)
        .maybeSingle()

    if (existing) {
        return NextResponse.json({ error: "Vous avez déjà un service en cours" }, { status: 400 })
    }

    const body = await request.json()
    const { user_name, grade_name, user_avatar_url } = body

    const now = new Date()
    const { week, year } = getISOWeekAndYear(now)
    const serviceDate = now.toISOString().split('T')[0]

    const { data, error } = await supabase
        .from('services')
        .insert({
            user_discord_id: session.user.discord_id,
            user_name: user_name || session.user.name || 'Inconnu',
            user_avatar_url: user_avatar_url || null,
            grade_name: grade_name || getPrimaryGrade(authResult.roles) || 'ambulancier',
            start_time: now.toISOString(),
            end_time: null,
            duration_minutes: 0,
            slots_count: null,
            salary_earned: null,
            week_number: week,
            year: year,
            service_date: serviceDate
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ service: data }, { status: 201 })
}

// PATCH - Terminer un service (avec arrondi aux 15 min)
export async function PATCH(request: Request) {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const session = await auth()
    if (!session?.user?.discord_id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const { service_id, end_time } = body

    if (!service_id || !end_time) {
        return NextResponse.json({ error: "service_id et end_time requis" }, { status: 400 })
    }

    const supabase = await createClient()

    // Récupérer le service
    const { data: service, error: fetchError } = await supabase
        .from('services')
        .select('*')
        .eq('id', service_id)
        .single()

    if (fetchError || !service) {
        return NextResponse.json({ error: "Service non trouvé" }, { status: 404 })
    }

    // Vérifier que c'est bien le propriétaire ou un admin
    const isOwner = service.user_discord_id === session.user.discord_id
    const isAdmin = authResult.roles.includes('direction')

    if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
    }

    // Calculer les heures arrondies
    const startTime = new Date(service.start_time)
    const endTime = new Date(end_time)

    const roundedStart = roundUpTo15Min(startTime)
    const roundedEnd = roundDownTo15Min(endTime)

    // Vérifier si le service est valide
    const validDurationMs = roundedEnd.getTime() - roundedStart.getTime()

    if (validDurationMs < 15 * 60 * 1000) {
        // Supprimer le service car durée insuffisante
        await supabase.from('services').delete().eq('id', service_id)
        return NextResponse.json({
            error: "Service trop court après arrondi - supprimé",
            deleted: true
        }, { status: 200 })
    }

    // Calculer la durée et le salaire
    const durationMinutes = Math.floor(validDurationMs / (1000 * 60))
    const slotsCount = Math.floor(durationMinutes / 15)
    const grade = service.grade_name
    const salaryPer15min = GRADE_SALARIES[grade] || 625
    const salaryEarned = slotsCount * salaryPer15min

    // Mettre à jour le service avec les valeurs arrondies
    const { data: updated, error: updateError } = await supabase
        .from('services')
        .update({
            start_time: roundedStart.toISOString(),
            end_time: roundedEnd.toISOString(),
            duration_minutes: durationMinutes,
            slots_count: slotsCount,
            salary_earned: salaryEarned,
            updated_at: new Date().toISOString()
        })
        .eq('id', service_id)
        .select()
        .single()

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
        service: updated,
        rounded: {
            original_start: startTime.toISOString(),
            original_end: endTime.toISOString(),
            rounded_start: roundedStart.toISOString(),
            rounded_end: roundedEnd.toISOString()
        }
    })
}

// DELETE - Annuler/couper un service (direction peut couper n'importe quel service)
export async function DELETE(request: Request) {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const session = await auth()
    if (!session?.user?.discord_id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const { service_id, cancel } = body

    if (!service_id) {
        return NextResponse.json({ error: "service_id requis" }, { status: 400 })
    }

    const supabase = await createClient()

    // Récupérer le service
    const { data: service, error: fetchError } = await supabase
        .from('services')
        .select('*')
        .eq('id', service_id)
        .single()

    if (fetchError || !service) {
        return NextResponse.json({ error: "Service non trouvé" }, { status: 404 })
    }

    // Vérifier les permissions
    const isOwner = service.user_discord_id === session.user.discord_id
    const isAdmin = authResult.roles.includes('direction')

    if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
    }

    if (cancel) {
        // Supprimer complètement le service (annulation)
        await supabase.from('services').delete().eq('id', service_id)
        return NextResponse.json({ deleted: true, cancelled: true })
    } else {
        // Terminer le service maintenant (couper par la direction)
        const endTime = new Date()

        // Réutiliser la logique de PATCH
        const startTime = new Date(service.start_time)
        const roundedStart = roundUpTo15Min(startTime)
        const roundedEnd = roundDownTo15Min(endTime)

        const validDurationMs = roundedEnd.getTime() - roundedStart.getTime()

        if (validDurationMs < 15 * 60 * 1000) {
            await supabase.from('services').delete().eq('id', service_id)
            return NextResponse.json({ deleted: true, reason: "Durée insuffisante" })
        }

        const durationMinutes = Math.floor(validDurationMs / (1000 * 60))
        const slotsCount = Math.floor(durationMinutes / 15)
        const grade = service.grade_name
        const salaryPer15min = GRADE_SALARIES[grade] || 625
        const salaryEarned = slotsCount * salaryPer15min

        const { data: updated } = await supabase
            .from('services')
            .update({
                start_time: roundedStart.toISOString(),
                end_time: roundedEnd.toISOString(),
                duration_minutes: durationMinutes,
                slots_count: slotsCount,
                salary_earned: salaryEarned,
                updated_at: new Date().toISOString()
            })
            .eq('id', service_id)
            .select()
            .single()

        return NextResponse.json({ service: updated, cut_by_admin: !isOwner })
    }
}
