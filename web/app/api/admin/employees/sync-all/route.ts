import { NextResponse } from "next/server"
import { requirePermission, getPrimaryGrade, RoleType } from "@/lib/auth-utils"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
)

/**
 * POST /api/admin/employees/sync-all
 * Récupère tous les membres Discord avec des rôles EMS et les ajoute à la DB s'ils n'existent pas
 * Nécessite la permission manage_employees
 */
export async function POST() {
    // Vérifier les permissions
    const { authorized, error: permError } = await requirePermission('manage_employees')
    if (!authorized) {
        return NextResponse.json({ error: permError || 'Accès refusé' }, { status: 403 })
    }

    // Vérifier que le Bot Token est configuré
    const botToken = process.env.DISCORD_TOKEN
    if (!botToken) {
        console.error('[Sync All] DISCORD_TOKEN non configuré')
        return NextResponse.json({ error: 'Token Bot Discord non configuré' }, { status: 500 })
    }

    // Récupérer le Guild ID
    const { data: guildConfig } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'guild_id')
        .single()

    const guildId = guildConfig?.value?.replace(/"/g, '') || process.env.DISCORD_GUILD_ID
    if (!guildId) {
        return NextResponse.json({ error: 'Guild ID non configuré' }, { status: 500 })
    }

    // Récupérer la config des rôles EMS
    const { data: roleConfig } = await supabase
        .from('discord_roles')
        .select('role_type, discord_role_id')

    if (!roleConfig || roleConfig.length === 0) {
        return NextResponse.json({ error: 'Aucun rôle EMS configuré' }, { status: 500 })
    }

    // Ensembles des rôles Discord EMS
    const emsRoleIds = new Set(roleConfig.map(r => r.discord_role_id))

    try {
        // Récupérer tous les membres du serveur Discord
        // Note: L'API Discord limite à 1000 membres par requête
        const allMembers: any[] = []
        let after = ''

        while (true) {
            const url = `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000${after ? `&after=${after}` : ''}`
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bot ${botToken}`,
                    'Content-Type': 'application/json'
                }
            })

            if (!response.ok) {
                if (response.status === 429) {
                    // Rate limited - attendre et réessayer
                    const retryAfter = parseInt(response.headers.get('Retry-After') || '5')
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
                    continue
                }
                console.error('[Sync All] Discord API error:', response.status)
                break
            }

            const members = await response.json()
            if (members.length === 0) break

            allMembers.push(...members)
            after = members[members.length - 1].user.id

            // Si on a moins de 1000, on a tout récupéré
            if (members.length < 1000) break
        }

        // Récupérer les membres existants en DB
        const { data: existingUsers } = await supabase
            .from('users')
            .select('discord_id')

        const existingIds = new Set((existingUsers || []).map(u => u.discord_id))

        // Filtrer les membres avec des rôles EMS et non existants
        const newMembers = allMembers.filter(member => {
            const hasEmsRole = member.roles?.some((roleId: string) => emsRoleIds.has(roleId))
            const notInDb = !existingIds.has(member.user.id)
            return hasEmsRole && notInDb
        })

        // Ajouter les nouveaux membres
        const addedMembers: any[] = []
        for (const member of newMembers) {
            const discordId = member.user.id
            const displayName = member.nick || member.user.global_name || member.user.username || 'Inconnu'
            const avatarHash = member.user.avatar
            const avatarUrl = avatarHash
                ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png`
                : null

            // Déterminer le grade
            const userRoleTypes: RoleType[] = []
            for (const config of roleConfig) {
                if (member.roles?.includes(config.discord_role_id)) {
                    userRoleTypes.push(config.role_type as RoleType)
                }
            }
            const grade = getPrimaryGrade(userRoleTypes)

            // Insérer dans la DB
            const { error: insertError } = await supabase
                .from('users')
                .insert({
                    discord_id: discordId,
                    discord_username: displayName,
                    avatar_url: avatarUrl,
                    grade: grade,
                    updated_at: new Date().toISOString()
                })

            if (!insertError) {
                addedMembers.push({
                    discordId,
                    displayName,
                    grade
                })
            }
        }

        return NextResponse.json({
            success: true,
            message: `${addedMembers.length} nouveaux membres ajoutés`,
            totalDiscordMembers: allMembers.length,
            membersWithEmsRoles: newMembers.length + existingIds.size,
            newMembersAdded: addedMembers.length,
            addedMembers
        })
    } catch (error) {
        console.error('[Sync All] Error:', error)
        return NextResponse.json({ error: 'Erreur lors de la synchronisation' }, { status: 500 })
    }
}
