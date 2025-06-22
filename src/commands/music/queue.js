const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Menampilkan antrian lagu."),
  async execute(interaction, client) {
    const serverQueue = client.queues.get(interaction.guild.id);
    if (!serverQueue || serverQueue.songs.length === 0) {
      return interaction.reply({
        content: "Antrian lagu kosong.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const loopStatus =
      serverQueue.loopMode === 1
        ? "Lagu 🔂"
        : serverQueue.loopMode === 2
        ? "Antrian 🔁"
        : "Mati ❌";
    const shuffleStatus = serverQueue.isShuffled ? "Aktif 🔀" : "Mati ▶️";

    const queueEmbed = new EmbedBuilder()
      .setColor("#ff5500")
      .setTitle("Antrian Lagu")
      .setDescription(
        `**Sedang Diputar:**\n[${serverQueue.songs[0].title}](${serverQueue.songs[0].url})\n\n` +
          "**Selanjutnya:**\n" +
          serverQueue.songs
            .slice(1, 11)
            .map((song, index) => `${index + 1}. [${song.title}](${song.url})`)
            .join("\n")
      )
      .setFooter({
        text: `Total ${serverQueue.songs.length} lagu | Loop: ${loopStatus} | Acak: ${shuffleStatus}`,
      });

    await interaction.reply({ embeds: [queueEmbed] });
  },
};
