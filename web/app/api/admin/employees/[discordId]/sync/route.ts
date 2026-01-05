import { NextRequest, NextResponse } from "next/server"
import { requirePermission, getPrimaryGrade, RoleType } from "@/lib/auth-utils"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
)

// Mapping des rôles Discord vers les grades
// Sera chargé depuis la table discord_roles
async function getRoleConfig() {
    const { data } = await supabase
        .from('discord_roles')
        .select('role_type, discord_role_id')
    return data || []
}

/**
 * POST /api/admin/employees/[discordId]/sync
 * Synchronise les données d'un employé via le Bot Discord
 * Nécessite la permission manage_employees
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ discordId: string }> }
) {
    const { discordId } = await params

    // Vérifier les permissions
    const { authorized, error: permError } = await requirePermission('manage_employees')
    if (!authorized) {
        return NextResponse.json({ error: permError || 'Accès refusé' }, { status: 403 })
    }

    // Vérifier que le Bot Token est configuré
    const botToken = process.env.DISCORD_TOKEN
    if (!botToken) {
        console.error('[Sync] DISCORD_TOKEN non configuré')
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

    try {
        // Appeler l'API Discord avec le token Bot pour récupérer le membre
        const response = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
            {
                headers: {
                    Authorization: `Bot ${botToken}`,
                    'Content-Type': 'application/json'
                }
            }
        )

        if (response.status === 404) {
            return NextResponse.json({ error: 'Membre non trouvé sur le serveur Discord' }, { status: 404 })
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error('[Sync] Discord API error:', response.status, errorData)
            return NextResponse.json({
                error: `Erreur Discord API: ${response.status}`
            }, { status: 500 })
        }

        const memberData = await response.json()

        // Extraire les informations
        const discordRoles: string[] = memberData.roles || []
        const displayName = memberData.nick || memberData.user?.global_name || memberData.user?.username || 'Inconnu'
        const avatarHash = memberData.user?.avatar
        const avatarUrl = avatarHash
            ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png`
            : null

        // Déterminer le grade depuis les rôles Discord
        const roleConfig = await getRoleConfig()
        const userRoleTypes: RoleType[] = []

        for (const config of roleConfig) {
            if (discordRoles.includes(config.discord_role_id)) {
                userRoleTypes.push(config.role_type as RoleType)
            }
        }

        const grade = getPrimaryGrade(userRoleTypes)

        // Mettre à jour la DB
        const { error: updateError } = await supabase
            .from('users')
            .upsert({
                discord_id: discordId,
                discord_username: displayName,
                avatar_url: avatarUrl,
                grade: grade,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'discord_id'
            })

        if (updateError) {
            console.error('[Sync] DB update error:', updateError)
            return NextResponse.json({ error: 'Erreur mise à jour base de données' }, { status: 500 })
        }

        // Audit log
        const { logAudit } = await import('@/lib/audit')
        const { auth } = await import('@/lib/auth')
        const session = await auth()
        await logAudit({
            actorDiscordId: session?.user?.discord_id || 'admin',
            actorName: session?.user?.name || undefined,
            action: 'update',
            tableName: 'users',
            newData: { target_discord_id: discordId, displayName, grade, source: 'sync_from_discord' }
        })

        return NextResponse.json({
            success: true,
            data: {
                discordId,
                displayName,
                avatarUrl,
                grade,
                roles: userRoleTypes,
                syncedAt: new Date().toISOString()
            }
        })
    } catch (error) {
        console.error('[Sync] Error:', error)
        return NextResponse.json({ error: 'Erreur lors de la synchronisation' }, { status: 500 })
    }
}
