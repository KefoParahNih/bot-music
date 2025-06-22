// src/commands/music/resume.js
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Melanjutkan lagu yang dijeda."),
  async execute(interaction, client) {
    const serverQueue = client.queues.get(interaction.guild.id);
    if (!serverQueue || !serverQueue.player) {
      return interaction.reply({
        content: "Tidak ada lagu untuk dilanjutkan.",
        flags: [MessageFlags.Ephemeral],
      });
    }
    if (serverQueue.player.state.status !== "paused") {
      return interaction.reply({
        content: "Lagu tidak sedang dijeda.",
        flags: [MessageFlags.Ephemeral],
      });
    }
    serverQueue.player.unpause();
    return interaction.reply({ content: "▶️ Lagu dilanjutkan." });
  },
};
