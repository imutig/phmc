const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Groq = require('groq-sdk');

// Initialiser Groq
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const SYSTEM_PROMPT = `Tu es Medibot, l'assistant virtuel du Pillbox Hill Medical Center (PHMC).
Tu réponds aux questions des employés EMS en te basant UNIQUEMENT sur le contenu du wiki interne fourni.

Règles:
- Réponds TOUJOURS en français
- Sois concis (max 1000 caractères pour Discord)
- Si la réponse n'est pas dans le wiki, dis-le clairement
- Utilise des emojis médicaux avec modération (🏥, 💉, 🚑)`;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wiki')
        .setDescription('Commandes du wiki EMS')
        .addSubcommand(subcommand =>
            subcommand
                .setName('search')
                .setDescription('Recherche dans le wiki EMS')
                .addStringOption(option =>
                    option.setName('recherche')
                        .setDescription('Terme à rechercher')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('ask')
                .setDescription('Pose une question à Medibot (IA)')
                .addStringOption(option =>
                    option.setName('question')
                        .setDescription('Ta question pour Medibot')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const supabase = interaction.supabase;

        if (subcommand === 'search') {
            await this.handleSearch(interaction, supabase);
        } else if (subcommand === 'ask') {
            await this.handleAsk(interaction, supabase);
        }
    },

    async handleSearch(interaction, supabase) {
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
            console.error('Erreur wiki search:', error);
            await interaction.editReply({
                content: '❌ Erreur lors de la recherche dans le wiki.'
            });
        }
    },

    async handleAsk(interaction, supabase) {
        const question = interaction.options.getString('question');

        await interaction.deferReply(); // Public pour que tout le monde voie la réponse

        try {
            // Récupérer les articles du wiki pour le contexte
            const { data: articles, error } = await supabase
                .from('wiki_articles')
                .select('title, content, category')
                .eq('is_published', true)
                .limit(20);

            if (error || !articles || articles.length === 0) {
                return interaction.editReply({
                    content: '❌ Je n\'ai pas accès au wiki actuellement.'
                });
            }

            // Construire le contexte du wiki
            const wikiContext = articles
                .map(a => `## ${a.title} (${a.category})\n${a.content.replace(/<[^>]*>/g, '')}`)
                .join('\n\n---\n\n');

            // Appeler Groq
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    {
                        role: 'user',
                        content: `Voici le contenu du wiki interne:\n\n${wikiContext}\n\n---\n\nQuestion: ${question}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 500 // Limité pour Discord
            });

            const answer = completion.choices[0]?.message?.content || 'Je n\'ai pas pu générer de réponse.';

            // Créer l'embed de réponse
            const embed = new EmbedBuilder()
                .setColor(0xDC2626)
                .setAuthor({ name: '🤖 Medibot' })
                .setTitle('Réponse à votre question')
                .addFields(
                    { name: '❓ Question', value: question.substring(0, 256), inline: false },
                    { name: '💬 Réponse', value: answer.substring(0, 1024), inline: false }
                )
                .setFooter({ text: 'Medibot • Assistant Wiki PHMC' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur wiki ask:', error);
            await interaction.editReply({
                content: '❌ Erreur lors de la génération de la réponse. Vérifiez que GROQ_API_KEY est configurée.'
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
