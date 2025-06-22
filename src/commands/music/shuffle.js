const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Mengacak urutan lagu di dalam antrian."),
  async execute(interaction, client) {
    const serverQueue = client.queues.get(interaction.guild.id);

    if (!serverQueue || serverQueue.songs.length < 2) {
      return interaction.reply({
        content: "Tidak ada cukup lagu di antrian untuk diacak.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const currentlyPlaying = serverQueue.songs.shift();

    for (let i = serverQueue.songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [serverQueue.songs[i], serverQueue.songs[j]] = [
        serverQueue.songs[j],
        serverQueue.songs[i],
      ];
    }

    serverQueue.songs.unshift(currentlyPlaying);
    serverQueue.isShuffled = true;

    const embed = new EmbedBuilder()
      .setColor("#ff5500")
      .setTitle("🔀 Antrian Diacak")
      .setDescription("Urutan lagu di antrian telah berhasil diacak.");

    await interaction.reply({ embeds: [embed] });
  },
};
