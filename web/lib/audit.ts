import { createClient } from '@/lib/supabase/server'

/**
 * Récupère le displayName d'un utilisateur de manière cohérente
 * Priorité: displayName > discord_username > name > 'Inconnu'
 */
export function getDisplayName(user: {
    displayName?: string | null
    discord_username?: string | null
    name?: string | null
}): string {
    return user.displayName || user.discord_username || user.name || 'Inconnu'
}

interface AuditLogParams {
    actorDiscordId: string
    actorName?: string
    actorGrade?: string
    action: 'create' | 'update' | 'delete' | 'restore'
    tableName: string
    recordId?: string
    oldData?: Record<string, any>
    newData?: Record<string, any>
}

/**
 * Enregistre une action dans les audit logs
 * 
 * @example
 * await logAudit({
 *   actorDiscordId: session.user.discord_id,
 *   actorName: 'Dr. Martin',
 *   action: 'update',
 *   tableName: 'care_types',
 *   recordId: careType.id,
 *   oldData: { price: 5000 },
 *   newData: { price: 7500 }
 * })
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
    const {
        actorDiscordId,
        actorName,
        actorGrade,
        action,
        tableName,
        recordId,
        oldData,
        newData
    } = params

    try {
        const supabase = await createClient()

        await supabase.from('audit_logs').insert({
            actor_discord_id: actorDiscordId,
            actor_name: actorName || null,
            actor_grade: actorGrade || null,
            action,
            table_name: tableName,
            record_id: recordId || null,
            old_data: oldData || null,
            new_data: newData || null
        })
    } catch (error) {
        // Log silencieusement pour ne pas bloquer l'opération principale
        console.error('[AUDIT] Erreur lors de l\'enregistrement:', error)
    }
}

/**
 * Soft delete un enregistrement et log l'action
 */
export async function softDelete(
    tableName: string,
    recordId: string,
    actorDiscordId: string,
    actorName?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient()

        // Récupérer les données avant suppression pour l'audit
        const { data: oldData, error: fetchError } = await supabase
            .from(tableName)
            .select('*')
            .eq('id', recordId)
            .single()

        if (fetchError || !oldData) {
            return { success: false, error: 'Enregistrement non trouvé' }
        }

        // Soft delete
        const { error: updateError } = await supabase
            .from(tableName)
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', recordId)

        if (updateError) {
            return { success: false, error: updateError.message }
        }

        // Audit log
        await logAudit({
            actorDiscordId,
            actorName,
            action: 'delete',
            tableName,
            recordId,
            oldData
        })

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Restaure un enregistrement soft deleted et log l'action
 */
export async function restoreDeleted(
    tableName: string,
    recordId: string,
    actorDiscordId: string,
    actorName?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient()

        // Restaurer
        const { data, error: updateError } = await supabase
            .from(tableName)
            .update({ deleted_at: null })
            .eq('id', recordId)
            .select()
            .single()

        if (updateError) {
            return { success: false, error: updateError.message }
        }

        // Audit log
        await logAudit({
            actorDiscordId,
            actorName,
            action: 'restore',
            tableName,
            recordId,
            newData: data
        })

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
