const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const log = require('../utils/logger');
const { handleInteractionError } = require('../utils/errorHandler');

/**
 * Handlers pour les services (prise/fin de service via /equipe)
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
 * Trouve le grade d'un membre Discord
 */
async function findUserGrade(interaction, supabase) {
    const { data: roleConfigs } = await supabase
        .from('discord_roles')
        .select('role_type, discord_role_id');

    for (const grade of GRADE_ORDER) {
        const config = roleConfigs?.find(r => r.role_type === grade);
        if (config && interaction.member.roles.cache.has(config.discord_role_id)) {
            return grade;
        }
    }
    return null;
}

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
 * Handler pour démarrer un service
 */
async function handleServiceStart(interaction, supabase) {
    try {
        // Vérifier si déjà en service
        const { data: existing } = await supabase
            .from('services')
            .select('id')
            .eq('user_discord_id', interaction.user.id)
            .is('end_time', null)
            .maybeSingle();

        if (existing) {
            return interaction.reply({ content: '❌ Vous avez déjà un service en cours.', flags: 64 });
        }

        // Trouver le grade
        const userGrade = await findUserGrade(interaction, supabase);
        if (!userGrade) {
            return interaction.reply({ content: '❌ Aucun grade EMS trouvé. Contactez la direction.', flags: 64 });
        }

        const now = new Date();
        const { week, year } = getWeekInfo(now);

        const { error } = await supabase
            .from('services')
            .insert({
                user_discord_id: interaction.user.id,
                user_name: interaction.member.displayName || interaction.user.username,
                user_avatar_url: interaction.user.displayAvatarURL(),
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
            return interaction.reply({ content: '❌ Erreur: ' + error.message, flags: 64 });
        }

        await interaction.reply({ content: '✅ **Service pris !** Bon courage.', flags: 64 });
    } catch (error) {
        await handleInteractionError(error, interaction, 'service_start');
    }
}

/**
 * Handler pour terminer un service
 */
async function handleServiceEnd(interaction, supabase) {
    try {
        // Récupérer le service en cours
        const { data: service } = await supabase
            .from('services')
            .select('*')
            .eq('user_discord_id', interaction.user.id)
            .is('end_time', null)
            .maybeSingle();

        if (!service) {
            return interaction.reply({ content: '❌ Vous n\'êtes pas en service.', flags: 64 });
        }

        const now = new Date();
        const startTime = new Date(service.start_time);

        // Arrondir aux 15 minutes
        const roundUpTo15Min = (date) => {
            const minutes = date.getMinutes();
            const remainder = minutes % 15;
            if (remainder === 0 && date.getSeconds() === 0) return date;
            const rounded = new Date(date);
            rounded.setMinutes(minutes + (15 - remainder));
            rounded.setSeconds(0);
            rounded.setMilliseconds(0);
            return rounded;
        };

        const roundDownTo15Min = (date) => {
            const minutes = date.getMinutes();
            const remainder = minutes % 15;
            const rounded = new Date(date);
            rounded.setMinutes(minutes - remainder);
            rounded.setSeconds(0);
            rounded.setMilliseconds(0);
            return rounded;
        };

        const roundedStart = roundUpTo15Min(startTime);
        const roundedEnd = roundDownTo15Min(now);
        const validDurationMs = roundedEnd.getTime() - roundedStart.getTime();

        if (validDurationMs < 15 * 60 * 1000) {
            await supabase.from('services').delete().eq('id', service.id);
            return interaction.reply({ content: '🗑️ **Service annulé** (durée insuffisante < 15min).', flags: 64 });
        }

        const durationMinutes = Math.floor(validDurationMs / (1000 * 60));
        const slotsCount = Math.floor(durationMinutes / 15);
        const salaryPer15min = GRADE_SALARIES[service.grade_name]?.perSlot || 625;
        const salaryEarned = slotsCount * salaryPer15min;

        const { error } = await supabase
            .from('services')
            .update({
                start_time: roundedStart.toISOString(),
                end_time: roundedEnd.toISOString(),
                duration_minutes: durationMinutes,
                slots_count: slotsCount,
                salary_earned: salaryEarned,
                updated_at: new Date().toISOString()
            })
            .eq('id', service.id);

        if (error) {
            return interaction.reply({ content: '❌ Erreur: ' + error.message, flags: 64 });
        }

        await interaction.reply({
            content: `✅ **Service terminé !**\n⏱️ ${formatDuration(durationMinutes)} • 💰 $${salaryEarned.toLocaleString()}`,
            flags: 64
        });
    } catch (error) {
        await handleInteractionError(error, interaction, 'service_end');
    }
}

/**
 * Affiche le modal d'ajout de service
 */
function showServiceAddModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('service_add_modal')
        .setTitle('Ajouter un service')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('debut')
                    .setLabel('Heure de début (HH:MM)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('14:00')
                    .setRequired(true)
                    .setMaxLength(5)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('fin')
                    .setLabel('Heure de fin (HH:MM)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('18:00')
                    .setRequired(true)
                    .setMaxLength(5)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('date')
                    .setLabel('Date (JJ/MM/AAAA, vide = aujourd\'hui)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('01/01/2026')
                    .setRequired(false)
                    .setMaxLength(10)
            )
        );

    return interaction.showModal(modal);
}

/**
 * Handler pour le modal d'ajout de service
 */
async function handleServiceAddModal(interaction, supabase) {
    try {
        const debutStr = interaction.fields.getTextInputValue('debut');
        const finStr = interaction.fields.getTextInputValue('fin');
        const dateStr = interaction.fields.getTextInputValue('date') || '';

        // Parser les heures
        const debutMatch = debutStr.match(/^(\d{1,2}):(\d{2})$/);
        const finMatch = finStr.match(/^(\d{1,2}):(\d{2})$/);

        if (!debutMatch || !finMatch) {
            return interaction.reply({ content: '❌ Format d\'heure invalide. Utilisez HH:MM (ex: 14:30)', flags: 64 });
        }

        const debutHour = parseInt(debutMatch[1]);
        const debutMin = parseInt(debutMatch[2]);
        const finHour = parseInt(finMatch[1]);
        const finMin = parseInt(finMatch[2]);

        if (debutMin % 15 !== 0 || finMin % 15 !== 0) {
            return interaction.reply({ content: '❌ Les minutes doivent être sur des tranches de 15 (:00, :15, :30, :45)', flags: 64 });
        }

        // Parser la date
        let serviceDate = new Date();
        if (dateStr) {
            const dateMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (dateMatch) {
                serviceDate = new Date(dateMatch[3], dateMatch[2] - 1, dateMatch[1]);
            } else {
                return interaction.reply({ content: '❌ Format de date invalide. Utilisez JJ/MM/AAAA', flags: 64 });
            }
        }

        const startTime = new Date(serviceDate);
        startTime.setHours(debutHour, debutMin, 0, 0);

        const endTime = new Date(serviceDate);
        endTime.setHours(finHour, finMin, 0, 0);

        if (endTime <= startTime) {
            endTime.setDate(endTime.getDate() + 1);
        }

        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.floor(durationMs / (1000 * 60));

        if (durationMinutes < 15) {
            return interaction.reply({ content: '❌ Service minimum de 15 minutes', flags: 64 });
        }

        const userGrade = await findUserGrade(interaction, supabase);
        if (!userGrade) {
            return interaction.reply({ content: '❌ Aucun grade EMS trouvé. Contactez la direction.', flags: 64 });
        }

        const slotsCount = Math.floor(durationMinutes / 15);
        const salaryInfo = GRADE_SALARIES[userGrade];
        const salaryEarned = slotsCount * salaryInfo.perSlot;
        const { week, year } = getWeekInfo(startTime);

        const { error } = await supabase
            .from('services')
            .insert({
                user_discord_id: interaction.user.id,
                user_name: interaction.member.displayName || interaction.user.username,
                grade_name: userGrade,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                duration_minutes: durationMinutes,
                slots_count: slotsCount,
                salary_earned: salaryEarned,
                week_number: week,
                year: year,
                service_date: startTime.toISOString().split('T')[0]
            });

        if (error) {
            log.error('Erreur insertion service:', error);
            return interaction.reply({ content: '❌ Erreur: ' + error.message, flags: 64 });
        }

        await interaction.reply({
            content: `✅ **Service enregistré !**\n📅 ${startTime.toLocaleDateString('fr-FR')} • ⏰ ${debutStr} → ${finStr} • ⏱️ ${formatDuration(durationMinutes)} • 💰 $${salaryEarned.toLocaleString()}`,
            flags: 64
        });
    } catch (error) {
        await handleInteractionError(error, interaction, 'service_add_modal');
    }
}

module.exports = {
    handleServiceStart,
    handleServiceEnd,
    showServiceAddModal,
    handleServiceAddModal,
    findUserGrade,
    GRADE_SALARIES,
    GRADE_ORDER
};
