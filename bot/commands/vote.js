const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Vote sur une candidature')
        .addStringOption(option =>
            option.setName('decision')
                .setDescription('Votre vote')
                .setRequired(true)
                .addChoices(
                    { name: '✅ Pour', value: 'pour' },
                    { name: '❌ Contre', value: 'contre' }
                )
        )
        .addStringOption(option =>
            option.setName('commentaire')
                .setDescription('Commentaire optionnel')
                .setRequired(false)
        ),

    async execute(interaction) {
        const supabase = interaction.supabase;
        const channelId = interaction.channelId;
        const decision = interaction.options.getString('decision');
        const comment = interaction.options.getString('commentaire');

        await interaction.deferReply();

        // Trouver la candidature liée à ce salon
        const { data: application, error } = await supabase
            .from('applications')
            .select('*')
            .eq('discord_channel_id', channelId)
            .single();

        if (error || !application) {
            return interaction.editReply({
                content: '❌ Ce salon n\'est pas lié à une candidature.',
                ephemeral: true
            });
        }

        // Vérifier si l'utilisateur a déjà voté
        const { data: existingVote } = await supabase
            .from('application_votes')
            .select('*')
            .eq('application_id', application.id)
            .eq('voter_discord_id', interaction.user.id)
            .single();

        if (existingVote) {
            // Mettre à jour le vote existant
            await supabase
                .from('application_votes')
                .update({
                    vote: decision === 'pour',
                    comment: comment,
                    created_at: new Date().toISOString()
                })
                .eq('id', existingVote.id);
        } else {
            // Créer un nouveau vote
            await supabase.from('application_votes').insert({
                application_id: application.id,
                voter_discord_id: interaction.user.id,
                voter_name: interaction.user.username,
                vote: decision === 'pour',
                comment: comment
            });
        }

        // Récupérer tous les votes pour cette candidature
        const { data: allVotes } = await supabase
            .from('application_votes')
            .select('*')
            .eq('application_id', application.id);

        const votesFor = allVotes?.filter(v => v.vote === true).length || 0;
        const votesAgainst = allVotes?.filter(v => v.vote === false).length || 0;

        // Logger l'action
        await supabase.from('application_logs').insert({
            application_id: application.id,
            actor_discord_id: interaction.user.id,
            actor_name: interaction.user.username,
            action: 'vote_cast',
            details: { vote: decision, comment: comment }
        });

        // Créer l'embed de confirmation
        const embed = new EmbedBuilder()
            .setColor(decision === 'pour' ? 0x22C55E : 0xEF4444)
            .setTitle(`${decision === 'pour' ? '✅' : '❌'} Vote Enregistré`)
            .setDescription(`**${interaction.user.username}** a voté **${decision.toUpperCase()}**`)
            .addFields(
                { name: '📊 Résultat actuel', value: `✅ Pour: **${votesFor}**\n❌ Contre: **${votesAgainst}**`, inline: true },
                { name: '📋 Total votes', value: `${allVotes?.length || 0}`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Vote informatif • Secrétaire Spades' });

        if (comment) {
            embed.addFields({ name: '💬 Commentaire', value: comment });
        }

        await interaction.editReply({ embeds: [embed] });
    }
};
