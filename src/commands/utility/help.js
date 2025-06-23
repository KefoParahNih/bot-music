const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Menampilkan daftar semua perintah yang tersedia."),
  async execute(interaction, client) {
    const helpEmbed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle("Bantuan Perintah Bot")
      .setDescription(
        "Berikut adalah daftar semua perintah yang bisa Anda gunakan, dikelompokkan berdasarkan kategori:"
      )
      .setTimestamp()
      .setFooter({ text: "Gunakan /<nama_perintah> untuk menjalankan." });

    // Mengelompokkan command berdasarkan kategori
    const commands = {};
    for (const command of client.commands.values()) {
      // Abaikan command help itu sendiri dari daftar
      if (command.data.name === "help") continue;

      const category = command.category || "Lainnya";
      if (!commands[category]) {
        commands[category] = [];
      }
      commands[category].push(
        `**\`/${command.data.name}\`**: ${command.data.description}`
      );
    }

    // Menambahkan field ke embed untuk setiap kategori
    for (const category in commands) {
      // Membuat nama kategori menjadi huruf besar di awal
      const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
      helpEmbed.addFields({
        name: `Kategori: ${categoryName}`,
        value: commands[category].join("\n"),
      });
    }

    await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
  },
};
