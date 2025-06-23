const { Events, MessageFlags } = require("discord.js");
const { createButtonRow } = require("../commands/music/play.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "Terjadi error!",
            flags: [MessageFlags.Ephemeral],
          });
        } else {
          await interaction.reply({
            content: "Terjadi error!",
            flags: [MessageFlags.Ephemeral],
          });
        }
      }
    } else if (interaction.isButton()) {
      const serverQueue = client.queues.get(interaction.guild.id);
      if (!serverQueue) return;

      if (
        !interaction.member.voice.channel ||
        interaction.member.voice.channel.id !== serverQueue.voiceChannel.id
      ) {
        return interaction.reply({
          content: "Kamu harus berada di voice channel yang sama!",
          flags: [MessageFlags.Ephemeral],
        });
      }

      await interaction.deferUpdate();

      switch (interaction.customId) {
        case "music_pause_resume":
          if (serverQueue.player.state.status === "paused") {
            serverQueue.player.unpause();
          } else {
            serverQueue.player.pause();
          }
          break;
        case "music_skip":
          // Logika loop dihapus, skip sekarang selalu menghentikan lagu.
          serverQueue.player.stop();
          break;
        case "music_stop":
          if (serverQueue.nowPlayingMessage) {
            await serverQueue.nowPlayingMessage.delete().catch(() => {});
          }
          serverQueue.songs = [];
          serverQueue.player.stop();
          if (serverQueue.connection) {
            serverQueue.connection.destroy();
          }
          client.queues.delete(interaction.guild.id);
          return;
        case "music_shuffle":
          if (serverQueue.songs.length < 2) break;
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
          break;
      }

      if (
        client.queues.has(interaction.guild.id) &&
        serverQueue.nowPlayingMessage
      ) {
        const newRow = createButtonRow(serverQueue);
        await serverQueue.nowPlayingMessage
          .edit({ components: [newRow] })
          .catch(() => {});
      }
    }
  },
};
