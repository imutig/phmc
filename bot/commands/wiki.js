const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wiki')
        .setDescription('Recherche dans le wiki EMS')
        .addStringOption(option =>
            option.setName('recherche')
                .setDescription('Terme à rechercher')
                .setRequired(true)
        ),

    async execute(interaction) {
        const supabase = interaction.supabase;
        const query = interaction.options.getString('recherche');

        await interaction.deferReply({ flags: 64 }); // ephemeral

        try {
            // Rechercher dans les articles wiki
            const { data: articles, error } = await supabase
                .from('wiki_articles')
                .select('id, title, slug, category, content')
                .eq('is_published', true)
                .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
                .limit(5);

            if (error) {
                console.error('Erreur recherche wiki:', error);
                return interaction.editReply({
                    content: '❌ Erreur lors de la recherche.'
                });
            }

            if (!articles || articles.length === 0) {
                return interaction.editReply({
                    content: `📚 Aucun article trouvé pour "${query}".`
                });
            }

            // Créer l'embed avec les résultats
            const embed = new EmbedBuilder()
                .setColor(0xDC2626)
                .setTitle(`📚 Recherche Wiki : "${query}"`)
                .setDescription(`${articles.length} résultat${articles.length > 1 ? 's' : ''} trouvé${articles.length > 1 ? 's' : ''}`)
                .setTimestamp()
                .setFooter({ text: 'Pillbox Hill Medical Center' });

            // URL de base du site
            const siteUrl = process.env.SITE_URL || 'https://phmc-production.up.railway.app';

            // Ajouter chaque article comme un field
            for (const article of articles) {
                // Extraire un extrait du contenu (premiers 150 caractères sans HTML)
                let excerpt = article.content
                    .replace(/<[^>]*>/g, '') // Supprimer les balises HTML
                    .replace(/\n/g, ' ')
                    .trim()
                    .substring(0, 150);

                if (article.content.length > 150) excerpt += '...';

                embed.addFields({
                    name: `${getCategoryEmoji(article.category)} ${article.title}`,
                    value: excerpt || '*Pas de contenu*',
                    inline: false
                });
            }

            // Créer les boutons pour chaque article
            const buttons = articles.slice(0, 5).map((article, index) =>
                new ButtonBuilder()
                    .setLabel(`Voir "${article.title.substring(0, 30)}${article.title.length > 30 ? '...' : ''}"`)
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${siteUrl}/intranet/wiki?article=${article.slug}`)
            );

            const row = new ActionRowBuilder().addComponents(buttons);

            await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

        } catch (error) {
            console.error('Erreur wiki:', error);
            await interaction.editReply({
                content: '❌ Erreur lors de la recherche dans le wiki.'
            });
        }
    }
};

function getCategoryEmoji(category) {
    const emojis = {
        general: '📋',
        procedures: '🏥',
        rh: '👥',
        formations: '🎓',
        urgences: '🚨'
    };
    return emojis[category] || '📄';
}
