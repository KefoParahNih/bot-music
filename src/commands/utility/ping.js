const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Melihat latensi bot dan memastikan bot online."),
  async execute(interaction, client) {
    const sent = await interaction.reply({
      content: "Pinging...",
      fetchReply: true,
    });
    const roundtripLatency =
      sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    const pingEmbed = new EmbedBuilder()
      .setColor("#3498db")
      .setTitle("🏓 Pong!")
      .setDescription("Berikut adalah detail latensi bot:")
      .addFields(
        {
          name: "Latensi Bot (Roundtrip)",
          value: `\`${roundtripLatency}ms\``,
          inline: true,
        },
        {
          name: "Latensi API (Heartbeat)",
          value: `\`${apiLatency}ms\``,
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({
        text: `Diminta oleh ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      });

    await interaction.editReply({ content: "", embeds: [pingEmbed] });
  },
};
