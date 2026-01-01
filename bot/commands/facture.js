const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

// Stockage temporaire des factures en cours d'édition
const pendingInvoices = new Map();

// Catégories de soins avec emojis
const CARE_CATEGORIES = {
    'Urgences': { emoji: '🚨' },
    'Consultations': { emoji: '🩺' },
    'Chirurgie': { emoji: '🔪' },
    'Soins spécialisés': { emoji: '💉' },
    'Examens': { emoji: '🔬' },
    'Autres': { emoji: '📋' }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('facture')
        .setDescription('Calculer une facture médicale'),

    pendingInvoices,

    async execute(interaction) {
        const supabase = interaction.supabase;

        await interaction.deferReply({ flags: 64 });

        // Récupérer les tarifs depuis Supabase (table care_types avec catégorie)
        const { data: tarifs, error } = await supabase
            .from('care_types')
            .select(`
                id,
                name,
                description,
                price,
                category:care_categories(id, name)
            `)
            .order('name', { ascending: true });

        if (error) {
            console.error('Erreur récupération tarifs:', error);
            return interaction.editReply({
                content: '❌ Erreur lors de la récupération des tarifs: ' + error.message
            });
        }

        if (!tarifs || tarifs.length === 0) {
            return interaction.editReply({
                content: '❌ Aucun tarif configuré. Ajoutez des soins sur l\'intranet (Tarifs > Ajouter).'
            });
        }

        // Initialiser la facture
        const invoiceId = `invoice_${interaction.user.id}_${Date.now()}`;
        pendingInvoices.set(invoiceId, {
            doctorId: interaction.user.id,
            doctorName: interaction.member.displayName || interaction.user.username,
            items: [],
            tarifs: tarifs.map(t => ({
                id: t.id,
                name: t.name,
                description: t.description,
                price: t.price,
                category: t.category?.name || 'Autres'
            })),
            createdAt: new Date(),
            channelId: interaction.channelId,
            messageId: null
        });

        // Construire le message initial
        const messageData = buildInvoiceMessage(invoiceId);
        const reply = await interaction.editReply(messageData);

        // Stocker la référence du message
        const invoice = pendingInvoices.get(invoiceId);
        if (invoice) {
            invoice.messageId = reply.id;
        }

        // Auto-expiration après 15 minutes
        setTimeout(() => {
            if (pendingInvoices.has(invoiceId)) {
                pendingInvoices.delete(invoiceId);
            }
        }, 15 * 60 * 1000);
    }
};

function buildInvoiceMessage(invoiceId) {
    const invoice = pendingInvoices.get(invoiceId);
    if (!invoice) {
        return { content: '❌ Facture expirée ou introuvable.' };
    }

    const total = invoice.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Container Components V2
    const container = new ContainerBuilder()
        .setAccentColor(0x3B82F6)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🧾 Calculateur de Facture`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Médecin:** ${invoice.doctorName} • **Date:** ${new Date().toLocaleDateString('fr-FR')}`))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // Liste des items
    if (invoice.items.length === 0) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`*Aucun soin ajouté. Utilisez le menu ci-dessous pour ajouter des soins.*`)
        );
    } else {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📋 Détail des soins`));

        for (const item of invoice.items) {
            const lineTotal = item.price * item.quantity;
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`• **${item.name}** x${item.quantity} — $${lineTotal.toLocaleString()}`)
            );
        }

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## 💰 Total: **$${total.toLocaleString()}**`)
        );
    }

    // Grouper les tarifs par catégorie pour le select menu
    const categories = [...new Set(invoice.tarifs.map(t => t.category))];
    const selectOptions = [];

    for (const category of categories) {
        const categoryTarifs = invoice.tarifs.filter(t => t.category === category).slice(0, 5);
        const catInfo = CARE_CATEGORIES[category] || { emoji: '📋' };

        for (const tarif of categoryTarifs) {
            selectOptions.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(tarif.name.substring(0, 100))
                    .setDescription(`$${tarif.price} - ${category}`.substring(0, 100))
                    .setValue(`${invoiceId}:${tarif.id}`)
                    .setEmoji(catInfo.emoji)
            );
        }
    }

    // Limiter à 25 options (limite Discord)
    const limitedOptions = selectOptions.slice(0, 25);

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false));

    // Menu de sélection des soins
    if (limitedOptions.length > 0) {
        const selectRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('facture_add_care')
                .setPlaceholder('➕ Ajouter un soin...')
                .addOptions(limitedOptions)
        );
        container.addActionRowComponents(selectRow);
    }

    // Boutons de quantité rapide pour le dernier item
    if (invoice.items.length > 0) {
        const lastItem = invoice.items[invoice.items.length - 1];
        const qtyRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`facture_minus:${invoiceId}`)
                .setLabel(`- ${lastItem.name.substring(0, 15)}`)
                .setEmoji('➖')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`facture_plus:${invoiceId}`)
                .setLabel(`+ ${lastItem.name.substring(0, 15)}`)
                .setEmoji('➕')
                .setStyle(ButtonStyle.Primary)
        );
        container.addActionRowComponents(qtyRow);
    }

    // Boutons d'action
    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`facture_remove_last:${invoiceId}`)
            .setLabel('Retirer')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(invoice.items.length === 0),
        new ButtonBuilder()
            .setCustomId(`facture_copy:${invoiceId}`)
            .setLabel('Finaliser')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success)
            .setDisabled(invoice.items.length === 0),
        new ButtonBuilder()
            .setCustomId(`facture_cancel:${invoiceId}`)
            .setLabel('Annuler')
            .setStyle(ButtonStyle.Danger)
    );
    container.addActionRowComponents(actionRow);

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2
    };
}

// Handler pour les interactions
module.exports.handleInteraction = async function (interaction) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'facture_add_care') {
        const [invoiceId, tarifId] = interaction.values[0].split(':');
        const invoice = pendingInvoices.get(invoiceId);

        if (!invoice) {
            return interaction.reply({ content: '❌ Facture expirée.', flags: 64 });
        }

        const tarif = invoice.tarifs.find(t => t.id === tarifId);
        if (!tarif) {
            return interaction.reply({ content: '❌ Soin introuvable.', flags: 64 });
        }

        // Vérifier si le soin existe déjà
        const existingItem = invoice.items.find(i => i.id === tarif.id);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            invoice.items.push({
                id: tarif.id,
                name: tarif.name,
                price: tarif.price,
                quantity: 1
            });
        }

        await interaction.update(buildInvoiceMessage(invoiceId));
    }

    if (interaction.isButton()) {
        const [action, invoiceId] = interaction.customId.split(':');

        // Bouton + : augmenter la quantité du dernier item
        if (action === 'facture_plus') {
            const invoice = pendingInvoices.get(invoiceId);
            if (invoice && invoice.items.length > 0) {
                invoice.items[invoice.items.length - 1].quantity++;
            }
            await interaction.update(buildInvoiceMessage(invoiceId));
        }

        // Bouton - : diminuer la quantité du dernier item
        if (action === 'facture_minus') {
            const invoice = pendingInvoices.get(invoiceId);
            if (invoice && invoice.items.length > 0) {
                const lastItem = invoice.items[invoice.items.length - 1];
                if (lastItem.quantity > 1) {
                    lastItem.quantity--;
                } else {
                    invoice.items.pop();
                }
            }
            await interaction.update(buildInvoiceMessage(invoiceId));
        }

        // Bouton Retirer
        if (action === 'facture_remove_last') {
            const invoice = pendingInvoices.get(invoiceId);
            if (invoice && invoice.items.length > 0) {
                invoice.items.pop();
            }
            await interaction.update(buildInvoiceMessage(invoiceId));
        }

        // Bouton Annuler
        if (action === 'facture_cancel') {
            pendingInvoices.delete(invoiceId);

            const cancelContainer = new ContainerBuilder()
                .setAccentColor(0xEF4444)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# ❌ Facture Annulée\n\n*Cette facture a été annulée.*`)
                );

            await interaction.update({
                components: [cancelContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }

        // Bouton Finaliser
        if (action === 'facture_copy') {
            const invoice = pendingInvoices.get(invoiceId);
            if (!invoice || invoice.items.length === 0) {
                return interaction.reply({ content: '❌ Facture vide ou expirée.', flags: 64 });
            }

            const total = invoice.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            // Container final
            const successContainer = new ContainerBuilder()
                .setAccentColor(0x22C55E)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ✅ Facture Calculée`))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Médecin:** ${invoice.doctorName} • **Date:** ${new Date().toLocaleDateString('fr-FR')}`))
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            for (const item of invoice.items) {
                const lineTotal = item.price * item.quantity;
                successContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`• **${item.name}** x${item.quantity} — $${lineTotal.toLocaleString()}`)
                );
            }

            successContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            successContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## 💰 Total: **$${total.toLocaleString()}**`)
            );
            successContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# Facture n°${Date.now().toString(36).toUpperCase()}`)
            );

            pendingInvoices.delete(invoiceId);

            await interaction.update({
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};

module.exports.buildInvoiceMessage = buildInvoiceMessage;
