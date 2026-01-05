const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('evenement')
        .setDescription('Créer un événement rapidement'),

    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('evenement_create')
            .setTitle('Créer un événement');

        // Titre
        const titleInput = new TextInputBuilder()
            .setCustomId('event_title')
            .setLabel('Titre de l\'événement')
            .setPlaceholder('Ex: Réunion d\'équipe')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

        // Date
        const dateInput = new TextInputBuilder()
            .setCustomId('event_date')
            .setLabel('Date (JJ/MM ou JJ/MM/AAAA)')
            .setPlaceholder('Ex: 15/01 ou 15/01/2026')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(10);

        // Heure
        const timeInput = new TextInputBuilder()
            .setCustomId('event_time')
            .setLabel('Heure de début (HH:MM)')
            .setPlaceholder('Ex: 14:00')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(5);

        // Durée (optionnelle)
        const durationInput = new TextInputBuilder()
            .setCustomId('event_duration')
            .setLabel('Durée en heures (optionnel)')
            .setPlaceholder('Ex: 2 (laissez vide pour 1h par défaut)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(2);

        // Description (optionnelle)
        const descInput = new TextInputBuilder()
            .setCustomId('event_description')
            .setLabel('Description (optionnel)')
            .setPlaceholder('Ajouter des détails...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(500);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(dateInput),
            new ActionRowBuilder().addComponents(timeInput),
            new ActionRowBuilder().addComponents(durationInput),
            new ActionRowBuilder().addComponents(descInput)
        );

        await interaction.showModal(modal);
    }
};

// Handler pour le modal
module.exports.handleModalSubmit = async function (interaction) {
    if (interaction.customId !== 'evenement_create') return false;

    const supabase = interaction.supabase;

    const title = interaction.fields.getTextInputValue('event_title');
    const dateStr = interaction.fields.getTextInputValue('event_date');
    const timeStr = interaction.fields.getTextInputValue('event_time');
    const durationStr = interaction.fields.getTextInputValue('event_duration') || '1';
    const description = interaction.fields.getTextInputValue('event_description') || null;

    // Parser la date
    let eventDate;
    const dateParts = dateStr.split('/');
    if (dateParts.length === 2) {
        // JJ/MM - utiliser l'année en cours
        const day = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        const year = new Date().getFullYear();
        eventDate = new Date(year, month, day);
        // Si la date est passée, on suppose l'année prochaine
        if (eventDate < new Date()) {
            eventDate.setFullYear(year + 1);
        }
    } else if (dateParts.length === 3) {
        // JJ/MM/AAAA
        const day = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        let year = parseInt(dateParts[2]);
        if (year < 100) year += 2000;
        eventDate = new Date(year, month, day);
    } else {
        return interaction.reply({ content: '❌ Format de date invalide. Utilisez JJ/MM ou JJ/MM/AAAA.', flags: 64 });
    }

    // Valider l'heure
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
        return interaction.reply({ content: '❌ Format d\'heure invalide. Utilisez HH:MM.', flags: 64 });
    }
    const hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return interaction.reply({ content: '❌ Heure invalide.', flags: 64 });
    }

    // Calculer les heures de début et fin
    const startTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const duration = parseFloat(durationStr) || 1;
    const totalEndMinutes = (hours * 60) + minutes + Math.round(duration * 60);
    const endHours = Math.floor(totalEndMinutes / 60) % 24; // %24 pour gérer minuit
    const endMinutes = totalEndMinutes % 60;
    const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

    // Formater la date pour Supabase
    const eventDateStr = eventDate.toISOString().split('T')[0];

    await interaction.deferReply({ flags: 64 });

    // Créer l'événement
    const { data: event, error } = await supabase
        .from('events')
        .insert({
            title,
            description,
            event_date: eventDateStr,
            start_time: startTime,
            end_time: endTime,
            event_type: 'autre',
            event_size: 'minor',
            color: '#4b5563',
            is_published: true,
            participants_all: true,
            created_by: interaction.user.id,
            created_by_name: interaction.member?.displayName || interaction.user.username
        })
        .select()
        .single();

    if (error) {
        console.error('Erreur création événement:', error);
        return interaction.editReply({ content: '❌ Erreur lors de la création de l\'événement.' });
    }

    // Formater la date pour l'affichage
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const displayDate = eventDate.toLocaleDateString('fr-FR', options);

    const embed = new EmbedBuilder()
        .setColor(0x22C55E)
        .setTitle('✅ Événement créé')
        .addFields(
            { name: '📌 Titre', value: title, inline: true },
            { name: '📅 Date', value: displayDate, inline: true },
            { name: '⏰ Horaire', value: `${startTime} - ${endTime}`, inline: true }
        )
        .setFooter({ text: `Créé par ${interaction.member?.displayName || interaction.user.username}` })
        .setTimestamp();

    if (description) {
        embed.setDescription(description);
    }

    return interaction.editReply({ embeds: [embed] });
};
