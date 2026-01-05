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

// Compte le nombre d'intervalles de 15 minutes TRAVERSÉS entre start et end
// Ex: 15h23 -> 15h33 = 1 slot (15h30 traversé)
// Ex: 15h23 -> 15h47 = 2 slots (15h30 et 15h45 traversés)
function countPaymentSlots(start: Date, end: Date): number {
    const slotDuration = 15 * 60 * 1000 // 15 min en ms
    // Premier slot = prochain multiple de 15 min après le début
    const firstSlot = Math.ceil(start.getTime() / slotDuration) * slotDuration
    let count = 0
    for (let t = firstSlot; t <= end.getTime(); t += slotDuration) {
        count++
    }
    return count
}



// GET - Récupérer le service en cours de l'utilisateur
export async function GET() {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const discordId = authResult.session!.user.discord_id
    if (!discordId) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const supabase = await createClient()

    const { data: service, error } = await supabase
        .from('services')
        .select('*')
        .is('deleted_at', null)
        .eq('user_discord_id', discordId)
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

    const discordId = authResult.session!.user.discord_id
    const userName = authResult.session!.user.displayName || authResult.session!.user.name || 'Inconnu'
    if (!discordId) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const supabase = await createClient()

    // Vérifier qu'il n'y a pas déjà un service en cours
    const { data: existing } = await supabase
        .from('services')
        .select('id')
        .eq('user_discord_id', discordId)
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
            user_discord_id: discordId,
            user_name: user_name || userName,
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

    // Audit log - Prise de service
    const { logAudit } = await import('@/lib/audit')
    await logAudit({
        actorDiscordId: discordId,
        actorName: userName,
        action: 'create',
        tableName: 'services',
        recordId: data.id,
        newData: data
    })

    return NextResponse.json({ service: data }, { status: 201 })
}

// PATCH - Terminer un service (nouvelle logique: heures réelles, slots traversés)
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

    // Calculer avec les heures RÉELLES (pas d'arrondi)
    const startTime = new Date(service.start_time)
    const endTime = new Date(end_time)

    // Durée réelle en minutes
    const durationMs = endTime.getTime() - startTime.getTime()
    const durationMinutes = Math.floor(durationMs / (1000 * 60))

    // Nombre de slots = intervalles de 15 min TRAVERSÉS
    const slotsCount = countPaymentSlots(startTime, endTime)

    // Calcul du salaire
    const grade = service.grade_name
    const salaryPer15min = GRADE_SALARIES[grade] || 625
    const salaryEarned = slotsCount * salaryPer15min

    // Mettre à jour le service avec les valeurs RÉELLES
    const { data: updated, error: updateError } = await supabase
        .from('services')
        .update({
            end_time: endTime.toISOString(),
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

    // Audit log - Fin de service
    const { logAudit, getDisplayName } = await import('@/lib/audit')
    await logAudit({
        actorDiscordId: session.user.discord_id,
        actorName: getDisplayName(session.user),
        action: 'update',
        tableName: 'services',
        recordId: service_id,
        oldData: service,
        newData: updated
    })

    return NextResponse.json({
        service: updated,
        info: {
            duration_minutes: durationMinutes,
            slots_traversed: slotsCount,
            salary_earned: salaryEarned
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
        const startTime = new Date(service.start_time)

        // Durée réelle en minutes
        const durationMs = endTime.getTime() - startTime.getTime()
        const durationMinutes = Math.floor(durationMs / (1000 * 60))

        // Nombre de slots = intervalles de 15 min TRAVERSÉS
        const slotsCount = countPaymentSlots(startTime, endTime)

        // Calcul du salaire
        const grade = service.grade_name
        const salaryPer15min = GRADE_SALARIES[grade] || 625
        const salaryEarned = slotsCount * salaryPer15min

        const { data: updated } = await supabase
            .from('services')
            .update({
                end_time: endTime.toISOString(),
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
