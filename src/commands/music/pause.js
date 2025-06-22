// src/commands/music/pause.js
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Menjeda lagu yang sedang diputar."),
  async execute(interaction, client) {
    const serverQueue = client.queues.get(interaction.guild.id);
    if (!serverQueue || !serverQueue.player) {
      return interaction.reply({
        content: "Tidak ada lagu yang sedang diputar.",
        flags: [MessageFlags.Ephemeral],
      });
    }
    if (serverQueue.player.state.status === "paused") {
      return interaction.reply({
        content: "Lagu sudah dijeda.",
        flags: [MessageFlags.Ephemeral],
      });
    }
    serverQueue.player.pause();
    return interaction.reply({ content: "⏸️ Lagu berhasil dijeda." });
  },
};
