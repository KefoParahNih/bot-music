// src/commands/music/skip.js
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Melewati lagu yang sedang diputar."),
  async execute(interaction, client) {
    const serverQueue = client.queues.get(interaction.guild.id);

    if (!interaction.member.voice.channel) {
      return interaction.reply({
        content: "Kamu harus berada di voice channel!",
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (!serverQueue || serverQueue.songs.length === 0) {
      return interaction.reply({
        content: "Tidak ada lagu di antrian untuk dilewati.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (
      !interaction.member.voice.channel ||
      interaction.member.voice.channel.id !== serverQueue.voiceChannel.id
    ) {
      return interaction.reply({
        content: "Kamu harus berada di voice channel yang sama dengan bot!",
        flags: [MessageFlags.Ephemeral],
      });
    }

    serverQueue.player.stop();

    await interaction.reply({ content: "⏭️ Lagu dilewati." });
  },
};
