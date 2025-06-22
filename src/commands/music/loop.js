const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Mengatur mode pengulangan (loop).")
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("Pilih mode loop")
        .setRequired(true)
        .addChoices(
          { name: "❌ Mati", value: "off" },
          { name: "🔂 Ulangi Lagu", value: "song" },
          { name: "🔁 Ulangi Antrian", value: "queue" }
        )
    ),
  async execute(interaction, client) {
    const serverQueue = client.queues.get(interaction.guild.id);
    if (!serverQueue) {
      return interaction.reply({
        content: "Tidak ada musik yang sedang diputar.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const mode = interaction.options.getString("mode");
    let newMode = 0;
    let modeText = "Mati";

    if (mode === "song") {
      newMode = 1;
      modeText = "Ulangi Lagu";
    } else if (mode === "queue") {
      newMode = 2;
      modeText = "Ulangi Antrian";
    }

    serverQueue.loopMode = newMode;

    const embed = new EmbedBuilder()
      .setColor("#ff5500")
      .setDescription(`✅ Mode pengulangan diatur ke **${modeText}**.`);

    await interaction.reply({ embeds: [embed] });
  },
};
