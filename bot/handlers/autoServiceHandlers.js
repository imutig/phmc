const log = require('../utils/logger');

/**
 * Handlers pour les services automatiques (déclenchés par le bot Pointeuse)
 * Ces handlers sont appelés sans interaction Discord, donc ils prennent un user de la DB
 */

const GRADE_ORDER = ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier'];
const GRADE_SALARIES = {
    direction: { perSlot: 1100, maxWeekly: 150000 },
    chirurgien: { perSlot: 1000, maxWeekly: 120000 },
    medecin: { perSlot: 900, maxWeekly: 100000 },
    infirmier: { perSlot: 700, maxWeekly: 85000 },
    ambulancier: { perSlot: 625, maxWeekly: 80000 }
};

/**
 * Calcule la semaine ISO
 */
function getWeekInfo(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { week, year: date.getFullYear() };
}

/**
 * Formate une durée en heures/minutes
 */
function formatDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h${m}m` : `${h}h`;
}

/**
 * Trouve le grade d'un utilisateur à partir de son discord_id
 */
async function findUserGradeByDiscordId(discordId, supabase) {
    const { data: roleConfigs } = await supabase
        .from('discord_roles')
        .select('role_type, discord_role_id');

    // Récupérer les rôles Discord de l'utilisateur via le cache du client ou via API
    // Pour l'instant, on utilise le grade stocké dans le dernier service ou on retourne null
    const { data: lastService } = await supabase
        .from('services')
        .select('grade_name')
        .eq('user_discord_id', discordId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    return lastService?.grade_name || null;
}

/**
 * Démarre un service automatiquement pour un utilisateur
 * @param {Object} user - L'utilisateur de la DB (avec discord_id, ign, etc.)
 * @param {Object} supabase - Le client Supabase
 * @param {Object} client - Le client Discord (pour récupérer le membre)
 */
async function handleAutoServiceStart(user, supabase, client) {
    try {
        const discordId = user.discord_id;

        // Vérifier si déjà en service
        const { data: existing } = await supabase
            .from('services')
            .select('id')
            .eq('user_discord_id', discordId)
            .is('end_time', null)
            .maybeSingle();

        if (existing) {
            log.info(`[Pointeuse] ${user.ign} déjà en service, ignoré`);
            return { success: false, reason: 'already_in_service' };
        }

        // Récupérer le membre Discord pour avoir son grade
        let userGrade = null;
        let userName = user.ign;
        let userAvatarUrl = null;

        try {
            const guildId = process.env.DISCORD_GUILD_ID;
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                const member = await guild.members.fetch(discordId).catch(() => null);
                if (member) {
                    userName = member.displayName || member.user.username;
                    userAvatarUrl = member.user.displayAvatarURL();

                    // Trouver le grade via les rôles
                    const { data: roleConfigs } = await supabase
                        .from('discord_roles')
                        .select('role_type, discord_role_id');

                    for (const grade of GRADE_ORDER) {
                        const config = roleConfigs?.find(r => r.role_type === grade);
                        if (config && member.roles.cache.has(config.discord_role_id)) {
                            userGrade = grade;
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            log.warn(`[Pointeuse] Impossible de récupérer le membre Discord ${discordId}: ${e.message}`);
        }

        // Si pas de grade trouvé, utiliser le dernier connu ou 'ambulancier' par défaut
        if (!userGrade) {
            userGrade = await findUserGradeByDiscordId(discordId, supabase) || 'ambulancier';
        }

        const now = new Date();
        const { week, year } = getWeekInfo(now);

        const { error } = await supabase
            .from('services')
            .insert({
                user_discord_id: discordId,
                user_name: userName,
                user_avatar_url: userAvatarUrl,
                grade_name: userGrade,
                start_time: now.toISOString(),
                end_time: null,
                duration_minutes: 0,
                slots_count: null,
                salary_earned: null,
                week_number: week,
                year: year,
                service_date: now.toISOString().split('T')[0]
            });

        if (error) {
            log.error(`[Pointeuse] Erreur création service pour ${user.ign}: ${error.message}`);
            return { success: false, reason: 'db_error', error };
        }

        log.success(`[Pointeuse] ✅ Service démarré pour ${user.ign} (${userGrade})`);
        return { success: true };
    } catch (error) {
        log.error(`[Pointeuse] Erreur handleAutoServiceStart: ${error.message}`);
        return { success: false, reason: 'exception', error };
    }
}

/**
 * Termine un service automatiquement pour un utilisateur
 * @param {Object} user - L'utilisateur de la DB
 * @param {Object} supabase - Le client Supabase
 */
async function handleAutoServiceEnd(user, supabase) {
    try {
        const discordId = user.discord_id;

        // Récupérer le service en cours
        const { data: service } = await supabase
            .from('services')
            .select('*')
            .eq('user_discord_id', discordId)
            .is('end_time', null)
            .maybeSingle();

        if (!service) {
            log.info(`[Pointeuse] ${user.ign} n'est pas en service, ignoré`);
            return { success: false, reason: 'not_in_service' };
        }

        const now = new Date();
        const startTime = new Date(service.start_time);

        // Calculer la durée réelle en minutes
        const durationMs = now.getTime() - startTime.getTime();
        const durationMinutes = Math.floor(durationMs / (1000 * 60));

        // Nouvelle logique : compter les intervalles de 15 min TRAVERSÉS
        const countPaymentSlots = (start, end) => {
            const slotDuration = 15 * 60 * 1000; // 15 min en ms
            const firstSlot = Math.ceil(start.getTime() / slotDuration) * slotDuration;
            let count = 0;
            for (let t = firstSlot; t <= end.getTime(); t += slotDuration) {
                count++;
            }
            return count;
        };

        const slotsCount = countPaymentSlots(startTime, now);
        const salaryPer15min = GRADE_SALARIES[service.grade_name]?.perSlot || 625;
        const salaryEarned = slotsCount * salaryPer15min;

        const { error } = await supabase
            .from('services')
            .update({
                end_time: now.toISOString(),
                duration_minutes: durationMinutes,
                slots_count: slotsCount,
                salary_earned: salaryEarned,
                updated_at: new Date().toISOString()
            })
            .eq('id', service.id);

        if (error) {
            log.error(`[Pointeuse] Erreur fin service pour ${user.ign}: ${error.message}`);
            return { success: false, reason: 'db_error', error };
        }

        const salaryMsg = slotsCount > 0
            ? `${slotsCount} versement(s) = $${salaryEarned.toLocaleString()}`
            : 'aucun versement';

        log.success(`[Pointeuse] ✅ Service terminé pour ${user.ign}: ${formatDuration(durationMinutes)} • ${salaryMsg}`);
        return { success: true, duration: durationMinutes, salary: salaryEarned, slots: slotsCount };
    } catch (error) {
        log.error(`[Pointeuse] Erreur handleAutoServiceEnd: ${error.message}`);
        return { success: false, reason: 'exception', error };
    }
}

module.exports = {
    handleAutoServiceStart,
    handleAutoServiceEnd,
    GRADE_SALARIES,
    GRADE_ORDER
};
