// src/commands/music/stop.js
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription(
      "Menghentikan musik dan mengeluarkan bot dari voice channel."
    ),
  async execute(interaction, client) {
    const serverQueue = client.queues.get(interaction.guild.id);
    if (!interaction.member.voice.channel) {
      return interaction.reply({
        content: "Kamu harus berada di voice channel!",
        flags: [MessageFlags.Ephemeral],
      });
    }
    if (!serverQueue) {
      return interaction.reply({
        content: "Tidak ada musik yang sedang diputar.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    serverQueue.songs = []; // Kosongkan antrian
    if (serverQueue.connection) {
      serverQueue.connection.destroy();
    }
    client.queues.delete(interaction.guild.id);

    await interaction.reply({
      content: "⏹️ Musik dihentikan dan bot keluar dari channel.",
    });
  },
};
